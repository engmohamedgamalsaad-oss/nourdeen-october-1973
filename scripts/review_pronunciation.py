#!/usr/bin/env python3
"""Read-only Arabic comparison of visible story text and its audio manifest.

This reviewer does not edit story data, manifests, or MP3 files and never calls a
TTS provider. A textual pass confirms written-word identity and order only; it
does not establish that a voice model pronounced the words correctly.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORY = Path("stories/science/015/story.json")
DEFAULT_MANIFEST = Path("assets/audio/science/magdi-yacoub/ar/manifest.json")
DEFAULT_BLOCK_INDEX = 1

# The agreed comparison normalization is intentionally narrow.
REMOVED_CODEPOINTS = (
    *range(0x064B, 0x0653),  # U+064B–U+0652
    0x0670,                 # superscript alef
    0x0640,                 # tatweel
)
REMOVE_MARKS = {codepoint: None for codepoint in REMOVED_CODEPOINTS}
DIACRITIC_RE = re.compile(r"[\u064B-\u0652\u0670]")


class ReviewError(Exception):
    """Raised when inputs cannot be compared safely."""


def sha256_file(path: Path, label: str) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as exc:
        raise ReviewError(f"Cannot calculate {label} SHA-256: {path}: {exc}") from exc


def read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ReviewError(f"Cannot read {label} as UTF-8 JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ReviewError(f"{label} must contain a JSON object: {path}")
    return value


def resolve_input(raw_path: str | Path, label: str) -> Path:
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(ROOT.resolve())
    except (OSError, ValueError) as exc:
        raise ReviewError(f"{label} must be an existing file inside the repository: {raw_path}") from exc
    if not resolved.is_file():
        raise ReviewError(f"{label} is not a file: {resolved}")
    return resolved


def normalize_words_text(value: str) -> str:
    """Remove only the agreed marks; preserve Arabic letter identity."""
    return value.translate(REMOVE_MARKS)


def tokenize(value: str) -> list[str]:
    # Keep every Unicode combining mark that was not explicitly removed above.
    # This prevents the comparison from silently ignoring unapproved marks.
    tokens: list[str] = []
    current: list[str] = []
    for char in normalize_words_text(value):
        category = unicodedata.category(char)
        if char.isalnum() or category.startswith("M"):
            current.append(char)
        elif current:
            tokens.append("".join(current))
            current = []
    if current:
        tokens.append("".join(current))
    return tokens


def punctuation_marks(value: str) -> list[dict[str, Any]]:
    """Record punctuation with its word and character position, not just its symbol."""
    normalized = normalize_words_text(value)
    marks: list[dict[str, Any]] = []
    word_position = 0
    char_position = 0
    in_word = False
    for char in normalized:
        category = unicodedata.category(char)
        if char.isalnum() or category.startswith("M"):
            if not in_word:
                word_position += 1
                char_position = 0
                in_word = True
            if not category.startswith("M"):
                char_position += 1
        else:
            if category.startswith("P"):
                marks.append({
                    "mark": char,
                    "after_word": word_position,
                    "char_position": char_position,
                })
            in_word = False
    return marks


def diacritics(value: str) -> list[dict[str, Any]]:
    """Record approved diacritics with their exact word and character position."""
    marks: list[dict[str, Any]] = []
    word_position = 0
    char_position = 0
    in_word = False
    for char in value:
        category = unicodedata.category(char)
        if char.isalnum():
            if not in_word:
                word_position += 1
                char_position = 0
                in_word = True
            char_position += 1
        elif category.startswith("M"):
            if DIACRITIC_RE.fullmatch(char):
                marks.append({
                    "mark": char,
                    "word_position": word_position,
                    "char_position": char_position,
                })
        else:
            in_word = False
    return marks


# These tokens are used only to classify a visible-vs-spoken number rewrite.
# A match after removing them is NEVER treated as PASS: the exact number must still
# be checked by a human because this lexical heuristic does not calculate numeric value.
ARABIC_NUMBER_FORM_TOKENS = {
    "ألف", "ألفين", "ألفان", "الف", "ألاف", "آلاف",
    "مئة", "مائة", "مية", "ميه", "تسعمية", "تسعمائة", "تسعمائه",
    "خمسمية", "خمسمائة", "خمسمائه", "سبعمية", "سبعمائة", "سبعمائه",
    "ثمانمية", "ثمانمائة", "ثمانمائه", "أربعمية", "أربعمائة",
    "مئتين", "مائتين", "مئتان", "مائتان",
    "واحد", "واحدة", "اثنين", "اتنين", "اثنا", "اثنتين",
    "ثلاثة", "ثلاث", "أربعة", "أربع", "خمسة", "خمس", "ستة", "ست",
    "سبعة", "سبع", "ثمانية", "ثمان", "تسعة", "تسع", "عشرة", "عشر",
    "أحد", "إحدى", "عشرون", "عشرين", "ثلاثون", "ثلاثين",
    "أربعون", "أربعين", "خمسون", "خمسين", "ستون", "ستين",
    "سبعون", "سبعين", "ثمانون", "ثمانين", "تسعون", "تسعين",
    "وتسعمية", "وتسعمائة", "وخمسة", "وخمسمية", "وخمسمائة", "وتلاتين", "وستين", "وخمسين",
    "وتسعين", "وأربعتاشر", "وأربعة", "واتنين", "وتمانية", "وتسعة",
    "السادس", "العاشر",
}


def is_number_form_token(token: str) -> bool:
    return token.isdigit() or token in ARABIC_NUMBER_FORM_TOKENS


ARABIC_MONTH_TOKENS = {
    "يناير", "فبراير", "مارس", "أبريل", "ابريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "اغسطس", "سبتمبر", "أكتوبر", "اكتوبر",
    "نوفمبر", "ديسمبر",
}


def remove_date_connector(tokens: list[str]) -> list[str]:
    """Ignore 'من' only when it links a spoken date ordinal to an Arabic month."""
    result: list[str] = []
    for index, token in enumerate(tokens):
        previous = tokens[max(0, index - 3):index]
        next_token = tokens[index + 1] if index + 1 < len(tokens) else None
        if (
            token == "من"
            and next_token in ARABIC_MONTH_TOKENS
            and bool(previous)
            and is_number_form_token(previous[-1])
        ):
            continue
        if (
            token == "سنة"
            and index > 0
            and tokens[index - 1] in ARABIC_MONTH_TOKENS
            and next_token is not None
            and is_number_form_token(next_token)
        ):
            continue
        result.append(token)
    return result


def is_number_form_only_difference(before: list[str], after: list[str]) -> bool:
    """Flag number/date wording rewrites for human review, never auto-approve."""
    if before == after:
        return False
    before_words = [
        token for token in remove_date_connector(before)
        if not is_number_form_token(token)
    ]
    after_words = [
        token for token in remove_date_connector(after)
        if not is_number_form_token(token)
    ]
    return before_words == after_words


def sequence_differences(before: list[Any], after: list[Any]) -> list[dict[str, Any]]:
    def comparable(value: Any) -> Any:
        return tuple(sorted(value.items())) if isinstance(value, dict) else value

    matcher = difflib.SequenceMatcher(
        a=[comparable(value) for value in before],
        b=[comparable(value) for value in after],
        autojunk=False,
    )
    changes: list[dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        changes.append({
            "change": tag,
            "visible_positions_1_based": [i1 + 1, i2],
            "audio_positions_1_based": [j1 + 1, j2],
            "visible": before[i1:i2],
            "audio": after[j1:j2],
        })
    return changes


def validate_manifest(
    manifest: dict[str, Any], blocks: list[Any], story: dict[str, Any], language: str
) -> tuple[dict[int, list[dict[str, Any]]], list[str]]:
    errors: list[str] = []
    slug = story.get("slug")
    section = story.get("section")

    if manifest.get("story") != slug:
        errors.append(f"Manifest story mismatch: expected {slug!r}, got {manifest.get('story')!r}.")
    if manifest.get("section") != section:
        errors.append(f"Manifest section mismatch: expected {section!r}, got {manifest.get('section')!r}.")
    if manifest.get("language") != language:
        errors.append(f"Manifest language mismatch: expected {language!r}, got {manifest.get('language')!r}.")

    segments = manifest.get("segments")
    if not isinstance(segments, list):
        raise ReviewError("Manifest 'segments' must be a list.")

    grouped: dict[int, list[dict[str, Any]]] = {}
    seen_pairs: set[tuple[int, int]] = set()

    for position, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict):
            errors.append(f"Manifest segment #{position} is not an object.")
            continue
        block_index = segment.get("block_index")
        chunk_index = segment.get("chunk_index", 0)
        if (
            not isinstance(block_index, int) or isinstance(block_index, bool)
            or not isinstance(chunk_index, int) or isinstance(chunk_index, bool)
            or block_index < 0 or chunk_index < 0
        ):
            errors.append(f"Manifest segment #{position} has an invalid block_index/chunk_index.")
            continue

        # Multiple chunks may legitimately belong to one block. The unique key
        # is therefore (block_index, chunk_index), not block_index alone.
        pair = (block_index, chunk_index)
        if pair in seen_pairs:
            errors.append(
                f"Duplicate manifest segment for block_index={block_index}, chunk_index={chunk_index}."
            )
            continue
        seen_pairs.add(pair)

        if block_index >= len(blocks):
            errors.append(
                f"Manifest block_index={block_index} is outside the story block range 0..{len(blocks) - 1}."
            )
            continue
        # Production manifests may intentionally omit submitted text and retain only
        # the content hash. Do not reject those records or invent a text comparison.
        if "text" in segment and (
            not isinstance(segment.get("text"), str) or not segment["text"].strip()
        ):
            errors.append(
                f"Manifest block_index={block_index}, chunk_index={chunk_index} has invalid audio text."
            )
            continue
        story_block = blocks[block_index]
        if isinstance(story_block, dict):
            expected_speaker = story_block.get("speaker")
            if segment.get("speaker") != expected_speaker:
                errors.append(
                    f"Speaker mismatch at block_index={block_index}, chunk_index={chunk_index}: "
                    f"story={expected_speaker!r}, manifest={segment.get('speaker')!r}."
                )
        grouped.setdefault(block_index, []).append(segment)

    for block_index, items in grouped.items():
        items.sort(key=lambda item: item.get("chunk_index", 0))
        indexes = [item.get("chunk_index", 0) for item in items]
        expected = list(range(len(indexes)))
        if indexes != expected:
            errors.append(
                f"Chunk indexes for block_index={block_index} must be contiguous from 0; got {indexes}."
            )

    return grouped, errors


def review_block(
    block_index: int, block: dict[str, Any], segments: list[dict[str, Any]],
    submitted_audio_text: str,
) -> dict[str, Any]:
    visible = block.get("text")
    if not isinstance(visible, str) or not visible.strip():
        raise ReviewError(f"Story block {block_index} has empty/non-text visible content.")

    ordered = sorted(segments, key=lambda item: item.get("chunk_index", 0))
    manifest_text_available = all(
        isinstance(item.get("text"), str) and item["text"].strip()
        for item in ordered
    )
    audio = (
        " ".join(item["text"].strip() for item in ordered)
        if manifest_text_available else None
    )
    submitted = re.sub(r"\s+", " ", submitted_audio_text).strip()
    visible_words = tokenize(visible)
    submitted_words = tokenize(submitted)
    manifest_words = tokenize(audio) if audio is not None else []
    visible_to_submitted = sequence_differences(visible_words, submitted_words)
    submitted_to_manifest = (
        sequence_differences(submitted_words, manifest_words)
        if manifest_text_available else []
    )
    visible_punctuation = sequence_differences(
        punctuation_marks(visible), punctuation_marks(submitted)
    )
    manifest_punctuation = (
        sequence_differences(punctuation_marks(submitted), punctuation_marks(audio))
        if manifest_text_available else []
    )
    visible_diacritics = diacritics(visible)
    submitted_diacritics = diacritics(submitted)
    manifest_diacritics = diacritics(audio) if audio is not None else []

    voice_records = []
    for item in ordered:
        voice_records.append({
            "chunk_index": item.get("chunk_index", 0),
            "audio_file": item.get("src"),
            "content_hash": item.get("hash"),
            "speaker": item.get("speaker"),
            "provider": item.get("provider"),
            "model": item.get("model"),
            "voice_id": item.get("voice"),
            "audio_format": Path(str(item.get("src") or "")).suffix.lstrip(".").lower() or None,
            # Fish Audio's active request sends text, reference_id and format;
            # it does not send rate/pitch. Never report unused generator constants as applied settings.
            "rate": "NOT_SENT_TO_FISH_AUDIO" if item.get("provider") == "fish-audio" else item.get("rate"),
            "pitch": "NOT_SENT_TO_FISH_AUDIO" if item.get("provider") == "fish-audio" else item.get("pitch"),
            "request_fields": ["text", "reference_id", "format"] if item.get("provider") == "fish-audio" else None,
            "request_headers": ["Content-Type", "model", "Authorization (secret value not recorded)"] if item.get("provider") == "fish-audio" else None,
            "manifest_text_available": isinstance(item.get("text"), str) and bool(item["text"].strip()),
        })

    return {
        "block_index": block_index,
        "speaker": block.get("speaker"),
        "visible_text": visible,
        "audio_pronunciation_source_text": submitted,
        "audio_text_from_manifest": audio,
        "manifest_text_verification": (
            "AVAILABLE" if manifest_text_available else "NOT_STORED_IN_MANIFEST"
        ),
        "word_identity_and_order": {
            "visible_vs_submitted": {
                "status": (
                    "PASS" if not visible_to_submitted
                    else "NUMBER_FORM_REVIEW" if is_number_form_only_difference(visible_words, submitted_words)
                    else "FAIL"
                ),
                "number_form_only_difference": is_number_form_only_difference(visible_words, submitted_words),
                "visible_word_count": len(visible_words),
                "submitted_word_count": len(submitted_words),
                "differences": visible_to_submitted,
            },
            "submitted_vs_manifest": {
                "status": (
                    "NOT_AVAILABLE" if not manifest_text_available
                    else "PASS" if not submitted_to_manifest else "FAIL"
                ),
                "submitted_word_count": len(submitted_words),
                "manifest_word_count": len(manifest_words) if manifest_text_available else None,
                "differences": submitted_to_manifest,
            },
        },
        "punctuation": {
            "visible_vs_submitted": {
                "status": "SAME" if not visible_punctuation else "DIFFERENT_RECORDED",
                "differences": visible_punctuation,
            },
            "submitted_vs_manifest": {
                "status": (
                    "NOT_AVAILABLE" if not manifest_text_available
                    else "SAME" if not manifest_punctuation else "DIFFERENT_RECORDED"
                ),
                "differences": manifest_punctuation,
            },
        },
        "diacritics": {
            "visible_vs_submitted": {
                "status": "SAME" if visible_diacritics == submitted_diacritics else "DIFFERENT_RECORDED",
                "visible_marks": visible_diacritics,
                "submitted_marks": submitted_diacritics,
                "differences": sequence_differences(visible_diacritics, submitted_diacritics),
            },
            "submitted_vs_manifest": {
                "status": (
                    "NOT_AVAILABLE" if not manifest_text_available
                    else "SAME" if submitted_diacritics == manifest_diacritics else "DIFFERENT_RECORDED"
                ),
                "submitted_marks": submitted_diacritics,
                "manifest_marks": manifest_diacritics if manifest_text_available else None,
                "differences": (
                    sequence_differences(submitted_diacritics, manifest_diacritics)
                    if manifest_text_available else []
                ),
            },
        },
        "audio_segments": voice_records,
        "human_text_review_required": bool(
            visible_to_submitted or submitted_to_manifest
            or visible_punctuation or manifest_punctuation
            or visible_diacritics != submitted_diacritics
            or submitted_diacritics != manifest_diacritics
        ),
        "listening_review_required": True,
        "human_review_required": True,
        "textual_result": (
            "FAIL" if submitted_to_manifest
            else "PASS" if not visible_to_submitted
            else "REVIEW" if is_number_form_only_difference(visible_words, submitted_words)
            else "FAIL"
        ),
        "spoken_pronunciation_result": "NOT_TESTED",
    }


def build_report(
    story_path: Path, manifest_path: Path, language: str, block_index: int,
    pronunciation_path: Path | None = None,
) -> dict[str, Any]:
    story = read_json(story_path, "story")
    manifest = read_json(manifest_path, "audio manifest")
    pronunciation_path = pronunciation_path or story_path.with_name("audio-pronunciation.json")
    pronunciation = read_json(pronunciation_path, "audio pronunciation") if pronunciation_path.is_file() else {}

    if story.get("format") != "KHALEDOON_STORY":
        raise ReviewError("Unsupported story format; expected KHALEDOON_STORY.")
    if not isinstance(story.get("slug"), str) or not story["slug"].strip():
        raise ReviewError("Story is missing a valid slug.")
    if not isinstance(story.get("section"), str) or not story["section"].strip():
        raise ReviewError("Story is missing a valid section.")
    if language != "ar":
        raise ReviewError("This first version intentionally reviews Arabic only.")

    localized = story.get("i18n", {}).get(language)
    blocks = localized.get("blocks") if isinstance(localized, dict) else None
    if not isinstance(blocks, list) or not blocks:
        raise ReviewError(f"Story has no non-empty i18n.{language}.blocks list.")
    if block_index < 0 or block_index >= len(blocks):
        raise ReviewError(f"block-index {block_index} is outside the story block range.")

    structural_errors: list[str] = []
    if pronunciation:
        if pronunciation.get("story") != story.get("slug"):
            structural_errors.append("Audio pronunciation story slug does not match story.json.")
        if pronunciation.get("language") != language:
            structural_errors.append("Audio pronunciation language does not match requested language.")
    pronunciation_blocks = pronunciation.get("blocks", {}) if pronunciation else {}
    if not isinstance(pronunciation_blocks, dict):
        raise ReviewError("Audio pronunciation 'blocks' must be an object keyed by block index.")
    submitted_audio_text = pronunciation_blocks.get(str(block_index))
    if not isinstance(submitted_audio_text, str) or not submitted_audio_text.strip():
        structural_errors.append(
            f"Audio pronunciation source has no non-empty text for block_index={block_index}."
        )
        submitted_audio_text = ""
    grouped, manifest_errors = validate_manifest(manifest, blocks, story, language)
    structural_errors.extend(manifest_errors)
    selected_segments = grouped.get(block_index, [])
    if not selected_segments:
        structural_errors.append(f"No audio manifest segment exists for block_index={block_index}.")

    block = blocks[block_index]
    if not isinstance(block, dict):
        raise ReviewError(f"Story block {block_index} is not an object.")

    block_report = None
    if selected_segments:
        block_report = review_block(
            block_index, block, selected_segments, submitted_audio_text
        )

    textual_pass = bool(block_report and block_report["textual_result"] == "PASS")
    return {
        "tool": "review_pronunciation.py",
        "tool_version": 1,
        "mode": "READ_ONLY",
        "story": story.get("slug"),
        "section": story.get("section"),
        "language": language,
        "story_file": str(story_path.relative_to(ROOT)),
        "manifest_file": str(manifest_path.relative_to(ROOT)),
        "manifest_sha256": sha256_file(manifest_path, "manifest"),
        "pronunciation_file": (
            str(pronunciation_path.relative_to(ROOT)) if pronunciation_path.is_file() else None
        ),
        "pronunciation_source_metadata": {
            "version": pronunciation.get("version"),
            "revision": pronunciation.get("revision"),
        } if pronunciation else None,
        "scope": {
            "block_index": block_index,
            "note": "Default scope is Magdi Yacoub Arabic block 1, mapped to manifest audio file 001.mp3 in the current pilot."
        },
        "structural_validation": {
            "status": "PASS" if not structural_errors else "FAIL",
            "errors": structural_errors,
        },
        "block": block_report,
        "overall_textual_result": (
            "FAIL" if structural_errors or (block_report and block_report["textual_result"] == "FAIL")
            else "REVIEW" if block_report and block_report["textual_result"] == "REVIEW"
            else (
                "PASS_SOURCE_ONLY"
                if textual_pass and block_report.get("manifest_text_verification") == "NOT_STORED_IN_MANIFEST"
                else "PASS" if textual_pass else "FAIL"
            )
        ),
        "spoken_pronunciation_result": "NOT_TESTED",
        "important_limit": (
            "A textual PASS proves only that the written words and their order match after the agreed "
            "narrow mark normalization. REVIEW means the visible and spoken texts differ only by tokens "
            "classified as possible number wording; a human must confirm the exact numeric value. "
            "Neither PASS nor REVIEW proves that the audio actually pronounces words correctly."
        ),
        "synthesis_settings_note": (
            "The exact audio-only source is read from audio-pronunciation.json. Some production manifest "
            "records retain only a content hash and do not store submitted text; in that case this report "
            "does not claim a source-to-manifest text match. Voice ID/provider/model are read from the manifest. "
            "For the current Fish Audio request, "
            "rate and pitch are not sent to the provider; the request uses text, reference_id and MP3 format. "
            "The report records these as NOT_SENT rather than treating unrelated generator constants as applied settings."
        ),
    }


def build_all_report(
    story_path: Path, manifest_path: Path, language: str,
    pronunciation_path: Path | None = None,
) -> dict[str, Any]:
    """Build one read-only report covering every speakable story block."""
    story = read_json(story_path, "story")
    localized = story.get("i18n", {}).get(language)
    blocks = localized.get("blocks") if isinstance(localized, dict) else None
    if not isinstance(blocks, list) or not blocks:
        raise ReviewError(f"Story has no non-empty i18n.{language}.blocks list.")

    reports = [
        build_report(story_path, manifest_path, language, index, pronunciation_path)
        for index in range(len(blocks))
    ]
    results = [item["overall_textual_result"] for item in reports]
    if any(result == "FAIL" for result in results):
        overall = "FAIL"
    elif any(result == "REVIEW" for result in results):
        overall = "REVIEW"
    elif any(result == "PASS_SOURCE_ONLY" for result in results):
        overall = "PASS_SOURCE_ONLY"
    else:
        overall = "PASS"

    return {
        "tool": "review_pronunciation.py",
        "tool_version": 1,
        "mode": "READ_ONLY",
        "story": story.get("slug"),
        "section": story.get("section"),
        "language": language,
        "manifest_file": str(manifest_path.relative_to(ROOT)),
        "manifest_sha256": reports[0]["manifest_sha256"],
        "scope": {"all_blocks": True, "block_count": len(blocks)},
        "summary": {
            "overall_textual_result": overall,
            "block_results": {
                status: results.count(status)
                for status in ("PASS", "PASS_SOURCE_ONLY", "REVIEW", "FAIL")
            },
            "structural_failures": sum(
                1 for item in reports
                if item["structural_validation"]["status"] != "PASS"
            ),
            "spoken_pronunciation_result": "NOT_TESTED",
        },
        "blocks": [
            {
                "block_index": index,
                "overall_textual_result": item["overall_textual_result"],
                "structural_validation": item["structural_validation"],
                "block": item["block"],
            }
            for index, item in enumerate(reports)
        ],
        "important_limit": (
            "This report compares written source text only. It cannot establish spoken "
            "pronunciation, pauses, pacing, or audio quality. Manifest text comparisons "
            "are reported as unavailable when the manifest stores only a content hash."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only comparison of Arabic visible story text and audio manifest text."
    )
    parser.add_argument("--story", default=str(DEFAULT_STORY), help="Story JSON path inside the repository.")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Audio manifest path inside the repository.")
    parser.add_argument("--pronunciation", help="Optional audio-pronunciation.json path; defaults beside story.json.")
    parser.add_argument("--language", default="ar", choices=("ar",), help="Language to review (Arabic only in v1).")
    parser.add_argument("--block-index", type=int, default=DEFAULT_BLOCK_INDEX,
                        help="Zero-based story block index; defaults to pilot block 1 / 001.mp3.")
    parser.add_argument("--all-blocks", action="store_true",
                        help="Review every Arabic block in the selected story instead of one block.")
    parser.add_argument("--report", help="Optional path for saving the JSON report; no project input is modified.")
    parser.add_argument("--fail-on-mismatch", action="store_true",
                        help="Exit with status 1 when textual or structural review fails.")
    args = parser.parse_args()

    try:
        story_path = resolve_input(args.story, "Story")
        manifest_path = resolve_input(args.manifest, "Manifest")
        pronunciation_path = (
            resolve_input(args.pronunciation, "Audio pronunciation")
            if args.pronunciation else story_path.with_name("audio-pronunciation.json")
        )
        report = (
            build_all_report(story_path, manifest_path, args.language, pronunciation_path)
            if args.all_blocks
            else build_report(
                story_path, manifest_path, args.language, args.block_index, pronunciation_path
            )
        )
    except ReviewError as exc:
        print(json.dumps({"overall_textual_result": "ERROR", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2

    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        destination = Path(args.report).expanduser()
        if not destination.is_absolute():
            destination = Path.cwd() / destination
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Exclusive creation prevents overwriting either input or any existing file.
            with destination.open("x", encoding="utf-8") as handle:
                handle.write(rendered + "\n")
        except FileExistsError:
            print(f"Refusing to overwrite an existing file: {destination}", file=sys.stderr)
            return 2
        except OSError as exc:
            print(f"Cannot write report: {exc}", file=sys.stderr)
            return 2
        print(f"Report saved to: {destination}")
    else:
        print(rendered)

    if args.fail_on_mismatch and report["overall_textual_result"] not in ("PASS", "PASS_SOURCE_ONLY"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
