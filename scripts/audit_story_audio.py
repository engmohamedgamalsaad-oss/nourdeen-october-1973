#!/usr/bin/env python3
"""Read-only inventory and text-integrity audit for all Khaledoon story audio.

This tool never calls a TTS/ASR provider and never modifies story, manifest, or
audio files. It checks repository coverage, manifest structure, referenced MP3
files, and whether submitted/manifest text preserves the visible story words.
It cannot verify what the recorded voice actually said.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("ar", "en", "fr", "it", "de")
sys.path.insert(0, str(ROOT / "scripts"))
import review_pronunciation as arabic_review  # noqa: E402


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def tokens(text: str, language: str) -> list[str]:
    if language == "ar":
        return arabic_review.tokenize(text)
    return re.findall(r"[^\W_]+", text.casefold(), flags=re.UNICODE)


def compare_text(visible: str, submitted: str, language: str) -> str:
    before = tokens(visible, language)
    after = tokens(submitted, language)
    if before == after:
        return "PASS"
    if language == "ar" and arabic_review.is_number_form_only_difference(before, after):
        return "REVIEW_NUMBER_FORM"
    return "FAIL_WORD_IDENTITY_OR_ORDER"


def safe_audio_file(language_dir: Path, source: str) -> Path | None:
    if not isinstance(source, str) or not source.strip():
        return None
    candidate = (language_dir / source).resolve()
    try:
        candidate.relative_to(language_dir.resolve())
    except ValueError:
        return None
    return candidate


def audit_language(story_path: Path, package: dict[str, Any], language: str) -> dict[str, Any]:
    section = str(package.get("section") or "")
    slug = str(package.get("slug") or "")
    localized = package.get("i18n", {}).get(language, {})
    blocks = localized.get("blocks") if isinstance(localized, dict) else None
    if not isinstance(blocks, list):
        return {"language": language, "status": "MISSING_STORY_TRANSLATION"}

    language_dir = ROOT / "assets" / "audio" / section / slug / language
    manifest_path = language_dir / "manifest.json"
    if not manifest_path.is_file():
        return {
            "language": language,
            "status": "NO_AUDIO",
            "expected_speakable_blocks": sum(
                1 for b in blocks if isinstance(b, dict)
                and b.get("speaker") in ("karma", "narrator")
                and str(b.get("text") or "").strip()
            ),
        }

    try:
        manifest = read_json(manifest_path)
    except ValueError as exc:
        return {"language": language, "status": "INVALID_MANIFEST", "error": str(exc)}

    errors: list[str] = []
    if manifest.get("story") != slug:
        errors.append("manifest story does not match story package")
    if manifest.get("section") != section:
        errors.append("manifest section does not match story package")
    if manifest.get("language") != language:
        errors.append("manifest language does not match directory")

    pronunciation_path = story_path.with_name("audio-pronunciation.json")
    pronunciation: dict[str, Any] = {}
    if language == "ar" and pronunciation_path.is_file():
        try:
            pronunciation = read_json(pronunciation_path)
        except ValueError as exc:
            errors.append(str(exc))
    pronunciation_blocks = pronunciation.get("blocks", {})
    if not isinstance(pronunciation_blocks, dict):
        errors.append("audio-pronunciation blocks must be an object")
        pronunciation_blocks = {}

    grouped: dict[int, list[dict[str, Any]]] = {}
    seen: set[tuple[int, int]] = set()
    missing_files: list[str] = []
    invalid_sources: list[str] = []
    for segment in manifest.get("segments", []) if isinstance(manifest.get("segments"), list) else []:
        if not isinstance(segment, dict):
            errors.append("manifest contains a non-object segment")
            continue
        try:
            block_index = int(segment["block_index"])
            chunk_index = int(segment.get("chunk_index", 0))
        except (KeyError, TypeError, ValueError):
            errors.append("segment has an invalid block_index/chunk_index")
            continue
        key = (block_index, chunk_index)
        if key in seen:
            errors.append(f"duplicate segment index {key}")
        seen.add(key)
        grouped.setdefault(block_index, []).append(segment)
        audio_file = safe_audio_file(language_dir, segment.get("src"))
        if audio_file is None:
            invalid_sources.append(str(segment.get("src")))
        elif not audio_file.is_file() or audio_file.stat().st_size < 512:
            missing_files.append(str(segment.get("src")))

    block_results: list[dict[str, Any]] = []
    expected_indices: set[int] = set()
    for index, block in enumerate(blocks):
        if not isinstance(block, dict) or block.get("speaker") not in ("karma", "narrator"):
            continue
        visible = str(block.get("text") or "").strip()
        if not visible:
            continue
        expected_indices.add(index)
        candidate = pronunciation_blocks.get(str(index), visible) if language == "ar" else visible
        source_result = compare_text(visible, str(candidate), language)
        segments = sorted(grouped.get(index, []), key=lambda item: int(item.get("chunk_index", 0)))
        if not segments:
            manifest_result = "MISSING_SEGMENT"
            manifest_text = ""
        else:
            manifest_text = " ".join(str(item.get("text") or "") for item in segments).strip()
            manifest_result = compare_text(str(candidate), manifest_text, language)
        block_results.append({
            "block_index": index,
            "speaker": block.get("speaker"),
            "chunk_count": len(segments),
            "visible_vs_submitted": source_result,
            "submitted_vs_manifest": manifest_result,
        })

    unexpected_indices = sorted(set(grouped) - expected_indices)
    missing_indices = sorted(expected_indices - set(grouped))
    statuses = [r["visible_vs_submitted"] for r in block_results]
    manifest_statuses = [r["submitted_vs_manifest"] for r in block_results]
    if errors or missing_files or invalid_sources or unexpected_indices or missing_indices:
        status = "STRUCTURAL_ISSUES"
    elif "FAIL_WORD_IDENTITY_OR_ORDER" in statuses or "FAIL_WORD_IDENTITY_OR_ORDER" in manifest_statuses:
        status = "TEXT_MISMATCH"
    elif "REVIEW_NUMBER_FORM" in statuses or "REVIEW_NUMBER_FORM" in manifest_statuses:
        status = "HUMAN_REVIEW_REQUIRED"
    else:
        status = "TEXT_MATCH"

    return {
        "language": language,
        "status": status,
        "manifest_segments": len(manifest.get("segments", [])) if isinstance(manifest.get("segments"), list) else 0,
        "expected_speakable_blocks": len(expected_indices),
        "covered_blocks": len(grouped),
        "missing_blocks": missing_indices,
        "unexpected_blocks": unexpected_indices,
        "missing_or_invalid_mp3": missing_files,
        "unsafe_mp3_paths": invalid_sources,
        "manifest_errors": errors,
        "blocks": block_results,
        "spoken_pronunciation": "NOT_TESTED",
    }


def audit_repository(root: Path = ROOT) -> dict[str, Any]:
    stories_root = root / "stories"
    story_paths = sorted(stories_root.glob("*/*/story.json"))
    results: list[dict[str, Any]] = []
    for story_path in story_paths:
        try:
            package = read_json(story_path)
        except ValueError as exc:
            results.append({"story_path": str(story_path.relative_to(root)), "status": "INVALID_STORY", "error": str(exc)})
            continue
        if package.get("section") == "october":
            continue
        languages = package.get("i18n", {})
        story_result = {
            "story_path": str(story_path.relative_to(root)),
            "slug": package.get("slug"),
            "section": package.get("section"),
            "languages": {},
        }
        for language in LANGUAGES:
            if isinstance(languages, dict) and language in languages:
                story_result["languages"][language] = audit_language(story_path, package, language)
        results.append(story_result)

    language_statuses: dict[str, dict[str, int]] = {}
    for story in results:
        for language, result in story.get("languages", {}).items():
            counts = language_statuses.setdefault(language, {})
            status = result["status"]
            counts[status] = counts.get(status, 0) + 1
    return {
        "schema": "KHALEDOON_AUDIO_AUDIT_V1",
        "read_only": True,
        "tts_requests_sent": 0,
        "asr_requests_sent": 0,
        "spoken_pronunciation": "NOT_TESTED",
        "story_count": len(results),
        "language_status_counts": language_statuses,
        "stories": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only audit of all Khaledoon story audio.")
    parser.add_argument("--output", help="Optional new JSON report path; existing files are never overwritten.")
    args = parser.parse_args()
    report = audit_repository()
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        destination = Path(args.output).expanduser()
        if not destination.is_absolute():
            destination = Path.cwd() / destination
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("x", encoding="utf-8") as handle:
                handle.write(rendered + "\n")
        except FileExistsError:
            print(f"Refusing to overwrite existing report: {destination}", file=sys.stderr)
            return 2
        except OSError as exc:
            print(f"Cannot write report: {exc}", file=sys.stderr)
            return 2
        print(f"Report saved: {destination}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
