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


def build_report(
    story_path: Path, pronunciation_path: Path | None = None, language: str = "ar"
) -> dict[str, Any]:
    story = read_object(story_path, "story")
    if story.get("format") != "KHALEDOON_STORY":
        raise ReviewError("Unsupported story format")
    section = str(story.get("section") or "").strip().lower()
    candidate = pronunciation_path or story_path.with_name("audio-pronunciation.json")
    pronunciation = read_object(candidate, "audio pronunciation") if candidate.is_file() else {}
    if pronunciation_path is not None and not candidate.is_file():
        raise ReviewError(f"Explicit audio pronunciation file does not exist: {candidate}")
    if pronunciation:
        if pronunciation.get("story") != story.get("slug"):
            raise ReviewError("Audio pronunciation story does not match story.json")
        if pronunciation.get("language") != language:
            raise ReviewError("Audio pronunciation language does not match requested language")
        raw_audio = pronunciation.get("blocks")
        approved = pronunciation.get("approved_audio_only_rewrites", [])
        if not isinstance(raw_audio, dict) or not isinstance(approved, list):
            raise ReviewError("Audio pronunciation blocks/approved rewrite list are invalid")
        approved_indexes = {str(index) for index in approved}
        if any(
            not index.isdigit() or str(int(index)) != index or index not in raw_audio
            for index in approved_indexes
        ):
            raise ReviewError("Approved audio-only rewrite references a missing or invalid block")
        if any(
            not isinstance(raw_audio[index], str) or not raw_audio[index].strip()
            for index in approved_indexes
        ):
            raise ReviewError("Approved audio-only rewrite text must be a non-empty string")
        # Match the generator: only explicitly approved audio-only rewrites are
        # eligible; all other blocks must be reviewed against visible story text.
        audio = {index: raw_audio[index] for index in approved_indexes}
    else:
        audio = {}

    visible = story.get("i18n", {}).get(language, {}).get("blocks")
    if not isinstance(visible, list) or not visible:
        raise ReviewError("Missing localized story blocks")

    reports = []
    used_audio_indexes = set()
    for index, block in enumerate(visible):
        if not isinstance(block, dict):
            raise ReviewError(f"Story block {index} is not an object")
        if block.get("speaker") not in ("narrator", "karma"):
            continue
        visible_text = block.get("text")
        if not isinstance(visible_text, str) or not visible_text.strip():
            continue
        source_text = audio.get(str(index), visible_text)
        source_kind = "audio_pronunciation" if str(index) in audio else "story_text_fallback"
        if not isinstance(source_text, str) or not source_text.strip():
            raise ReviewError(f"Audio source for block {index} is empty or invalid")
        if source_kind == "audio_pronunciation":
            used_audio_indexes.add(str(index))
        review = review_text(source_text, block.get("speaker"))
        review.update({
            "block_index": index,
            "source_kind": source_kind,
            "visible_story_text_unchanged": True,
            "audio_source_text": source_text,
        })
        reports.append(review)

    extra_indexes = set(audio) - used_audio_indexes
    if extra_indexes:
        raise ReviewError(
            "Audio pronunciation file contains indexes that are not speakable story blocks: "
            + ", ".join(sorted(extra_indexes))
        )

    reports.sort(key=lambda item: item["block_index"])
    counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    for item in reports:
        counts[item["register"]] = counts.get(item["register"], 0) + 1
        source_counts[item["source_kind"]] = source_counts.get(item["source_kind"], 0) + 1
    return {
        "tool": "review_egyptian_dialect.py",
        "version": 2,
        "mode": "READ_ONLY_ADVISORY",
        "story": story.get("slug"),
        "section": section,
        "story_file": str(story_path.relative_to(ROOT)) if story_path.is_relative_to(ROOT) else str(story_path),
        "language": language,
        "summary": {
            "blocks_reviewed": len(reports),
            "register_counts": counts,
            "source_counts": source_counts,
            "automatic_rewrites": 0,
            "fish_audio_calls": 0,
        },
        "blocks": reports,
        "limitations": [
            "القواعد اللغوية هنا مؤشرات محافظة وليست فهمًا كاملًا للهجة أو للسياق.",
            "لا يمكن للمدقق النصي معرفة النطق الفعلي أو الوقفات أو الإحساس؛ يلزم الاستماع.",
            "النص البديل في audio-pronunciation.json هو نص قراءة صوتي فقط ولا يغيّر نص الحكاية الظاهر.",
            "عند غياب audio-pronunciation.json يستخدم المدقق نص المقطع الظاهر باعتباره مصدر القراءة الافتراضي قبل التوليد.",
            "لا تُحوّل نتائج الفصحى إلى تصحيح تلقائي، ولا تغيّر النص الظاهر.",
        ],
    }


