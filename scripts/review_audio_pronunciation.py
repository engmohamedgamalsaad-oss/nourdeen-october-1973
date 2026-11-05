#!/usr/bin/env python3
"""Read-only ASR review of generated story clips using local faster-whisper."""
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
LANGUAGES = ("ar", "en", "fr", "it", "de")
LOW_WORD_CONFIDENCE = 0.45


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return value


def normalize_token(value: str, language: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = "".join(
        char for char in value
        if unicodedata.category(char) not in ("Mn", "Me", "Cf")
    )
    if language == "ar":
        value = value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        value = value.replace("ى", "ي")
    return re.sub(r"[^\w\u0600-\u06ff]+", "", value, flags=re.UNICODE)


def tokenize(value: str, language: str) -> list[str]:
    return [
        token for token in (normalize_token(part, language) for part in re.findall(r"\S+", value))
        if token
    ]


def compare_transcript(
    expected_text: str,
    recognized_words: list[dict[str, Any]],
    language: str,
    detected_language: str,
    language_probability: float,
) -> dict[str, Any]:
    expected = tokenize(expected_text, language)
    actual = [
        normalize_token(str(item.get("word") or ""), language)
        for item in recognized_words
    ]
    actual_indexes = [index for index, token in enumerate(actual) if token]
    actual = [actual[index] for index in actual_indexes]
    words = [recognized_words[index] for index in actual_indexes]

    matcher = difflib.SequenceMatcher(a=expected, b=actual, autojunk=False)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    denominator = max(len(expected), len(actual), 1)
    mismatch_details: list[dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        actual_items = words[j1:j2]
        mismatch_details.append({
            "type": tag,
            "expected": expected[i1:i2],
            "recognized": [str(item.get("word") or "").strip() for item in actual_items],
            "start": min((float(item.get("start", 0)) for item in actual_items), default=None),
            "end": max((float(item.get("end", 0)) for item in actual_items), default=None),
        })

    low_confidence = [
        {
            "word": str(item.get("word") or "").strip(),
            "start": float(item.get("start", 0)),
            "end": float(item.get("end", 0)),
            "probability": float(item.get("probability", 0)),
        }
        for item in words
        if float(item.get("probability", 1)) < LOW_WORD_CONFIDENCE
    ]
    ratio = matched / denominator
    language_mismatch = bool(detected_language and detected_language != language)
    language_detection_uncertain = float(language_probability) < 0.60
    return {
        "expected_word_count": len(expected),
        "recognized_word_count": len(actual),
        "match_ratio": round(ratio, 4),
        "detected_language": detected_language,
        "language_probability": round(float(language_probability), 4),
        "language_mismatch": language_mismatch,
        "language_detection_uncertain": language_detection_uncertain,
        "mismatches": mismatch_details,
        "low_confidence_words": low_confidence,
        "status": (
            "review_required"
            if mismatch_details or low_confidence or language_mismatch or language_detection_uncertain or ratio < 0.92
            else "likely_match"
        ),
        "needs_human_review": True,
    }


def transcribe_clip(
    model: Any,
    audio_path: Path,
    language: str,
) -> dict[str, Any]:
    segments, info = model.transcribe(
        str(audio_path),
        language=None,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    recognized_segments = list(segments)
    recognized_words: list[dict[str, Any]] = []
    transcript_parts: list[str] = []
    for segment in recognized_segments:
        transcript_parts.append(str(getattr(segment, "text", "") or "").strip())
        for word in getattr(segment, "words", None) or []:
            recognized_words.append({
                "word": str(getattr(word, "word", "") or ""),
                "start": float(getattr(word, "start", 0)),
                "end": float(getattr(word, "end", 0)),
                "probability": float(getattr(word, "probability", 0)),
            })
    return {
        "transcript": " ".join(part for part in transcript_parts if part),
        "words": recognized_words,
        "detected_language": str(getattr(info, "language", "") or ""),
        "language_probability": float(getattr(info, "language_probability", 0)),
    }


def expected_text_for_segment(
    segment: dict[str, Any],
    block_counts: dict[int, int],
    blocks: list[Any],
    language: str,
    pronunciation_blocks: dict[str, Any],
) -> str | None:
    text = segment.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    index = segment.get("block_index")
    if not isinstance(index, int) or index < 0 or index >= len(blocks):
        return None
    if block_counts.get(index) != 1:
        return None
    if language == "ar" and isinstance(pronunciation_blocks.get(str(index)), str):
        return str(pronunciation_blocks[str(index)]).strip()
    block = blocks[index]
    if isinstance(block, dict) and isinstance(block.get("text"), str):
        return block["text"].strip()
    return None


def review_story_audio(
    story_path: Path,
    language: str,
    audio_root: Path,
    model: Any,
    max_clips: int = 0,
    block_indexes: tuple[int, ...] | None = None,
) -> dict[str, Any]:
    story_path = story_path.resolve()
    relative = story_path.relative_to(ROOT)
    if story_path.name != "story.json" or len(relative.parts) != 4 or relative.parts[0] != "stories":
        raise ValueError(f"Expected stories/<section>/<id>/story.json, got {relative}")
    section = relative.parts[1]
    if section == "october":
        raise ValueError("October is excluded from audio review.")
    package = read_json(story_path)
    slug = str(package.get("slug") or "").strip()
    if package.get("format") != "KHALEDOON_STORY" or package.get("section") != section:
        raise ValueError(f"Invalid story package format or section: {relative}")
    localized = package.get("i18n", {}).get(language)
    blocks = localized.get("blocks") if isinstance(localized, dict) else None
    if not isinstance(blocks, list):
        raise ValueError(f"{relative}: missing {language} story blocks")

    language_dir = audio_root / section / slug / language
    manifest_path = language_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Audio manifest not found: {manifest_path}")
    manifest = read_json(manifest_path)
    if (
        manifest.get("story") != slug
        or manifest.get("section") != section
        or manifest.get("language") != language
    ):
        raise ValueError(f"{manifest_path}: manifest identity mismatch")
    segments = manifest.get("segments")
    if not isinstance(segments, list):
        raise ValueError(f"{manifest_path}: segments must be a list")
    selected_blocks = None if block_indexes is None else set(block_indexes)
    if selected_blocks is not None:
        if any(not isinstance(index, int) or index < 0 or index >= len(blocks) for index in selected_blocks):
            raise ValueError(f"Invalid selected block indexes: {sorted(selected_blocks)}")
        if any(
            not isinstance(blocks[index], dict)
            or blocks[index].get("speaker") not in ("narrator", "karma")
            for index in selected_blocks
        ):
            raise ValueError("Selected blocks must be speakable narrator/karma blocks.")
        segments = [
            item for item in segments
            if isinstance(item, dict) and item.get("block_index") in selected_blocks
        ]

    counts: dict[int, int] = {}
    for item in segments:
        if isinstance(item, dict) and isinstance(item.get("block_index"), int):
            counts[item["block_index"]] = counts.get(item["block_index"], 0) + 1
    pronunciation_blocks: dict[str, Any] = {}
    pronunciation_path = story_path.with_name("audio-pronunciation.json")
    if language == "ar" and pronunciation_path.is_file():
        pronunciation = read_json(pronunciation_path)
        if pronunciation.get("story") != slug or pronunciation.get("language") != "ar":
            raise ValueError(f"{pronunciation_path}: story/language mismatch")
        raw_blocks = pronunciation.get("blocks")
        approved = pronunciation.get("approved_audio_only_rewrites", [])
        if not isinstance(raw_blocks, dict) or not isinstance(approved, list):
            raise ValueError(f"{pronunciation_path}: invalid blocks or approved rewrite list")
        approved_indexes = {str(index) for index in approved}
        if any(not index.isdigit() or str(int(index)) != index or index not in raw_blocks for index in approved_indexes):
            raise ValueError(f"{pronunciation_path}: approved rewrite references an invalid block")
        pronunciation_blocks = {
            index: raw_blocks[index]
            for index in approved_indexes
            if isinstance(raw_blocks[index], str) and raw_blocks[index].strip()
        }

    expected_by_block: dict[int, str] = {}
    for index, block in enumerate(blocks):
        if selected_blocks is not None and index not in selected_blocks:
            continue
        if not isinstance(block, dict) or block.get("speaker") not in ("narrator", "karma"):
            continue
        original = str(block.get("text") or "").strip()
        if language == "ar" and str(index) in pronunciation_blocks:
            original = str(pronunciation_blocks[str(index)]).strip()
        if original:
            expected_by_block[index] = original

    grouped: dict[int, list[dict[str, Any]]] = {}
    for item in segments:
        if isinstance(item, dict) and isinstance(item.get("block_index"), int):
            grouped.setdefault(item["block_index"], []).append(item)
    block_text_status: dict[int, str] = {}
    for index, group in grouped.items():
        expected_block = expected_by_block.get(index)
        if not expected_block:
            block_text_status[index] = "expected_text_unavailable"
            continue
        ordered = sorted(group, key=lambda item: int(item.get("chunk_index", 0)))
        chunk_texts = [item.get("text") for item in ordered]
        if all(isinstance(value, str) and value.strip() for value in chunk_texts):
            joined = re.sub(r"\s+", " ", " ".join(value.strip() for value in chunk_texts)).strip()
            expected_normalized = re.sub(r"\s+", " ", expected_block).strip()
            if joined != expected_normalized:
                block_text_status[index] = "manifest_text_mismatch"
        elif len(ordered) > 1:
            block_text_status[index] = "expected_text_unavailable"

    reports: list[dict[str, Any]] = []
    for item in segments:
        if not isinstance(item, dict):
            continue
        block_index = item.get("block_index")
        if (
            not isinstance(block_index, int)
            or block_index < 0
            or block_index >= len(blocks)
            or not isinstance(blocks[block_index], dict)
            or blocks[block_index].get("speaker") != item.get("speaker")
        ):
            reports.append({
                "block_index": block_index,
                "status": "manifest_block_mismatch",
                "needs_human_review": True,
            })
            continue
        filename = item.get("src")
        if not isinstance(filename, str) or Path(filename).name != filename or not filename.endswith(".mp3"):
            reports.append({"status": "invalid_manifest_path", "needs_human_review": True})
            continue
        audio_path = language_dir / filename
        try:
            audio_path.resolve().relative_to(language_dir.resolve())
        except ValueError:
            reports.append({"src": filename, "status": "invalid_audio_path", "needs_human_review": True})
            continue
        if not audio_path.is_file():
            reports.append({"src": filename, "status": "missing_audio", "needs_human_review": True})
            continue
        actual_hash = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        expected_hash = item.get("audio_sha256")
        if not isinstance(expected_hash, str) or not expected_hash.strip():
            reports.append({
                "src": filename,
                "status": "audio_hash_missing",
                "needs_human_review": True,
                "audio_sha256": actual_hash,
            })
            continue
        if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_hash):
            reports.append({
                "src": filename,
                "status": "audio_hash_invalid",
                "needs_human_review": True,
                "audio_sha256": actual_hash,
            })
            continue
        if actual_hash != expected_hash.lower():
            reports.append({
                "src": filename,
                "status": "audio_hash_mismatch",
                "needs_human_review": True,
                "audio_sha256": actual_hash,
            })
            continue
        block_status = block_text_status.get(block_index)
        if block_status:
            reports.append({
                "src": filename,
                "block_index": block_index,
                "status": block_status,
                "needs_human_review": True,
            })
            continue
        expected_text = expected_text_for_segment(
            item, counts, blocks, language, pronunciation_blocks
        )
        if not expected_text:
            reports.append({
                "src": filename,
                "status": "expected_text_unavailable",
                "needs_human_review": True,
                "audio_sha256": actual_hash,
            })
            continue
        transcription = transcribe_clip(model, audio_path, language)
        comparison = compare_transcript(
            expected_text,
            transcription["words"],
            language,
            transcription["detected_language"],
            transcription["language_probability"],
        )
        reports.append({
            "src": filename,
            "block_index": item.get("block_index"),
            "chunk_index": item.get("chunk_index", 0),
            "speaker": item.get("speaker"),
            "expected_text": expected_text,
            "transcript": transcription["transcript"],
            "words": transcription["words"],
            "audio_sha256": actual_hash,
            **comparison,
        })
        if max_clips and len(reports) >= max_clips:
            break

    missing_blocks = sorted(set(expected_by_block) - set(counts))
    return {
        "format": "KHALEDOON_AUDIO_PRONUNCIATION_REVIEW_V1",
        "story": slug,
        "section": section,
        "language": language,
        "selected_blocks": sorted(selected_blocks) if selected_blocks is not None else None,
        "model": "faster-whisper",
        "tts_requests": 0,
        "audio_files_modified": 0,
        "missing_blocks": missing_blocks,
        "reports": reports,
        "summary": {
            "total": len(reports),
            "likely_match": sum(item.get("status") == "likely_match" for item in reports),
            "review_required": sum(item.get("status") == "review_required" for item in reports),
            "other": sum(item.get("status") not in ("likely_match", "review_required") for item in reports),
            "missing_blocks": len(missing_blocks),
            "human_review_required": True,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only local ASR review of one story/language. No TTS or file mutation."
    )
    parser.add_argument("--story", type=Path, required=True)
    parser.add_argument("--language", choices=LANGUAGES, required=True)
    parser.add_argument(
        "--audio-root",
        type=Path,
        default=ROOT / "assets" / "audio",
        help="Audio root containing <section>/<slug>/<language>; use .audio-staging for staged audio.",
    )
    parser.add_argument("--model", default="small", choices=("base", "small", "medium", "large-v3"))
    parser.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--max-clips", type=int, default=0)
    parser.add_argument(
        "--block-index",
        type=int,
        action="append",
        help="Review only this zero-based block index; may be repeated.",
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    story = args.story if args.story.is_absolute() else ROOT / args.story
    audio_root = args.audio_root if args.audio_root.is_absolute() else ROOT / args.audio_root
    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    report = review_story_audio(
        story, args.language, audio_root, model, args.max_clips,
        tuple(args.block_index) if args.block_index is not None else None,
    )
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        output = args.output if args.output.is_absolute() else ROOT / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 1 if report["summary"]["other"] or report["summary"]["missing_blocks"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
