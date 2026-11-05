#!/usr/bin/env python3
"""Build DRAFT narration packages for the October stories and report exact translation coverage.

For each stories/october/00N it takes the speakable Arabic blocks (title, headings,
paragraphs, timeline years, quotes) from index.html, in reading order, and looks up each
block's en/fr/it/de text the same way the pages do: data-i18n keys from i18n.js /
i18n-extra.js, otherwise assets/shared/story-body-i18n.js (translations + germanStoryText).

Read-only for the site. No TTS, no network, no Supabase. Writes only:
  rebuild/october-audio-packages/<story>/story.draft.json
  docs/october-audio-packages-report.{txt,json}
Narrator reads everything (Karma is not invented; mark Karma blocks by hand later).
Needs `node` (to evaluate the JS data files).  Usage:
  python3 scripts/build_october_audio_packages.py [--root DIR] [--no-write]
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
SKIP_TAGS = {"figure", "small", "header", "footer", "script", "style", "nav"}
CAPTURE = {"h1", "h2", "h3", "p"}
CAPTURE_DIV = {"year", "hero-subtitle"}


def norm(s):
    return " ".join(s.split())


def node_eval(code, *args):
    out = subprocess.run(["node", "-e", code, *args], capture_output=True, text=True, check=True, encoding="utf-8")
    return json.loads(out.stdout)


EVAL_LITERAL = "const s=require('fs').readFileSync(0,'utf8');" \
    "process.stdout.write(JSON.stringify(require('vm').runInNewContext('('+s+')')));"


def eval_literal(src):
    out = subprocess.run(["node", "-e", EVAL_LITERAL], input=src, capture_output=True, text=True, check=True, encoding="utf-8")
    return json.loads(out.stdout)


EVAL_UI = (
    "const vm=require('vm'),fs=require('fs');const files=JSON.parse(process.argv[1]);const dict={};"
    "const win={};win.I18N={register(l,e){dict[l]=Object.assign(dict[l]||{},e)},apply(){},t(k){return k},lang(){return 'ar'}};"
    "const doc={addEventListener(){},querySelector(){return null},querySelectorAll(){return []},readyState:'complete'};"
    "const ctx={window:win,document:doc,setTimeout(){},console:{log(){},error(){}}};vm.createContext(ctx);"
    "for(const f of files){if(!fs.existsSync(f))continue;try{vm.runInContext(fs.readFileSync(f,'utf8'),ctx)}"
    "catch(e){process.stderr.write(f+': '+e.message+'\\n')}}process.stdout.write(JSON.stringify(dict));"
)


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


def load_body_maps(path):
    """Return (translations: norm_key -> {lang: text}, german: norm_key -> text)."""
    text = path.read_text(encoding="utf-8")
    trans, german = {}, {}
    for m in LIT.finditer(text):
        kind = m.group(1) or m.group(2)
        obj = eval_literal(literal_at(text, m.end() - 1))
        for key, val in obj.items():
            k = norm(key)
            if kind == "translations" and isinstance(val, dict):
                trans.setdefault(k, {}).update({l: t for l, t in val.items() if isinstance(t, str) and t.strip()})
            elif kind == "germanStoryText":
                de = val if isinstance(val, str) else (val or {}).get("de")
                if isinstance(de, str) and de.strip():
                    german[k] = de
    return trans, german


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip_sec = False
        self.skip_depth = 0
        self.cur = None
        self.buf = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = set((a.get("class") or "").split())
        if tag == "section":
            self.skip_sec = bool(cls & SKIP_SECTIONS)
        if tag in SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.cur is None and not self.skip_sec and not self.skip_depth:
            if tag in CAPTURE or (tag == "div" and cls & CAPTURE_DIV):
                self.cur = (tag, a.get("data-i18n"))
                self.buf = []

    def handle_endtag(self, tag):
        if tag == "section":
            self.skip_sec = False
        if tag in SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.cur and tag == self.cur[0]:
            text = norm("".join(self.buf))
            if text and (AR.search(text) or self.cur[1]):
                self.blocks.append({"tag": self.cur[0], "key": self.cur[1], "ar": text})
            self.cur = None

    def handle_data(self, data):
        if self.cur and not self.skip_depth:
            self.buf.append(data)


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
    package = {
        "format": "KHALEDOON_STORY",
        "section": "october",
        "slug": story_dir.name,
        "status": "DRAFT_NOT_FOR_GENERATION",
        "note": "Narration draft built from the published page; Karma blocks are not invented. Review before use.",
        "i18n": {},
    }
    report = {"story": story_dir.name, "blocks": len(blocks), "languages": {}}
    for lang in LANGS:
        out, missing = [], []
        for i, b in enumerate(blocks):
            text = lookup(b, lang, ui, trans, german)
            if not text:
                missing.append({"index": i, "tag": b["tag"], "ar": b["ar"][:70]})
            out.append({"index": i, "speaker": "narrator", "kind": b["tag"], "text": text or "", "missing": not text})
        package["i18n"][lang] = {"blocks": out}
        report["languages"][lang] = {"translated": len(blocks) - len(missing), "missing": missing}
    return package, report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args(argv)
    root = Path(args.root)
    trans, german = load_body_maps(root / "assets/shared/story-body-i18n.js")
    reports = []
    for d in sorted(p for p in (root / "stories/october").glob("*") if (p / "index.html").exists()):
        ui = node_eval(EVAL_UI, json.dumps([str(d / "i18n.js"), str(d / "i18n-extra.js")]))
        package, report = build_story(d, ui, trans, german)
        reports.append(report)
        if not args.no_write:
            out = root / "rebuild/october-audio-packages" / d.name
            out.mkdir(parents=True, exist_ok=True)
            (out / "story.draft.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["body maps: %d translation keys, %d german-only keys" % (len(trans), len(german))]
    for r in reports:
        lines.append("== October %s: %d speakable blocks ==" % (r["story"], r["blocks"]))
        for lang in LANGS:
            info = r["languages"][lang]
            lines.append("  %s: %d/%d translated" % (lang, info["translated"], r["blocks"]))
            for m in info["missing"][:12]:
                lines.append("     missing #%d <%s> %s" % (m["index"], m["tag"], m["ar"]))
    text = "\n".join(lines) + "\n"
    print(text)
    if not args.no_write:
        docs = root / "docs"
        docs.mkdir(exist_ok=True)
        (docs / "october-audio-packages-report.txt").write_text(text, encoding="utf-8")
        (docs / "october-audio-packages-report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