def discover_stories(stories_root: Path) -> list[Path]:
    """Find published-tree and October audio-source packages without changing assets."""
    candidates = list(stories_root.glob("*/*/story.json"))
    candidates.extend(
        (stories_root.parent / "rebuild" / "october-audio-packages").glob("*/story.json")
    )
    found = []
    for path in sorted(set(candidates)):
        package = read_object(path, "story package")
        relative = path.relative_to(stories_root.parent)
        if package.get("format") != "KHALEDOON_STORY":
            continue
        if relative.parts[0] == "stories" and len(relative.parts) == 4:
            section = relative.parts[1]
        elif relative.parts[:2] == ("rebuild", "october-audio-packages") and len(relative.parts) == 4:
            section = "october"
        else:
            continue
        if package.get("section") == section:
            found.append(path)
    return found


def build_all_stories_report(stories_root: Path, language: str = "ar") -> dict[str, Any]:
    paths = discover_stories(stories_root)
    if not paths:
        raise ReviewError(f"No eligible unified story packages found under {stories_root}")
    reports = [build_report(path, language=language) for path in paths]
    counts: dict[str, int] = {}
    total_blocks = 0
    for item in reports:
        total_blocks += item["summary"]["blocks_reviewed"]
        for key, value in item["summary"]["register_counts"].items():
            counts[key] = counts.get(key, 0) + value
    return {
        "tool": "review_egyptian_dialect.py",
        "version": 2,
        "mode": "READ_ONLY_ADVISORY_ALL_STORIES",
        "language": language,
        "summary": {
            "stories_reviewed": len(reports),
            "blocks_reviewed": total_blocks,
            "register_counts": counts,
            "automatic_rewrites": 0,
            "fish_audio_calls": 0,
            "october_stories_included": sum(item["section"] == "october" for item in reports),
        },
        "stories": reports,
        "limitations": [
            "هذه مراجعة استرشادية نصية وليست حكمًا نهائيًا على اللهجة أو جودة الأداء.",
            "لم يتم تشغيل أي خدمة تحويل نص إلى صوت أو استهلاك رصيد.",
            "يشمل الفحص حزم أكتوبر الصوتية؛ يظل التقييم استرشاديًا ولا يغني عن الاستماع البشري.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only advisory review of Egyptian Arabic audio text.")
    parser.add_argument("--story", default=str(DEFAULT_STORY))
    parser.add_argument("--pronunciation", default=None)
    parser.add_argument("--language", default="ar", choices=("ar",))
    parser.add_argument("--all-stories", action="store_true")
    args = parser.parse_args()
    try:
        if args.all_stories:
            report = build_all_stories_report(ROOT / "stories", args.language)
        else:
            story_path = Path(args.story)
            if not story_path.is_absolute():
                story_path = ROOT / story_path
            pronunciation_path = Path(args.pronunciation) if args.pronunciation else None
            if pronunciation_path is not None and not pronunciation_path.is_absolute():
                pronunciation_path = ROOT / pronunciation_path
            report = build_report(story_path, pronunciation_path, args.language)
    except ReviewError as exc:
        print(json.dumps({"status": "ERROR", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
