#!/usr/bin/env python3
"""Plan or stage per-speaker audio for published story packages across all sections.

October page content is extracted without changing its published HTML/CSS into
rebuild/october-audio-packages/<id>/ (story.json + audio-readiness.json). Those
packages then use the same planning, approval, generation, and review pipeline.

Planning is read-only. Generation requires an explicit flag and writes only to
.gitignored .audio-staging; it never writes to the published audio tree.
Fish Audio additionally requires a separate explicit approval flag. October uses the
same five-language human audio-text approval record as every other section.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
STAGING_ROOT = ROOT / ".audio-staging"
OCTOBER_PACKAGES_DIR = ("rebuild", "october-audio-packages")
OCTOBER_READINESS_FORMAT = "KHALEDOON_OCTOBER_AUDIO_READINESS_V1"
LANGUAGES = ("ar", "en", "fr", "it", "de")
GENERATOR_VERSION = "4"
ARABIC_AUDIO_TEXT_VERSION = "story-specific-contextual-pronunciation-v1"
FISH_AUDIO_KARMA_VOICE_ID = "592625f68416462f8b6161ddf5fdbffb"
FISH_AUDIO_NARRATOR_VOICE_ID = "a02a8220d6014812aa5ff73434c54cc0"  # owner-approved final narrator voice
FISH_AUDIO_MODEL = "s2.1-pro-free"
VOICE_SETTINGS = {
    "ar": {
        "karma": ("ar-EG-SalmaNeural", "+0%", "+8Hz"),
        "narrator": ("ar-EG-ShakirNeural", "-2%", "+0Hz"),
    },
    "en": {
        "karma": ("en-US-JennyNeural", "+0%", "+8Hz"),
        "narrator": ("en-US-DavisNeural", "-2%", "+0Hz"),
    },
    "fr": {
        "karma": ("fr-FR-EloiseNeural", "+0%", "+8Hz"),
        "narrator": ("fr-FR-HenriNeural", "-2%", "+0Hz"),
    },
    "it": {
        "karma": ("it-IT-ElsaNeural", "+0%", "+8Hz"),
        "narrator": ("it-IT-DiegoNeural", "-2%", "+0Hz"),
    },
    "de": {
        "karma": ("de-DE-KatjaNeural", "+0%", "+8Hz"),
        "narrator": ("de-DE-ConradNeural", "-2%", "+0Hz"),
    },
}

VOICE_FALLBACKS = {
    "en": {
        "narrator": ("en-US-JasonNeural", "en-US-GuyNeural"),
    },
}


class OctoberPackageNotReady(ValueError):
    """An October audio package exists but is not complete in all five languages."""


class AudioTextApprovalRequired(ValueError):
    """A story is valid but cannot proceed until its shared human review is approved."""


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def locate_story(story_path: Path) -> tuple[Path, str, bool]:
    """Return (path relative to ROOT, section, is_october_package).

    Every section uses stories/<section>/<id>/story.json. October source packages
    live beside their published page and require the same human review plus the
    five-language source-readiness check; published HTML is never rewritten here.
    """
    story_path = story_path.resolve()
    try:
        relative = story_path.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError(f"Story path must be inside the repository: {story_path}") from exc
    parts = relative.parts
    if story_path.name == "story.json" and len(parts) == 4 and parts[0] == "stories":
        return relative, parts[1], parts[1] == "october"
    raise ValueError(f"Expected stories/<section>/<id>/story.json, got {relative}")


def require_october_readiness(story_path: Path, package: dict[str, Any]) -> None:
    """October packages are planned/generated only when complete in all five languages."""
    readiness_path = story_path.with_name("audio-readiness.json")
    relative = readiness_path.relative_to(ROOT) if readiness_path.is_absolute() and ROOT in readiness_path.parents else readiness_path
    if not readiness_path.is_file():
        raise OctoberPackageNotReady(f"{relative}: audio-readiness.json is missing")
    readiness = read_json(readiness_path)
    if readiness.get("format") != OCTOBER_READINESS_FORMAT or readiness.get("story") != package.get("slug"):
        raise OctoberPackageNotReady(f"{relative}: readiness record does not match this package")
    if readiness.get("ready") is not True:
        raise OctoberPackageNotReady(
            f"{relative}: package is not ready (missing or untranslated blocks); "
            "audio planning is blocked until all five languages are complete"
        )


def approved_pronunciation_blocks(
    pronunciation: dict[str, Any],
    slug: str,
    pronunciation_path: Path,
) -> dict[str, str]:
    if not pronunciation:
        return {}
    if pronunciation.get("story") != slug or pronunciation.get("language") != "ar":
        raise ValueError(f"{pronunciation_path}: story/language metadata mismatch")
    raw_blocks = pronunciation.get("blocks")
    approved = pronunciation.get("approved_audio_only_rewrites", [])
    if not isinstance(raw_blocks, dict) or not isinstance(approved, list):
        raise ValueError(f"{pronunciation_path}: invalid blocks or approved rewrite list")
    approved_indexes = {str(index) for index in approved}
    if any(not index.isdigit() or str(int(index)) != index or index not in raw_blocks for index in approved_indexes):
        raise ValueError(f"{pronunciation_path}: approved rewrite references a missing or invalid block")
    if any(
        not isinstance(raw_blocks[index], str) or not raw_blocks[index].strip()
        for index in approved_indexes
    ):
        raise ValueError(f"{pronunciation_path}: approved rewrite text must be a non-empty string")
    return {index: raw_blocks[index] for index in approved_indexes}


def validate_required_audio_text_review(
    pronunciation: dict[str, Any],
    package: dict[str, Any],
    pronunciation_path: Path,
) -> dict[str, dict[str, str]]:
    """Require a human-approved, complete five-language speech-text review for new stories."""
    slug = str(package.get("slug") or "").strip()
    if pronunciation.get("format") != "KHALEDOON_AUDIO_PRONUNCIATION_V1":
        raise ValueError(f"{pronunciation_path}: missing approved audio-pronunciation format")
    if pronunciation.get("story") != slug or pronunciation.get("section") != package.get("section"):
        raise ValueError(f"{pronunciation_path}: story/section metadata mismatch")
    review = pronunciation.get("review")
    if not isinstance(review, dict) or review.get("format") != "KHALEDOON_AUDIO_TEXT_REVIEW_APPROVAL_V1":
        raise ValueError(f"{pronunciation_path}: complete admin review record is missing")
    if review.get("status") != "approved_by_admin" or review.get("languages") != list(LANGUAGES):
        raise ValueError(f"{pronunciation_path}: five-language admin approval is incomplete")
    raw_segments = review.get("segments")
    translations = package.get("i18n")
    if not isinstance(raw_segments, list) or not isinstance(translations, dict):
        raise ValueError(f"{pronunciation_path}: invalid review segments or story translations")
    expected: dict[tuple[str, int], tuple[str, str]] = {}
    for lang in LANGUAGES:
        localized = translations.get(lang)
        blocks = localized.get("blocks") if isinstance(localized, dict) else None
        if not isinstance(blocks, list) or not blocks:
            raise ValueError(f"{pronunciation_path}: story is missing {lang} blocks")
        for index, block in enumerate(blocks):
            if not isinstance(block, dict) or block.get("speaker") not in ("narrator", "karma"):
                continue
            source = str(block.get("text") or "").strip()
            if source:
                expected[(lang, index)] = (str(block["speaker"]), source)
    if review.get("total_segments") != len(expected) or len(raw_segments) != len(expected):
        raise ValueError(f"{pronunciation_path}: review does not cover every spoken block in all five languages")
    seen: set[tuple[str, int]] = set()
    rewrites: dict[str, dict[str, str]] = {lang: {} for lang in LANGUAGES}
    for item in raw_segments:
        if not isinstance(item, dict):
            raise ValueError(f"{pronunciation_path}: invalid review segment")
        lang = item.get("lang")
        index = item.get("block_index")
        if lang not in LANGUAGES or not isinstance(index, int) or isinstance(index, bool):
            raise ValueError(f"{pronunciation_path}: invalid review language or block index")
        key = (lang, index)
        if key in seen or key not in expected:
            raise ValueError(f"{pronunciation_path}: duplicate or unknown review segment {key}")
        seen.add(key)
        speaker, source = expected[key]
        spoken = item.get("approved_audio_text")
        decision = item.get("decision")
        if item.get("speaker") != speaker or item.get("source_text") != source:
            raise ValueError(f"{pronunciation_path}: source text/speaker changed for {lang} block {index}")
        if not isinstance(spoken, str) or not spoken.strip():
            raise ValueError(f"{pronunciation_path}: empty approved text for {lang} block {index}")
        if decision == "approved_original":
            if spoken != source:
                raise ValueError(f"{pronunciation_path}: original decision changed text for {lang} block {index}")
        elif decision == "approved_rewrite":
            if spoken == source:
                raise ValueError(f"{pronunciation_path}: rewrite decision has no rewrite for {lang} block {index}")
            rewrites[lang][str(index)] = spoken
        else:
            raise ValueError(f"{pronunciation_path}: segment lacks explicit human approval for {lang} block {index}")
    if seen != set(expected):
        raise ValueError(f"{pronunciation_path}: some spoken blocks were not approved")
    declared = pronunciation.get("approved_audio_text_rewrites")
    if not isinstance(declared, dict):
        raise ValueError(f"{pronunciation_path}: approved multilingual rewrites are missing")
    for lang in LANGUAGES:
        if declared.get(lang) != rewrites[lang]:
            raise ValueError(f"{pronunciation_path}: approved {lang} rewrites do not match human decisions")
    arabic_indexes = sorted(rewrites["ar"], key=int)
    if pronunciation.get("blocks") != rewrites["ar"] or pronunciation.get("approved_audio_only_rewrites") != arabic_indexes:
        raise ValueError(f"{pronunciation_path}: Arabic compatibility fields do not match approved decisions")
    return rewrites


def text_hash(text: str, voice: str, rate: str, pitch: str, lang: str) -> str:
    fields = [GENERATOR_VERSION, lang, text, voice, rate, pitch]
    if lang == "ar":
        fields.insert(1, ARABIC_AUDIO_TEXT_VERSION)
    payload = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def prepare_arabic_audio_text(text: str, reviewed_audio_text: str | None = None) -> str:
    """Use a reviewed, story-specific pronunciation script for audio only."""
    candidate = reviewed_audio_text if isinstance(reviewed_audio_text, str) else text
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if not candidate:
        raise ValueError("Arabic audio pronunciation text must not be empty")
    return candidate

def split_audio_chunks(text: str, max_chars: int = 440) -> list[str]:
    """Split only at sentence/word boundaries; never cut through a word."""
    if len(text) <= max_chars:
        return [text]

    sentences = [part.strip() for part in re.split(r"(?<=[.!?؟؛])\s+", text) if part.strip()]
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        pieces = [sentence]
        if len(sentence) > max_chars:
            words = sentence.split()
            pieces = []
            piece = ""
            for word in words:
                candidate = f"{piece} {word}".strip()
                if piece and len(candidate) > max_chars:
                    pieces.append(piece)
                    piece = word
                else:
                    piece = candidate
            if piece:
                pieces.append(piece)

        for piece in pieces:
            candidate = f"{current} {piece}".strip()
            if current and len(candidate) > max_chars:
                chunks.append(current)
                current = piece
            else:
                current = candidate

    if current:
        chunks.append(current)
    return chunks or [text]


async def synthesize(
    text: str, voice: str, rate: str, pitch: str, destination: Path
) -> None:
    """Make one Edge TTS request; surface failures without automatic resubmission."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".partial.mp3")
    try:
        communicator = edge_tts.Communicate(
            text, voice, rate=rate, pitch=pitch
        )
        await asyncio.wait_for(communicator.save(str(temporary)), timeout=35)
        if not temporary.is_file() or temporary.stat().st_size < 512:
            raise RuntimeError("TTS returned an empty or invalid MP3 file")
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


