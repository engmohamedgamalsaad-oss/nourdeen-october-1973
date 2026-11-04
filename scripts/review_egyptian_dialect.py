#!/usr/bin/env python3
"""Read-only Egyptian Arabic register review for Khaledoon audio source text.

This is a conservative heuristic, not an Arabic dialect classifier or a TTS engine.
It never rewrites text, changes visible story content, edits manifests/MP3s, or calls
Fish Audio. Findings are advisory and must be checked by a human listener.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORY = Path("stories/science/015/story.json")
DEFAULT_PRONUNCIATION = Path("stories/science/015/audio-pronunciation.json")

# Strong colloquial cues. These are evidence, not a requirement that every block
# contain slang; clear, warm Modern Standard Arabic can still be appropriate.
EGYPTIAN_CUES = (
    "إزاي", "ازاي", "مش", "علشان", "عشان", "كده", "أكتر", "اكتر",
    "ليه", "عايز", "عاوز", "لسه", "تاني", "بتاع", "دي", "ده",
    "إيه", "ايه", "بقى", "مافيش", "مفيش", "بيشتغل", "بتساعد",
)

# Formal constructions worth a human listen-through when the goal is conversational
# Egyptian delivery. Their presence is not an error and must never trigger rewriting.
FORMAL_CUES = (
    "وبالتالي", "حيث", "إذ", "لذلك", "ومن ثم", "يُعد", "تُعد",
    "يُعتبر", "تُعتبر", "ليس", "إنما", "قد تم", "تم إجراء",
    "الذي", "التي", "اللذان", "اللتان", "بالإضافة إلى",
)

WORD_RE = re.compile(r"[\u0621-\u064A\u0660-\u0669]+")
DIACRITIC_RE = re.compile(r"[\u064B-\u0652\u0670]")
TOKEN_RE = re.compile(r"(?<![\u0621-\u064A])(" + "|".join(
    re.escape(x) for x in sorted(set(EGYPTIAN_CUES + FORMAL_CUES), key=len, reverse=True)
) + r")(?![\u0621-\u064A])")


class ReviewError(Exception):
    pass


def read_object(path: Path, label: str) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ReviewError(f"Cannot read {label}: {exc}") from exc
    if not isinstance(data, dict):
        raise ReviewError(f"{label} must be a JSON object")
    return data


def cue_hits(text: str, cues: tuple[str, ...]) -> list[str]:
    padded = f" {text} "
    hits = []
    for cue in cues:
        if re.search(r"(?<![\u0621-\u064A])" + re.escape(cue) + r"(?![\u0621-\u064A])", padded):
            hits.append(cue)
    return hits


def review_text(text: str, speaker: str | None = None) -> dict[str, Any]:
    if not isinstance(text, str) or not text.strip():
        raise ReviewError("Audio source text must be a non-empty string")

    words = WORD_RE.findall(text)
    egyptian = cue_hits(text, EGYPTIAN_CUES)
    formal = cue_hits(text, FORMAL_CUES)
    marked_letters = len(DIACRITIC_RE.findall(text))
    arabic_letters = sum(1 for char in text if "\u0621" <= char <= "\u064A")
    diacritic_density = round(marked_letters / max(arabic_letters, 1), 3)

    # No forced classification when there is too little evidence. This avoids
    # falsely calling normal narration "Egyptian" based on one common word.
    if len(words) < 5 or (not egyptian and not formal):
        register = "INSUFFICIENT_EVIDENCE"
    elif len(egyptian) >= 2 and len(egyptian) >= len(formal):
        register = "EGYPTIAN_LEANING"
    elif len(formal) >= 2 and len(formal) > len(egyptian):
        register = "FORMAL_LEANING"
    elif egyptian and formal:
        register = "MIXED_REGISTER"
    elif egyptian:
        register = "EGYPTIAN_LEANING"
    else:
        register = "NEUTRAL_OR_FORMAL"

    warnings = []
    if register == "FORMAL_LEANING":
        warnings.append("صياغة تميل للفصحى؛ راجع سلاسة الإلقاء بالمصري دون تحويل النص آليًا.")
    elif register == "MIXED_REGISTER":
        warnings.append("يوجد خلط بين تعبيرات عامية وتراكيب فصحى؛ راجع الانتقال بينهما.")
    if diacritic_density >= 0.08:
        warnings.append("التشكيل كثيف نسبيًا؛ اختبر نسخة أقل تشكيلًا لأن كثافته قد تجعل الأداء متكلفًا.")
    if speaker == "karma" and register in ("FORMAL_LEANING", "NEUTRAL_OR_FORMAL"):
        warnings.append("حوار كارما يُفضّل أن يبدو كسؤال طفل طبيعي؛ راجع المفردات والإيقاع.")
    if not egyptian:
        warnings.append("لم تظهر علامة مصرية عامية واضحة؛ هذا ليس خطأً بمفرده.")

    return {
        "speaker": speaker,
        "register": register,
        "word_count": len(words),
        "egyptian_cues": egyptian,
        "formal_cues": formal,
        "diacritic_count": marked_letters,
        "arabic_letter_count": arabic_letters,
        "diacritic_density": diacritic_density,
        "warnings": warnings,
        "automatic_rewrite": False,
        "spoken_pronunciation_result": "NOT_TESTED",
    }


def build_report(story_path: Path, pronunciation_path: Path, language: str) -> dict[str, Any]:
    story = read_object(story_path, "story")
    pronunciation = read_object(pronunciation_path, "audio pronunciation")
    if story.get("format") != "KHALEDOON_STORY":
        raise ReviewError("Unsupported story format")
    if pronunciation.get("story") != story.get("slug"):
        raise ReviewError("Audio pronunciation story does not match story.json")
    if pronunciation.get("language") != language:
        raise ReviewError("Audio pronunciation language does not match requested language")

    visible = story.get("i18n", {}).get(language, {}).get("blocks")
    audio = pronunciation.get("blocks")
    if not isinstance(visible, list) or not isinstance(audio, dict):
        raise ReviewError("Missing localized story blocks or audio source blocks")

    reports = []
    for raw_index, source_text in audio.items():
        try:
            index = int(raw_index)
        except (TypeError, ValueError):
            raise ReviewError(f"Invalid audio block index: {raw_index!r}")
        if index < 0 or index >= len(visible):
            raise ReviewError(f"Audio block index {index} is outside story block range")
        block = visible[index]
        if not isinstance(block, dict):
            raise ReviewError(f"Story block {index} is not an object")
        review = review_text(source_text, block.get("speaker"))
        review.update({
            "block_index": index,
            "visible_story_text_unchanged": True,
            "audio_source_text": source_text,
        })
        reports.append(review)

    reports.sort(key=lambda item: item["block_index"])
    counts = {}
    for item in reports:
        counts[item["register"]] = counts.get(item["register"], 0) + 1
    return {
        "tool": "review_egyptian_dialect.py",
        "version": 1,
        "mode": "READ_ONLY_ADVISORY",
        "story": story.get("slug"),
        "language": language,
        "summary": {
            "blocks_reviewed": len(reports),
            "register_counts": counts,
            "automatic_rewrites": 0,
            "fish_audio_calls": 0,
        },
        "blocks": reports,
        "limitations": [
            "القواعد اللغوية هنا مؤشرات محافظة وليست فهمًا كاملًا للهجة أو للسياق.",
            "لا يمكن للمدقق النصي معرفة النطق الفعلي أو الوقفات أو الإحساس؛ يلزم الاستماع.",
            "لا تُحوّل نتائج الفصحى إلى تصحيح تلقائي، ولا تغيّر النص الظاهر.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only advisory review of Egyptian Arabic audio text.")
    parser.add_argument("--story", default=str(DEFAULT_STORY))
    parser.add_argument("--pronunciation", default=str(DEFAULT_PRONUNCIATION))
    parser.add_argument("--language", default="ar", choices=("ar",))
    args = parser.parse_args()
    story_path = Path(args.story)
    pronunciation_path = Path(args.pronunciation)
    if not story_path.is_absolute():
        story_path = ROOT / story_path
    if not pronunciation_path.is_absolute():
        pronunciation_path = ROOT / pronunciation_path
    try:
        report = build_report(story_path, pronunciation_path, args.language)
    except ReviewError as exc:
        print(json.dumps({"status": "ERROR", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
