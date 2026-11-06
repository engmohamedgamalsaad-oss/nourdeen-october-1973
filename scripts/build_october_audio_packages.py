#!/usr/bin/env python3
"""Build the narration audio packages for the October stories and report exact translation coverage.

For each stories/october/00N it takes the speakable Arabic blocks (title, headings,
paragraphs, timeline years, quotes) from index.html, in reading order, and looks up each
block's en/fr/it/de text the same way the pages do: data-i18n keys from i18n.js /
i18n-extra.js, otherwise assets/shared/story-body-i18n.js (translations + germanStoryText).

Read-only for the site. No TTS, no network, no Supabase. Writes only:
  stories/october/<story>/story.json            (KHALEDOON_STORY, five languages, the
                                                               same shape generate_story_audio.py reads)
  stories/october/<story>/audio-readiness.json  (ready only if every block has a clean
                                                               text in all 5 languages)
  docs/october-audio-packages-report.{txt,json}
Narrator reads everything (Karma is not invented; mark Karma blocks by hand later).
Needs `node` (to evaluate the JS data files).  Usage:
  python3 scripts/build_october_audio_packages.py [--root DIR] [--no-write]

Report guarantees (v2):
  * "translated" counts only non-empty text for the captured blocks.
  * "suspect" lists en/fr/it/de texts that still contain Arabic letters or equal the Arabic.
  * "uncaptured_arabic" lists visible Arabic text on the page that is NOT in any block
    (kickers, fact boxes, notes, link texts...), so "complete" never hides skipped content.
  * "warnings" lists JS files that failed to evaluate and body-map assignment patterns
    the parser cannot read. Nothing fails silently.
"""
import argparse
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