async def synthesize_fish_audio(
    text: str, destination: Path, voice_id: str
) -> None:
    """Make exactly one Fish Audio request; never retry ambiguously."""
    api_key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "FISH_AUDIO_API_KEY is missing. Add it in GitHub Settings > Secrets and variables > Actions."
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".partial.mp3")
    payload = json.dumps({
        "text": text,
        "reference_id": voice_id,
        "format": "mp3",
    }, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        "https://api.fish.audio/v1/tts",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "model": FISH_AUDIO_MODEL,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            audio = response.read()
        if len(audio) < 512:
            raise RuntimeError("Fish Audio returned an empty or invalid MP3 response")
        temporary.write_bytes(audio)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def seed_staging_from_published(story_path: Path, languages: tuple[str, ...], staging_root: Path = STAGING_ROOT) -> None:
    """Copy a verified published baseline into staging before one-clip regeneration."""
    _relative, section, _is_package = locate_story(story_path)
    package = read_json(story_path)
    slug = str(package.get("slug") or "").strip()
    for lang in languages:
        staged_dir = staging_root / section / slug / lang
        staged_manifest = staged_dir / "manifest.json"
        if staged_manifest.is_file():
            continue
        if staged_dir.exists() and any(staged_dir.glob("*.mp3")):
            raise RuntimeError(
                f"{staged_dir}: staging MP3 files exist without a manifest; refusing to overwrite."
            )
        published_dir = ROOT / "assets" / "audio" / section / slug / lang
        published_manifest = published_dir / "manifest.json"
        if not published_manifest.is_file():
            raise RuntimeError(
                f"{published_manifest}: no published baseline exists for single-block regeneration."
            )
        manifest = read_json(published_manifest)
        if (
            manifest.get("story") != slug
            or manifest.get("section") != section
            or manifest.get("language") != lang
            or not isinstance(manifest.get("segments"), list)
        ):
            raise ValueError(f"{published_manifest}: invalid baseline manifest identity or segments")
        staged_dir.mkdir(parents=True, exist_ok=True)
        staged_segments: list[dict[str, Any]] = []
        for item in manifest["segments"]:
            if not isinstance(item, dict):
                raise ValueError(f"{published_manifest}: non-object segment")
            filename = item.get("src")
            if not isinstance(filename, str) or Path(filename).name != filename or not filename.endswith(".mp3"):
                raise ValueError(f"{published_manifest}: unsafe audio path {filename!r}")
            source = published_dir / filename
            try:
                source.resolve().relative_to(published_dir.resolve())
            except ValueError as exc:
                raise ValueError(f"{published_manifest}: audio symlink escapes its directory") from exc
            if not source.is_file():
                raise FileNotFoundError(f"{source}: baseline audio file is missing")
            audio_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            expected_hash = item.get("audio_sha256")
            if expected_hash and audio_sha256 != expected_hash.lower():
                raise ValueError(f"{source}: baseline audio hash mismatch")
            staged_item = dict(item)
            # Legacy published manifests may not have a byte hash. Add one only
            # to the isolated staging copy so ASR can verify the exact baseline
            # bytes without changing the published manifest.
            staged_item["audio_sha256"] = audio_sha256
            staged_segments.append(staged_item)
            shutil.copy2(source, staged_dir / filename)
        staged_manifest_data = dict(manifest)
        staged_manifest_data["segments"] = staged_segments
        staged_manifest.write_text(
            json.dumps(staged_manifest_data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def inspect_generation_plan(story_path: Path, staging_root: Path = STAGING_ROOT, languages: tuple[str, ...] = LANGUAGES, force_blocks: tuple[int, ...] = ()) -> dict[str, Any]:
    """Read-only plan for all five languages using isolated staging assets."""
    story_path = story_path.resolve()
    relative, section, is_october_package = locate_story(story_path)
    if section == "october" and not is_october_package:
        raise ValueError(f"October page assets are not generator input; use the extracted shared audio package: {relative}")
    package = read_json(story_path)
    if package.get("format") != "KHALEDOON_STORY" or package.get("section") != section:
        raise ValueError(f"Invalid story package format or section in {relative}")
    slug = str(package.get("slug") or "").strip()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"Invalid story slug in {relative}: {slug!r}")
    translations = package.get("i18n")
    if not isinstance(translations, dict):
        raise ValueError(f"Missing i18n object in {relative}")
    selected_languages = tuple(dict.fromkeys(languages))
    if not selected_languages or any(lang not in LANGUAGES for lang in selected_languages):
        raise ValueError(f"Unsupported language selection: {selected_languages}")
    if is_october_package:
        # The extraction readiness report is only a source-completeness check;
        # human approval still uses the exact shared five-language audio review gate.
        require_october_readiness(story_path, package)
        review_required = True
    else:
        metadata_path = story_path.with_name("data.json")
        metadata = read_json(metadata_path) if metadata_path.is_file() else {}
        review_required = metadata.get("audio_text_review_required") is True
    pronunciation_path = story_path.with_name("audio-pronunciation.json")
    if review_required and not pronunciation_path.is_file():
        raise AudioTextApprovalRequired(
            f"{relative}: blocked until the admin-approved five-language "
            "audio-pronunciation.json is saved beside story.json."
        )
    pronunciation = (
        read_json(pronunciation_path)
        if (review_required or "ar" in selected_languages) and pronunciation_path.is_file()
        else {}
    )
    if review_required:
        approved_text_by_language = validate_required_audio_text_review(
            pronunciation, package, pronunciation_path
        )
    else:
        approved_text_by_language = {lang: {} for lang in LANGUAGES}
        if "ar" in selected_languages:
            approved_text_by_language["ar"] = approved_pronunciation_blocks(
                pronunciation, slug, pronunciation_path
            )
    plan: dict[str, Any] = {
        "story": slug,
        "languages": {},
        "segments_to_generate": 0,
        "fish_segments_to_generate": 0,
    }
    forced = set(force_blocks)
    if any(not isinstance(index, int) or index < 0 for index in forced):
        raise ValueError(f"Invalid forced block indexes: {sorted(forced)}")
    for lang in selected_languages:
        localized = translations.get(lang)
        blocks = localized.get("blocks") if isinstance(localized, dict) else None
        if not isinstance(blocks, list) or not blocks:
            raise ValueError(f"{relative}: missing {lang} blocks")
        language_dir = staging_root / section / slug / lang
        manifest_path = language_dir / "manifest.json"
        asset_dir = language_dir
        if force_blocks and not manifest_path.is_file():
            if language_dir.exists() and any(language_dir.glob("*.mp3")):
                raise ValueError(
                    f"{language_dir}: staged MP3 files exist without a manifest; "
                    "refusing to guess their baseline."
                )
            published_dir = ROOT / "assets" / "audio" / section / slug / lang
            published_manifest = published_dir / "manifest.json"
            if published_manifest.is_file():
                manifest_path = published_manifest
                asset_dir = published_dir
        if force_blocks and not manifest_path.is_file():
            raise ValueError(
                f"{relative}: no existing audio manifest for {lang}; "
                "single-block regeneration requires a complete baseline."
            )
        manifest = read_json(manifest_path) if manifest_path.is_file() else {}
        if manifest and (
            manifest.get("story") != slug
            or manifest.get("section") != section
            or manifest.get("language") != lang
        ):
            raise ValueError(f"{manifest_path}: manifest story/section/language metadata mismatch")
        old = {}
        entries = manifest.get("segments", []) if isinstance(manifest.get("segments"), list) else []
        for item in entries:
            if isinstance(item, dict) and str(item.get("block_index", "")).isdigit():
                old[(int(item["block_index"]), int(item.get("chunk_index", 0)))] = item
        needed = 0
        fish_needed = 0
        found_forced: set[int] = set()
        unrelated_missing: list[int] = []
        for index, block in enumerate(blocks):
            if not isinstance(block, dict) or block.get("speaker") not in ("karma", "narrator"):
                continue
            original = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
            if not original:
                continue
            approved_text = approved_text_by_language.get(lang, {}).get(str(index))
            spoken = (
                prepare_arabic_audio_text(original, approved_text)
                if lang == "ar"
                else re.sub(r"\\s+", " ", approved_text or original).strip()
            )
            chunks = split_audio_chunks(spoken)
            if index in forced:
                found_forced.add(index)
            voice, rate, pitch = VOICE_SETTINGS[lang][block["speaker"]]
            selected_voice = (
                FISH_AUDIO_KARMA_VOICE_ID if block["speaker"] == "karma"
                else FISH_AUDIO_NARRATOR_VOICE_ID
            ) if lang == "ar" else voice
            for chunk_index, chunk in enumerate(chunks):
                previous = old.get((index, chunk_index), {})
                filename = f"{index:03d}.mp3" if chunk_index == 0 else f"{index:03d}-{chunk_index:02d}.mp3"
                target = asset_dir / filename
                digest = text_hash(chunk, selected_voice, rate, pitch, lang)
                unchanged = (
                    index not in forced
                    and previous.get("hash") == digest
                    and previous.get("voice") in (None, selected_voice)
                    and target.is_file()
                    and target.stat().st_size >= 512
                )
                if not unchanged:
                    if forced and index not in forced:
                        unrelated_missing.append(index)
                    else:
                        needed += 1
                        if lang == "ar":
                            fish_needed += 1
        if unrelated_missing:
            raise ValueError(
                f"{relative}: non-selected {lang} blocks need audio too: "
                f"{sorted(set(unrelated_missing))}; refusing broad regeneration."
            )
        missing_forced = forced - found_forced
        if missing_forced:
            raise ValueError(f"{relative}: forced blocks are not speakable in {lang}: {sorted(missing_forced)}")
        plan["languages"][lang] = {
            "segments_to_generate": needed,
            "fish_segments_to_generate": fish_needed,
        }
        plan["segments_to_generate"] += needed
        plan["fish_segments_to_generate"] += fish_needed
    return plan


def inspect_all_generation_plans(root: Path = ROOT, staging_root: Path = STAGING_ROOT) -> dict[str, Any]:
    """Build no-write generation plans for every published story and October audio source package."""
    stories: list[dict[str, Any]] = []
    october: list[dict[str, Any]] = []
    skipped_october = 0
    for story_path in sorted((root / "stories").glob("*/*/story.json")):
        relative = story_path.relative_to(root)
        if relative.parts[1] == "october":
            skipped_october += 1
            continue
        metadata_path = story_path.with_name("data.json")
        if not metadata_path.is_file():
            continue
        try:
            if read_json(metadata_path).get("published") is not True:
                continue
            plan = inspect_generation_plan(story_path, staging_root)
            plan["path"] = relative.as_posix()
            stories.append(plan)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            stories.append({"path": relative.as_posix(), "error": str(exc)})
    for story_path in sorted(root.joinpath(*OCTOBER_PACKAGES_DIR).glob("*/story.json")):
        relative = story_path.relative_to(root)
        try:
            plan = inspect_generation_plan(story_path, staging_root)
            plan["path"] = relative.as_posix()
            october.append(plan)
        except (OctoberPackageNotReady, AudioTextApprovalRequired) as exc:
            october.append({"path": relative.as_posix(), "blocked": str(exc)})
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            october.append({"path": relative.as_posix(), "error": str(exc)})
    everything = stories + october
    return {
        "mode": "read-only-generation-plan",
        "tts_requests": 0,
        "files_modified": 0,
        "october_stories_skipped": skipped_october,
        "published_non_october_stories": len(stories),
        "october_audio_packages": len(october),
        "october_audio_packages_blocked": sum("blocked" in item for item in october),
        "stories_with_errors": sum("error" in item for item in everything),
        "segments_to_generate": sum(item.get("segments_to_generate", 0) for item in everything),
        "fish_segments_to_generate": sum(item.get("fish_segments_to_generate", 0) for item in everything),
        "stories": stories,
        "october_packages": october,
    }


async def generate_story(story_path: Path, dry_run: bool = False, allow_fish_audio: bool = False, languages: tuple[str, ...] = LANGUAGES, force_blocks: tuple[int, ...] = ()) -> bool:
    story_path = story_path.resolve()
    relative, section, is_october_package = locate_story(story_path)
    if section == "october" and not is_october_package:
        print(f"SKIP protected October story: {relative}")
        return False

    package = read_json(story_path)
    if package.get("format") != "KHALEDOON_STORY":
        raise ValueError(f"Unsupported story package format: {relative}")
    if package.get("section") != section:
        raise ValueError(f"Story section mismatch in {relative}")
    slug = str(package.get("slug") or "").strip()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"Invalid or missing story slug in {relative}: {slug!r}")

    if is_october_package:
        require_october_readiness(story_path, package)
        review_required = True
    else:
        metadata_path = story_path.with_name("data.json")
        if not metadata_path.is_file():
            print(f"SKIP unpublished or unverified story: {relative}")
            return False
        metadata = read_json(metadata_path)
        if metadata.get("published") is not True:
            print(f"SKIP unpublished or unverified story: {relative}")
            return False
        review_required = metadata.get("audio_text_review_required") is True

    translations = package.get("i18n")
    if not isinstance(translations, dict):
        raise ValueError(f"Missing i18n object in {relative}")

    languages_to_generate = tuple(dict.fromkeys(languages))
    if not languages_to_generate or any(lang not in LANGUAGES for lang in languages_to_generate):
        raise ValueError(f"Unsupported language selection: {languages_to_generate}")
    pronunciation_path = story_path.with_name("audio-pronunciation.json")
    if review_required and not pronunciation_path.is_file():
        raise ValueError(
            f"{relative}: new story is blocked until the admin-approved five-language "
            "audio-pronunciation.json is saved beside story.json."
        )
    pronunciation_data = (
        read_json(pronunciation_path)
        if (review_required or "ar" in languages_to_generate) and pronunciation_path.is_file()
        else {}
    )
    if review_required:
        approved_text_by_language = validate_required_audio_text_review(
            pronunciation_data, package, pronunciation_path
        )
    else:
        approved_text_by_language = {lang: {} for lang in LANGUAGES}
        if "ar" in languages_to_generate:
            approved_text_by_language["ar"] = approved_pronunciation_blocks(
                pronunciation_data, slug, pronunciation_path
            )
    story_audio_root = STAGING_ROOT / section / slug
    completed = 0

    if force_blocks and not dry_run:
        seed_staging_from_published(story_path, languages_to_generate, STAGING_ROOT)
    plan = inspect_generation_plan(story_path, STAGING_ROOT, languages_to_generate, force_blocks)
    print(
        f"PLAN {relative.parent}: languages={len(plan['languages'])} "
        f"segments_to_generate={plan['segments_to_generate']} "
        f"fish_segments_to_generate={plan['fish_segments_to_generate']} "
        f"output={STAGING_ROOT.relative_to(ROOT)}"
    )
    if dry_run:
        print("DRY RUN ONLY: no TTS requests, directories, MP3 files, or manifests were created or changed.")
        return True
    if plan["fish_segments_to_generate"] and not allow_fish_audio:
        raise RuntimeError(
            "Safety stop before any TTS request: Arabic Fish Audio clips need generation. "
            "Explicit owner approval is required before passing --allow-fish-audio."
        )
    for lang in languages_to_generate:
        localized = translations.get(lang)
        blocks = localized.get("blocks") if isinstance(localized, dict) else None
        if not isinstance(blocks, list) or not blocks:
            raise ValueError(f"{relative}: missing {lang} blocks; refusing partial manifest")

        output_dir = story_audio_root / lang
        output_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = output_dir / "manifest.json"
        old_manifest: dict[str, Any] = {}
        if manifest_path.is_file():
            try:
                old_manifest = read_json(manifest_path)
            except (OSError, ValueError, json.JSONDecodeError):
                old_manifest = {}
        old_segments = {
            (int(item["block_index"]), int(item.get("chunk_index", 0))): item
            for item in old_manifest.get("segments", [])
            if isinstance(item, dict) and str(item.get("block_index", "")).isdigit()
        }

        segments: list[dict[str, Any]] = []
        processed_manifest_segments = {
            (int(item["block_index"]), int(item.get("chunk_index", 0))): item
            for item in old_manifest.get("segments", [])
            if isinstance(item, dict) and str(item.get("block_index", "")).isdigit()
        }

        def save_manifest_checkpoint() -> None:
            # Preserve old entries for unfinished blocks and replace each
            # successfully generated segment immediately. This makes a rerun
            # resume completed clips instead of spending credits on them again.
            checkpoint_segments = dict(processed_manifest_segments)
            for current_segment in segments:
                key = (
                    int(current_segment["block_index"]),
                    int(current_segment.get("chunk_index", 0)),
                )
                checkpoint_segments[key] = current_segment
            checkpoint_manifest = {
                "version": 1,
                "engine": "fish-audio+edge-tts",
                "story": slug,
                "section": section,
                "language": lang,
                "segments": [
                    checkpoint_segments[key]
                    for key in sorted(checkpoint_segments)
                ],
            }
            temporary = manifest_path.with_suffix(".json.partial")
            temporary.write_text(
                json.dumps(checkpoint_manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary.replace(manifest_path)
        for block_index, block in enumerate(blocks):
            if not isinstance(block, dict):
                continue
            speaker = block.get("speaker")
            original_text = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
            if speaker not in ("karma", "narrator") or not original_text:
                continue

            approved_text = approved_text_by_language.get(lang, {}).get(str(block_index))
            audio_text = (
                prepare_arabic_audio_text(original_text, approved_text)
                if lang == "ar"
                else re.sub(r"\\s+", " ", approved_text or original_text).strip()
            )
            chunks = split_audio_chunks(audio_text)
            primary_voice, rate, pitch = VOICE_SETTINGS[lang][speaker]
            use_fish_audio = lang == "ar" and speaker in ("karma", "narrator")
            fish_voice_id = (
                FISH_AUDIO_KARMA_VOICE_ID if speaker == "karma"
                else FISH_AUDIO_NARRATOR_VOICE_ID
            )
            previous_block_voice = old_segments.get((block_index, 0), {}).get("voice")
            candidates = (
                [fish_voice_id]
                if use_fish_audio
                else [primary_voice, *VOICE_FALLBACKS.get(lang, {}).get(speaker, ())]
            )

            for chunk_index, chunk_text in enumerate(chunks):
                filename = (
                    f"{block_index:03d}.mp3"
                    if chunk_index == 0
                    else f"{block_index:03d}-{chunk_index:02d}.mp3"
                )
                destination = output_dir / filename
                previous = old_segments.get((block_index, chunk_index), {})
                previous_voice = previous.get("voice")
                ordered_candidates = list(candidates)
                if previous_voice in ordered_candidates:
                    ordered_candidates.remove(previous_voice)
                    ordered_candidates.insert(0, previous_voice)

                selected_voice = None
                digest = None
                for candidate_voice in ordered_candidates:
                    candidate_hash = text_hash(chunk_text, candidate_voice, rate, pitch, lang)
                    if (
                        block_index not in set(force_blocks)
                        and previous.get("hash") == candidate_hash
                        and previous_voice in (None, candidate_voice)
                        and destination.is_file()
                        and destination.stat().st_size >= 512
                    ):
                        selected_voice = candidate_voice
                        digest = candidate_hash
                        print(f"UNCHANGED {relative.parent}/{lang}/{filename} ({speaker}, {candidate_voice})")
                        break
                    try:
                        if use_fish_audio:
                            if not allow_fish_audio:
                                raise RuntimeError("Fish Audio generation requires explicit --allow-fish-audio approval.")
                            await synthesize_fish_audio(chunk_text, destination, candidate_voice)
                        else:
                            await synthesize(chunk_text, candidate_voice, rate, pitch, destination)
                        selected_voice = candidate_voice
                        digest = candidate_hash
                        print(f"GENERATED {relative.parent}/{lang}/{filename} ({speaker}, {candidate_voice})")
                        break
                    except Exception as exc:
                        print(f"VOICE FAILED {relative.parent}/{lang}/{filename}: {candidate_voice}: {exc}", file=sys.stderr)

                if selected_voice is None or digest is None:
                    raise RuntimeError(
                        f"No working voice for {lang}/{speaker} block {block_index} chunk {chunk_index}; tried {ordered_candidates}"
                    )

                audio_sha256 = hashlib.sha256(destination.read_bytes()).hexdigest()
                segments.append({
                    "block_index": block_index,
                    "chunk_index": chunk_index,
                    "speaker": speaker,
                    "voice": selected_voice,
                    "provider": "fish-audio" if use_fish_audio else "edge-tts",
                    "model": FISH_AUDIO_MODEL if use_fish_audio else "edge-tts",
                    "src": filename,
                    "hash": digest,
                    "audio_sha256": audio_sha256,
                    "text": chunk_text,
                })
                if use_fish_audio:
                    save_manifest_checkpoint()
                completed += 1

        if not segments:
            raise ValueError(f"{relative}: no speakable segments found for {lang}")

        manifest = {
            "version": 1,
            "engine": "fish-audio+edge-tts",
            "story": slug,
            "section": section,
            "language": lang,
            "segments": segments,
        }
        temporary_manifest = manifest_path.with_suffix(".json.partial")
        temporary_manifest.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_manifest.replace(manifest_path)

        # Never delete old MP3 files. Cleanup/promotion is a separate reviewed operation.

    print(f"READY {relative.parent}: {completed} audio segments across {len(languages_to_generate)} language(s): {', '.join(languages_to_generate)}")
    return True


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely plan or generate Khaledoon audio into isolated staging only."
    )
    parser.add_argument(
        "--story",
        type=Path,
        help=(
            "Explicit story.json path (stories/<section>/<id>/story.json or "
            "rebuild/october-audio-packages/<id>/story.json). Omit to build a read-only "
            "generation plan for all published stories and extracted October audio packages."
        ),
    )
    parser.add_argument(
        "--plan-all",
        action="store_true",
        help="Explicitly build a no-write generation plan for every published story and extracted October audio package.",
    )
    parser.add_argument(
        "--generate",
        action="store_true",
        help="Actually request TTS. Output is restricted to .audio-staging, never the published audio tree.",
    )
    parser.add_argument(
        "--allow-fish-audio",
        action="store_true",
        help="Explicit approval gate for billable Arabic Fish Audio requests.",
    )
    parser.add_argument(
        "--languages",
        nargs="+",
        choices=LANGUAGES,
        default=list(LANGUAGES),
        help="Languages to plan or generate. Defaults to all five.",
    )
    parser.add_argument(
        "--force-block",
        type=int,
        action="append",
        default=[],
        help="Force regeneration of this zero-based spoken block in the selected languages; output remains staged.",
    )
    args = parser.parse_args()

    if args.allow_fish_audio and not args.generate:
        parser.error("--allow-fish-audio is valid only together with --generate")
    if args.plan_all and args.story:
        parser.error("--plan-all cannot be combined with --story")
    if args.force_block and not args.story:
        parser.error("--force-block requires an explicit --story")
    if not args.story:
        if args.generate:
            parser.error("--generate requires an explicit --story")
        report = inspect_all_generation_plans(ROOT, STAGING_ROOT)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if report["stories_with_errors"] else 0

    story = args.story if args.story.is_absolute() else ROOT / args.story
    return 0 if await generate_story(
        story,
        dry_run=not args.generate,
        allow_fish_audio=args.allow_fish_audio,
        languages=tuple(args.languages),
        force_blocks=tuple(args.force_block),
    ) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
