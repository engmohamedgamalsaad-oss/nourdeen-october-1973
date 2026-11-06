#!/usr/bin/env python3
"""Read-only inventory of audio assets for published stories and October audio packages.

This command never invokes TTS and never writes, renames, or deletes files.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

LANGUAGES = ("ar", "en", "fr", "it", "de")
ROOT = Path(__file__).resolve().parents[1]


def read_object(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return value


def speakable_blocks(package: dict[str, Any], language: str) -> set[int]:
    i18n = package.get("i18n")
    localized = i18n.get(language) if isinstance(i18n, dict) else None
    blocks = localized.get("blocks") if isinstance(localized, dict) else None
    if not isinstance(blocks, list):
        return set()
    return {
        index for index, block in enumerate(blocks)
        if isinstance(block, dict)
        and block.get("speaker") in ("narrator", "karma")
        and isinstance(block.get("text"), str)
        and block["text"].strip()
    }


def inspect_story(story_path: Path, root: Path) -> dict[str, Any]:
    relative = story_path.relative_to(root)
    if len(relative.parts) == 4 and relative.parts[0] == "stories":
        section = relative.parts[1]
    elif len(relative.parts) == 4 and relative.parts[:2] == ("rebuild", "october-audio-packages"):
        section = "october"
    else:
        raise ValueError(f"{relative}: unsupported story package path")
    package = read_object(story_path)
    slug = str(package.get("slug") or "").strip()
    if package.get("format") != "KHALEDOON_STORY":
        raise ValueError(f"{relative}: unsupported story package format")
    if package.get("section") != section:
        raise ValueError(f"{relative}: package section mismatch")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"{relative}: invalid story slug")

    result: dict[str, Any] = {
        "story": slug,
        "section": section,
        "path": relative.as_posix(),
        "languages": {},
    }
    audio_root = root / "assets" / "audio" / section / slug

    for language in LANGUAGES:
        expected = speakable_blocks(package, language)
        language_dir = audio_root / language
        manifest_path = language_dir / "manifest.json"
        details: dict[str, Any] = {
            "expected_blocks": len(expected),
            "manifest": manifest_path.is_file(),
            "missing_blocks": [],
            "missing_files": [],
            "extra_mp3_files": [],
            "duplicate_blocks": [],
            "unexpected_blocks": [],
            "manifest_errors": [],
        }
        if manifest_path.is_file():
            try:
                manifest = read_object(manifest_path)
                if manifest.get("story") != slug:
                    details["manifest_errors"].append("story slug mismatch")
                if manifest.get("section") != section:
                    details["manifest_errors"].append("section mismatch")
                if manifest.get("language") != language:
                    details["manifest_errors"].append("language mismatch")
                segments = manifest.get("segments")
                if not isinstance(segments, list):
                    segments = []
                    details["manifest_errors"].append("segments is not a list")
                seen: set[int] = set()
                referenced: set[str] = set()
                for segment in segments:
                    if not isinstance(segment, dict):
                        details["manifest_errors"].append("non-object segment")
                        continue
                    index = segment.get("block_index")
                    if not isinstance(index, int) or index < 0:
                        details["manifest_errors"].append("invalid block_index")
                        continue
                    if index in seen:
                        details["duplicate_blocks"].append(index)
                    seen.add(index)
                    src = segment.get("src")
                    if not isinstance(src, str) or Path(src).name != src or not src.endswith(".mp3"):
                        details["manifest_errors"].append(f"invalid src for block {index}")
                        continue
                    referenced.add(src)
                    if not (language_dir / src).is_file():
                        details["missing_files"].append(src)
                details["missing_blocks"] = sorted(expected - seen)
                details["unexpected_blocks"] = sorted(seen - expected)
                details["extra_mp3_files"] = sorted(
                    path.name for path in language_dir.glob("*.mp3")
                    if path.name not in referenced
                )
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                details["manifest_errors"].append(str(exc))
        else:
            details["missing_blocks"] = sorted(expected)
            details["missing_files"] = []
            details["extra_mp3_files"] = sorted(path.name for path in language_dir.glob("*.mp3"))
            details["unexpected_blocks"] = []

        details["status"] = (
            "complete"
            if details["manifest"]
            and not details["missing_blocks"]
            and not details["missing_files"]
            and not details["duplicate_blocks"]
            and not details["manifest_errors"]
            and not details["unexpected_blocks"]
            else "incomplete"
        )
        result["languages"][language] = details

    result["status"] = (
        "complete"
        if all(item["status"] == "complete" for item in result["languages"].values())
        else "incomplete"
    )
    return result


def audit(root: Path) -> dict[str, Any]:
    stories_root = root / "stories"
    records: list[dict[str, Any]] = []
    october_packages = root / "rebuild" / "october-audio-packages"
    candidates = list(stories_root.glob("*/*/story.json"))
    candidates.extend(october_packages.glob("*/story.json"))
    published_count = 0
    published_non_october_count = 0
    october_count = 0
    for story_path in sorted(set(candidates)):
        relative = story_path.relative_to(root)
        try:
            if relative.parts[0] == "stories":
                data_path = story_path.with_name("data.json")
                if not data_path.is_file() or read_object(data_path).get("published") is not True:
                    continue
                published_count += 1
                if relative.parts[1] != "october":
                    published_non_october_count += 1
            elif relative.parts[:2] == ("rebuild", "october-audio-packages"):
                readiness_path = story_path.with_name("audio-readiness.json")
                readiness = read_object(readiness_path) if readiness_path.is_file() else {}
                if readiness.get("format") != "KHALEDOON_OCTOBER_AUDIO_READINESS_V1":
                    raise ValueError(f"{relative}: missing or invalid audio readiness report")
                if readiness.get("ready") is not True:
                    raise ValueError(f"{relative}: October package is not ready in all five languages")
                october_count += 1
            else:
                continue
            records.append(inspect_story(story_path, root))
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            records.append({
                "path": relative.as_posix(),
                "status": "error",
                "error": str(exc),
            })

    return {
        "mode": "read-only",
        "tts_requests": 0,
        "files_modified": 0,
        "october_stories_skipped": 0,
        "published_stories": published_count,
        "published_non_october_stories": published_non_october_count,
        "october_audio_packages": october_count,
        "stories_included": len(records),
        "complete_stories": sum(item.get("status") == "complete" for item in records),
        "incomplete_stories": sum(item.get("status") != "complete" for item in records),
        "stories": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Inventory published story audio and October audio packages without changing files."
    )
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()
    report = audit(args.root.resolve())
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(
            f"READ-ONLY | published_stories={report.get('published_stories', 0)} "
            f"complete={report['complete_stories']} "
            f"incomplete={report['incomplete_stories']} "
            f"october_audio_packages={report.get('october_audio_packages', 0)} "
            f"tts_requests=0 files_modified=0"
        )
        for story in report["stories"]:
            print(f"{story.get('status', 'error').upper()} {story.get('path')}")
            for language, details in story.get("languages", {}).items():
                if details["status"] != "complete":
                    print(
                        f"  {language}: missing_blocks={details['missing_blocks']} "
                        f"missing_files={details['missing_files']} "
                        f"errors={details['manifest_errors']}"
                    )
    return 1 if report["incomplete_stories"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