LANGS = ["ar", "en", "fr", "it", "de"]
AR = re.compile(r"[\u0600-\u06FF]")
SKIP_SECTIONS = {"sources", "reactions-section", "story-quiz-section", "kh-dialogue-section"}
SKIP_TAGS = {"figure", "small", "header", "footer", "script", "style", "nav", "head"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
CAPTURE = {"h1", "h2", "h3", "p"}
CAPTURE_DIV = {"year", "hero-subtitle"}
# Source / photo-credit lines that sit inside story sections but are not narration.
EXCLUDE_PREFIXES = ("للاطلاع على صور",)
READINESS_FORMAT = "KHALEDOON_OCTOBER_AUDIO_READINESS_V1"


def norm(s):
    return " ".join(s.split())


def run_node(args, stdin=None):
    return subprocess.run(["node", *args], input=stdin, capture_output=True, text=True, encoding="utf-8")


EVAL_LITERAL = "const s=require('fs').readFileSync(0,'utf8');" \
    "process.stdout.write(JSON.stringify(require('vm').runInNewContext('('+s+')')));"


def eval_literal(src):
    """Evaluate one JS object literal. Returns (obj, error_text)."""
    out = run_node(["-e", EVAL_LITERAL], stdin=src)
    if out.returncode != 0:
        return None, (out.stderr.strip().splitlines() or ["node failed"])[-1][:200]
    return json.loads(out.stdout), None


EVAL_UI = (
    "const vm=require('vm'),fs=require('fs');const files=JSON.parse(process.argv[1]);const dict={};const errs=[];"
    "const win={};win.I18N={register(l,e){dict[l]=Object.assign(dict[l]||{},e)},apply(){},t(k){return k},lang(){return 'ar'}};"
    "const doc={addEventListener(){},querySelector(){return null},querySelectorAll(){return []},readyState:'complete'};"
    "const ctx={window:win,document:doc,setTimeout(){},console:{log(){},error(){}}};vm.createContext(ctx);"
    "for(const f of files){if(!fs.existsSync(f)){errs.push(f+': file not found');continue;}"
    "try{vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{timeout:5000})}"
    "catch(e){errs.push(f+': '+e.message)}}process.stdout.write(JSON.stringify({dict:dict,errors:errs}));"
)


def eval_ui(files):
    """Evaluate the story i18n files. Returns (dict lang->key->text, warnings)."""
    out = run_node(["-e", EVAL_UI, json.dumps([str(f) for f in files])])
    if out.returncode != 0:
        return {}, ["i18n evaluation crashed: " + ((out.stderr.strip().splitlines() or ["?"])[-1][:200])]
    data = json.loads(out.stdout)
    return data["dict"], data["errors"]


def literal_at(text, i):
    """Return the {...} literal starting at text[i] (string-aware)."""
    depth, quote, esc = 0, None, False
    for j in range(i, len(text)):
        c = text[j]
        if quote:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[i:j + 1]
    raise ValueError("unbalanced literal")


LIT = re.compile(r"(?:var\s+(translations|germanStoryText)\s*=\s*|Object\.assign\(\s*(translations|germanStoryText)\s*,\s*)\{")
# Any other way of writing into the maps would be missed silently, so detect and report it.
OTHER_ASSIGN = re.compile(r"\b(?:translations|germanStoryText)\s*(?:\[[^\]]+\]\s*=(?!=)|\.\w+\s*=(?!=))")


def load_body_maps(path):
    """Return (translations: norm_key -> {lang: text}, german: norm_key -> text, warnings)."""
    text = path.read_text(encoding="utf-8")
    trans, german, warnings = {}, {}, []
    for m in LIT.finditer(text):
        kind = m.group(1) or m.group(2)
        try:
            obj, err = eval_literal(literal_at(text, m.end() - 1))
        except ValueError as e:
            obj, err = None, str(e)
        if obj is None:
            warnings.append("story-body-i18n.js: %s literal at char %d not read (%s)" % (kind, m.start(), err))
            continue
        for key, val in obj.items():
            k = norm(key)
            if kind == "translations" and isinstance(val, dict):
                trans.setdefault(k, {}).update({l: t for l, t in val.items() if isinstance(t, str) and t.strip()})
            elif kind == "germanStoryText":
                de = val if isinstance(val, str) else (val or {}).get("de") if isinstance(val, dict) else None
                if isinstance(de, str) and de.strip():
                    german[k] = de
    extra = len(OTHER_ASSIGN.findall(text))
    if extra:
        warnings.append("story-body-i18n.js: %d assignment(s) of another form (map[key]=... / map.key=...) are NOT read" % extra)
    return trans, german, warnings


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sec_skip = 0       # >0 while inside a skipped <section> (nesting-aware)
        self.skip_depth = 0     # >0 while inside a SKIP_TAGS element
        self.cur = None         # (tag, data-i18n) of the block being captured
        self.cur_depth = 0
        self.buf = []
        self.blocks = []
        self.excluded = []
        self.stack = []         # (tag, class-string, data-i18n) of open non-void elements
        self.uncaptured = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = set((a.get("class") or "").split())
        if tag == "br" and self.cur:
            self.buf.append(" ")
        if tag not in VOID_TAGS:
            self.stack.append((tag, " ".join(sorted(cls)), a.get("data-i18n")))
        if tag == "section":
            if self.sec_skip:
                self.sec_skip += 1
            elif cls & SKIP_SECTIONS:
                self.sec_skip = 1
        if tag in SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.cur is not None:
            if tag == self.cur[0]:
                self.cur_depth += 1
        elif not self.sec_skip and not self.skip_depth:
            if tag in CAPTURE or (tag == "div" and cls & CAPTURE_DIV):
                kind = "heading" if tag in ("h1", "h2", "h3") else (
                    "timeline" if "year" in cls else ("subtitle" if tag == "div" else "paragraph"))
                self.cur = (tag, a.get("data-i18n"), kind)
                self.cur_depth = 1
                self.buf = []

    def handle_endtag(self, tag):
        if tag not in VOID_TAGS:
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    break
        if tag == "section" and self.sec_skip:
            self.sec_skip -= 1
        if tag in SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.cur and tag == self.cur[0]:
            self.cur_depth -= 1
            if self.cur_depth == 0:
                text = norm("".join(self.buf))
                if text and (AR.search(text) or self.cur[1]):
                    if text.startswith(EXCLUDE_PREFIXES):
                        self.excluded.append({"tag": self.cur[0], "ar": text[:70]})
                    else:
                        self.blocks.append({"tag": self.cur[0], "key": self.cur[1], "kind": self.cur[2], "ar": text})
                self.cur = None

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.cur:
            self.buf.append(data)
        elif not self.sec_skip and AR.search(data):
            tag, cls, key = self.stack[-1] if self.stack else ("", "", None)
            self.uncaptured.append({"tag": tag, "class": cls, "key": key, "ar": norm(data)[:70]})


def lookup(block, lang, ui, trans, german):
    if lang == "ar":
        return (ui.get("ar", {}).get(block["key"]) if block["key"] else None) or block["ar"]
    if block["key"]:
        v = ui.get(lang, {}).get(block["key"])
        if v:
            return v
    ent = trans.get(norm(block["ar"]), {})
    v = ent.get(lang)
    if not v and lang == "de":
        v = german.get(norm(block["ar"]))
    return v


def build_story(story_dir, ui, trans, german):
    parser = Collector()
    parser.feed((story_dir / "index.html").read_text(encoding="utf-8"))
    blocks = parser.blocks
    # Peer-format package (same shape scripts/generate_story_audio.py reads for the other stories).
    package = {"format": "KHALEDOON_STORY", "section": "october", "slug": story_dir.name, "i18n": {}}
    report = {"story": story_dir.name, "blocks": len(blocks), "languages": {}, "uncaptured_arabic": parser.uncaptured,
              "excluded": parser.excluded}
    for lang in LANGS:
        out, missing, suspect = [], [], []
        for i, b in enumerate(blocks):
            text = lookup(b, lang, ui, trans, german)
            if not text:
                missing.append({"index": i, "tag": b["tag"], "ar": b["ar"][:70]})
            elif lang != "ar" and (AR.search(text) or norm(text) == b["ar"]):
                suspect.append({"index": i, "tag": b["tag"], "ar": b["ar"][:70], "text": text[:70]})
            out.append({"type": b["kind"], "speaker": "narrator", "text": norm(text) if text else ""})
        package["i18n"][lang] = {"blocks": out}
        report["languages"][lang] = {"translated": len(blocks) - len(missing), "missing": missing, "suspect": suspect}
    langs = report["languages"]
    readiness = {
        "format": READINESS_FORMAT,
        "story": story_dir.name,
        "ready": bool(blocks) and all(not langs[l]["missing"] and not langs[l]["suspect"] for l in LANGS),
        "blocks": len(blocks),
        "missing": {l: [m["index"] for m in langs[l]["missing"]] for l in LANGS},
        "suspect": {l: [m["index"] for m in langs[l]["suspect"]] for l in LANGS},
        "excluded_source_lines": len(parser.excluded),
        "generated_by": "scripts/build_october_audio_packages.py",
    }
    report["ready"] = readiness["ready"]
    return package, readiness, report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args(argv)
    root = Path(args.root)
    warnings = []
    trans, german, w = load_body_maps(root / "assets/shared/story-body-i18n.js")
    warnings += w
    reports = []
    for d in sorted(p for p in (root / "stories/october").glob("*") if (p / "index.html").exists()):
        ui, w = eval_ui([d / "i18n.js", d / "i18n-extra.js"])
        warnings += ["%s: %s" % (d.name, x) for x in w]
        package, readiness, report = build_story(d, ui, trans, german)
        reports.append(report)
        if not args.no_write:
            out = root / "stories/october" / d.name
            out.mkdir(parents=True, exist_ok=True)
            (out / "story.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (out / "audio-readiness.json").write_text(json.dumps(readiness, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (out / "story.draft.json").unlink(missing_ok=True)  # superseded by story.json
    lines = ["body maps: %d translation keys, %d german-only keys" % (len(trans), len(german))]
    if warnings:
        lines.append("WARNINGS (%d):" % len(warnings))
        lines += ["  ! " + x for x in warnings]
    else:
        lines.append("warnings: none")
    for r in reports:
        lines.append("== October %s: %d speakable blocks, audio package %s ==" % (
            r["story"], r["blocks"], "READY" if r["ready"] else "NOT READY"))
        for x in r["excluded"]:
            lines.append("  excluded source line <%s> %s" % (x["tag"], x["ar"]))
        for lang in LANGS:
            info = r["languages"][lang]
            lines.append("  %s: %d/%d translated, %d suspect" % (lang, info["translated"], r["blocks"], len(info["suspect"])))
            for m in info["missing"][:12]:
                lines.append("     missing #%d <%s> %s" % (m["index"], m["tag"], m["ar"]))
            for m in info["suspect"][:12]:
                lines.append("     suspect #%d <%s> %s => %s" % (m["index"], m["tag"], m["ar"], m["text"]))
        unc = r["uncaptured_arabic"]
        lines.append("  NOT in narration: %d visible Arabic text pieces" % len(unc))
        for u in unc[:25]:
            lines.append("     <%s%s%s> %s" % (u["tag"], "." + u["class"].replace(" ", ".") if u["class"] else "",
                                             " " + u["key"] if u["key"] else "", u["ar"]))
    text = "\n".join(lines) + "\n"
    print(text)
    if not args.no_write:
        docs = root / "docs"
        docs.mkdir(exist_ok=True)
        (docs / "october-audio-packages-report.txt").write_text(text, encoding="utf-8")
        (docs / "october-audio-packages-report.json").write_text(
            json.dumps({"warnings": warnings, "stories": reports}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
