#!/usr/bin/env python3
"""Read-only audit of the October stories (stories/october/00N) translation coverage.

Reports, per story and per language (ar, en, fr, it, de):
  1. UI/dialogue keys registered in i18n.js / i18n-extra.js vs the Arabic key set.
  2. data.json i18n fields.
  3. Arabic body blocks in index.html and whether each appears verbatim in
     assets/shared/story-body-i18n.js, plus a structure probe of that file.

No network, no writes, no audio services. Usage:
  python3 scripts/audit_october_i18n.py [--root DIR] [--json]
"""
import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

LANGS = ["ar", "en", "fr", "it", "de"]
AR = re.compile(r"[\u0600-\u06FF]")
STR = re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', re.S)
REG = re.compile(r"register\(\s*['\"](\w+)['\"]\s*,\s*\{")
BARE = re.compile(r"(?:^|[,{])\s*([A-Za-z_]\w*)\s*:")
DATA_FIELDS = ["name", "grade", "className", "title", "subtitle", "person"]


def object_at(text, start):
    """Return the {...} literal whose '{' is at text[start]."""
    depth, quote, esc = 0, None, False
    for i in range(start, len(text)):
        c = text[i]
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
                return text[start:i + 1]
    return text[start:]


def keys_of(obj):
    keys = set()
    for m in STR.finditer(obj):
        if obj[m.end():].lstrip().startswith(":"):
            keys.add(m.group(0)[1:-1])
    keys.update(BARE.findall(STR.sub('""', obj)))
    return keys


def i18n_keys(story_dir):
    out = {lang: set() for lang in LANGS}
    for name in ("i18n.js", "i18n-extra.js"):
        p = story_dir / name
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        for m in REG.finditer(text):
            lang = m.group(1)
            if lang in out:
                out[lang] |= keys_of(object_at(text, m.end() - 1))
    return out


class Blocks(HTMLParser):
    CAPTURE = {"p", "h2", "h3", "figcaption", "li"}

    def __init__(self):
        super().__init__()
        self.in_section = False
        self.cur = None
        self.buf = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag == "section":
            self.in_section = bool({"story", "end"} & set(classes))
        if not self.in_section or self.cur or "data-i18n" in a:
            return
        if tag in self.CAPTURE or (tag == "div" and {"kicker", "year"} & set(classes)):
            self.cur, self.buf = tag, []

    def handle_endtag(self, tag):
        if tag == "section":
            self.in_section = False
        if self.cur == tag:
            text = " ".join("".join(self.buf).split())
            if text:
                self.blocks.append(text)
            self.cur = None

    def handle_data(self, data):
        if self.cur:
            self.buf.append(data)


def norm(s):
    return " ".join(s.split())


def unescape_js(s):
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


def audit_story(story_dir, body_js):
    rep = {"story": story_dir.name}
    ar_keys = None
    keys = i18n_keys(story_dir)
    ar_keys = keys["ar"]
    rep["ui_keys"] = {
        lang: {"count": len(keys[lang]), "missing_vs_ar": sorted(ar_keys - keys[lang])}
        for lang in LANGS
    }
    dj = story_dir / "data.json"
    data_rep = {}
    if dj.exists():
        data = json.loads(dj.read_text(encoding="utf-8"))
        for lang in LANGS[1:]:
            block = (data.get("i18n") or {}).get(lang) or {}
            data_rep[lang] = [f for f in DATA_FIELDS if not block.get(f)]
    rep["data_json_missing_fields"] = data_rep
    idx = story_dir / "index.html"
    parser = Blocks()
    parser.feed(idx.read_text(encoding="utf-8"))
    arabic = [b for b in parser.blocks if AR.search(b)]
    found = [b for b in arabic if body_js and norm(b) in body_js]
    rep["body_blocks"] = {
        "arabic_total": len(arabic),
        "found_verbatim_in_story_body_i18n": len(found),
        "not_found_samples": [b[:60] for b in arabic if b not in found][:5],
    }
    return rep


def probe(body_text, slugs):
    if body_text is None:
        return {"exists": False}
    info = {"exists": True, "chars": len(body_text)}
    info["lang_key_hits"] = {
        lang: len(re.findall(r"""["']?%s["']?\s*:""" % lang, body_text)) for lang in LANGS
    }
    snippets = {}
    for slug in slugs:
        m = re.search(r"october/%s|[\"']%s[\"']" % (slug, slug), body_text)
        if m:
            snippets[slug] = body_text[max(0, m.start() - 80): m.start() + 240]
    info["slug_snippets"] = snippets
    return info


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    root = Path(args.root)
    body_path = root / "assets/shared/story-body-i18n.js"
    body_text = unescape_js(body_path.read_text(encoding="utf-8")) if body_path.exists() else None
    body_norm = norm(body_text) if body_text else ""
    dirs = sorted(p for p in (root / "stories/october").glob("*") if (p / "index.html").exists())
    result = {
        "stories": [audit_story(d, body_norm) for d in dirs],
        "body_file_probe": probe(body_text, [d.name for d in dirs]),
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    for s in result["stories"]:
        print("== October story %s ==" % s["story"])
        for lang in LANGS:
            u = s["ui_keys"][lang]
            miss = u["missing_vs_ar"]
            print("  ui %s: %d keys%s" % (lang, u["count"], "" if not miss else ", missing %d: %s" % (len(miss), ", ".join(miss[:8]))))
        for lang, miss in s["data_json_missing_fields"].items():
            if miss:
                print("  data.json %s missing: %s" % (lang, ", ".join(miss)))
        b = s["body_blocks"]
        print("  body: %d Arabic blocks, %d found verbatim in story-body-i18n.js" % (b["arabic_total"], b["found_verbatim_in_story_body_i18n"]))
    p = result["body_file_probe"]
    print("== story-body-i18n.js probe ==")
    print(json.dumps(p, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
