#!/usr/bin/env python3
"""Read-only structure probe for assets/shared/story-body-i18n.js.

Prints the file head/tail and short windows around a few known Arabic strings
so the audit script can be matched to the real data structure. No writes.
Usage: python3 scripts/probe_story_body_i18n.py > docs/story-body-i18n-probe.json
"""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = (root / "assets/shared/story-body-i18n.js").read_text(encoding="utf-8")

NEEDLES = {
    "story_001_first_paragraph": "الحكاية التي لم تبدأ في السادس من أكتوبر",
    "story_001_caption_flag": "جنود مصريون يرفعون العلم في سيناء",
    "story_001_caption_eilat": "المدمرة «إيلات»؛ صورة للسفينة",
    "story_002_caption": "صورة أرشيفية لجنود مصريين",
    "story_003_caption": "مشهد من قرية نوبية على النيل",
    "story_004_caption": "تشكيل جوي مصري خلال حرب أكتوبر",
    "pageMeta_start": "var pageMeta",
}


def window(needle, before=150, after=900):
    i = text.find(needle)
    return None if i < 0 else text[max(0, i - before): i + after]


out = {
    "chars": len(text),
    "head": text[:1500],
    "tail": text[-600:],
    "top_level_decls": re.findall(r"^(?:var|let|const)\s+\w+|^window\.[\w.]+\s*=", text, re.M)[:40],
    "windows": {k: window(v) for k, v in NEEDLES.items()},
}
print(json.dumps(out, ensure_ascii=False, indent=2))
