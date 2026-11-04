#!/usr/bin/env python3
"""Generate static, per-speaker audio for published Khaledoon story packages.

Refresh the Magdi Yacoub Arabic narrator clips using the approved voice B.

The workflow intentionally excludes the October section. Audio is an optional
enhancement: a failed synthesis never changes the story package or its page.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from audio_text_guard import validate_pronunciation_blocks

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("ar", "en", "fr", "it", "de")
GENERATOR_VERSION = "4"
ARABIC_AUDIO_TEXT_VERSION = "story-specific-contextual-pronunciation-v1"
FISH_AUDIO_KARMA_VOICE_ID = "592625f68416462f8b6161ddf5fdbffb"
FISH_AUDIO_NARRATOR_VOICE_ID = "b65cfd7ce5e44607aedafeea3dbb01e8"  # owner-approved final narrator voice
FISH_AUDIO_MODEL = "s2.1-pro-free"
# Explicit owner-approved scope for this one-time Arabic pronunciation pilot.
FISH_AUDIO_ALLOWED_REGEN_BLOCKS = {1, 6, 7, 8, 10}
# Original manifest input hashes for the three owner-approved Karma clips.
# They are immutable in this narrator-only pilot; these are not MP3 byte hashes.
KARMA_ORIGINAL_MANIFEST_HASH = {
    0: "3d531998fb878488a7f95d5d5f8dd2b15e4df9007529ea4f3a9d7e53909c9c64",
    2: "a8c4f80cdf7b59eb8ba2676eef94a109e20c86b51476d4b45c546bdca3e9ea10",
    3: "88ee90b74d24062258dc1c70a18eec8aaf0430d4043f671addad5d4926a73064",
}
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


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def text_hash(text: str, voice: str, rate: str, pitch: str, lang: str) -> str:
    fields = [GENERATOR_VERSION, lang, text, voice, rate, pitch]
    if lang == "ar":
        fields.insert(1, ARABIC_AUDIO_TEXT_VERSION)
    payload = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def is_original_karma_clip(
    block_index: int,
    chunk_index: int,
    text: str,
    voice: str,
    previous: dict[str, Any],
    destination: Path,
) -> bool:
    expected_hash = KARMA_ORIGINAL_MANIFEST_HASH.get(block_index)
    if (
        expected_hash is None
        or chunk_index != 0
        or previous.get("voice") != voice
        or previous.get("text") != text
        or not destination.is_file()
        or destination.stat().st_size < 512
    ):
        return False
    return previous.get("hash") == expected_hash


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


async def generate_story(story_path: Path, dry_run: bool = False) -> bool:
    story_path = story_path.resolve()
    try:
        relative = story_path.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError(f"Story path must be inside the repository: {story_path}") from exc

    if story_path.name != "story.json" or len(relative.parts) != 4 or relative.parts[0] != "stories":
        raise ValueError(f"Expected stories/<section>/<id>/story.json, got {relative}")
    section = relative.parts[1]
    if section == "october":
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

    metadata_path = story_path.with_name("data.json")
    if not metadata_path.is_file() or read_json(metadata_path).get("published") is not True:
        print(f"SKIP unpublished or unverified story: {relative}")
        return False

    translations = package.get("i18n")
    if not isinstance(translations, dict):
        raise ValueError(f"Missing i18n object in {relative}")

    pronunciation_path = story_path.with_name("audio-pronunciation.json")
    pronunciation_data = read_json(pronunciation_path) if pronunciation_path.is_file() else {}
    if pronunciation_data:
        if pronunciation_data.get("story") != slug or pronunciation_data.get("language") != "ar":
            raise ValueError(f"{pronunciation_path}: story/language metadata mismatch")
        pronunciation_blocks = pronunciation_data.get("blocks")
        if not isinstance(pronunciation_blocks, dict):
            raise ValueError(f"{pronunciation_path}: blocks must be an object keyed by block index")
        languages_to_generate = ("ar",)
        # Fail closed before creating output folders or contacting any TTS provider.
        arabic_localized = translations.get("ar")
        arabic_blocks = arabic_localized.get("blocks") if isinstance(arabic_localized, dict) else []
        validate_pronunciation_blocks(arabic_blocks, pronunciation_blocks)
    else:
        pronunciation_blocks = {}
        languages_to_generate = LANGUAGES

    story_audio_root = ROOT / "assets" / "audio" / section / slug
    completed = 0
    for lang in languages_to_generate:
        localized = translations.get(lang)
        blocks = localized.get("blocks") if isinstance(localized, dict) else None
        if not isinstance(blocks, list) or not blocks:
            raise ValueError(f"{relative}: missing {lang} blocks; refusing partial manifest")

        output_dir = story_audio_root / lang
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

        # Preflight every existing Arabic segment before making any billable request.
        # This pilot may regenerate only the five approved narrator blocks.
        if (
            lang == "ar"
            and pronunciation_data
            and section == "science"
            and slug == "magdi-yacoub"
        ):
            planned_regenerations: set[int] = set()
            for planned_index, planned_block in enumerate(blocks):
                if not isinstance(planned_block, dict):
                    continue
                planned_speaker = planned_block.get("speaker")
                planned_original = re.sub(
                    r"\s+", " ", str(planned_block.get("text") or "")
                ).strip()
                if planned_speaker not in ("karma", "narrator") or not planned_original:
                    continue
                planned_text = prepare_arabic_audio_text(
                    planned_original, pronunciation_blocks.get(str(planned_index))
                )
                planned_chunks = split_audio_chunks(planned_text)
                planned_voice = (
                    FISH_AUDIO_KARMA_VOICE_ID
                    if planned_speaker == "karma"
                    else FISH_AUDIO_NARRATOR_VOICE_ID
                )
                planned_rate, planned_pitch = VOICE_SETTINGS["ar"][planned_speaker][1:]
                if planned_speaker == "karma":
                    if len(planned_chunks) != 1 or not is_original_karma_clip(
                        planned_index,
                        0,
                        planned_chunks[0],
                        planned_voice,
                        old_segments.get((planned_index, 0), {}),
                        output_dir / f"{planned_index:03d}.mp3",
                    ):
                        raise RuntimeError(
                            "Safety stop before Fish Audio: original Karma audio "
                            f"block {planned_index} failed its immutable hash check."
                        )
                    continue
                for planned_chunk_index, planned_chunk in enumerate(planned_chunks):
                    planned_previous = old_segments.get(
                        (planned_index, planned_chunk_index), {}
                    )
                    planned_filename = (
                        f"{planned_index:03d}.mp3"
                        if planned_chunk_index == 0
                        else f"{planned_index:03d}-{planned_chunk_index:02d}.mp3"
                    )
                    planned_destination = output_dir / planned_filename
                    planned_hash = text_hash(
                        planned_chunk, planned_voice, planned_rate, planned_pitch, "ar"
                    )
                    is_unchanged = (
                        planned_previous.get("hash") == planned_hash
                        and planned_previous.get("voice") in (None, planned_voice)
                        and planned_destination.is_file()
                        and planned_destination.stat().st_size >= 512
                    )
                    if not is_unchanged:
                        if (
                            planned_speaker != "narrator"
                            or planned_index not in FISH_AUDIO_ALLOWED_REGEN_BLOCKS
                        ):
                            raise RuntimeError(
                                "Safety stop before Fish Audio: unexpected regeneration "
                                f"for block {planned_index} ({planned_speaker})."
                            )
                        planned_regenerations.add(planned_index)

            unexpected_regenerations = planned_regenerations - FISH_AUDIO_ALLOWED_REGEN_BLOCKS
            if unexpected_regenerations:
                raise RuntimeError(
                    "Safety stop before Fish Audio: unexpected blocks need regeneration: "
                    f"{sorted(unexpected_regenerations)}."
                )
            print(
                "PILOT PREFLIGHT OK: remaining narrator blocks to generate "
                f"{sorted(planned_regenerations)}; already-current approved blocks "
                f"{sorted(FISH_AUDIO_ALLOWED_REGEN_BLOCKS - planned_regenerations)}."
            )

        if dry_run:
            planned_segments = 0
            for planned_index, planned_block in enumerate(blocks):
                if not isinstance(planned_block, dict):
                    continue
                planned_speaker = planned_block.get("speaker")
                planned_original = re.sub(
                    r"\\s+", " ", str(planned_block.get("text") or "")
                ).strip()
                if planned_speaker not in ("karma", "narrator") or not planned_original:
                    continue
                planned_text = (
                    prepare_arabic_audio_text(
                        planned_original, pronunciation_blocks.get(str(planned_index))
                    )
                    if lang == "ar"
                    else planned_original
                )
                planned_segments += len(split_audio_chunks(planned_text))
            print(
                f"DRY RUN ONLY: {relative.parent}/{lang} would produce "
                f"{planned_segments} segments; no folders, MP3s, manifests, or TTS requests."
            )
            continue

        output_dir.mkdir(parents=True, exist_ok=True)
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

            audio_text = prepare_arabic_audio_text(original_text, pronunciation_blocks.get(str(block_index))) if lang == "ar" else original_text
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
                    if speaker == "karma" and is_original_karma_clip(
                        block_index,
                        chunk_index,
                        chunk_text,
                        candidate_voice,
                        previous,
                        destination,
                    ):
                        selected_voice = candidate_voice
                        digest = previous["hash"]
                        print(
                            f"PRESERVED ORIGINAL KARMA {relative.parent}/{lang}/{filename}"
                        )
                        break
                    if (
                        previous.get("hash") == candidate_hash
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

                segments.append({
                    "block_index": block_index,
                    "chunk_index": chunk_index,
                    "speaker": speaker,
                    "voice": selected_voice,
                    "provider": "fish-audio" if use_fish_audio else "edge-tts",
                    "model": FISH_AUDIO_MODEL if use_fish_audio else "edge-tts",
                    "src": filename,
                    "hash": digest,
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

        keep = {item["src"] for item in segments}
        for old_file in output_dir.glob("*.mp3"):
            if old_file.name not in keep:
                old_file.unlink()

    if dry_run:
        print(f"DRY RUN COMPLETE: {relative.parent}; no files were changed and no TTS request was sent.")
        return True

    print(f"READY {relative.parent}: {completed} audio segments across {len(languages_to_generate)} language(s): {', '.join(languages_to_generate)}")
    return True


async def main() -> int:
    parser = argparse.ArgumentParser(description="Generate audio for one published Khaledoon story.")
    parser.add_argument(
        "--story",
        default="stories/science/015/story.json",
        help="Repository-relative path to one story.json; October stories remain protected.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate every selected language and estimate segment counts without writing files or contacting TTS.",
    )
    args = parser.parse_args()

    story = Path(args.story).expanduser()
    if not story.is_absolute():
        story = ROOT / story
    return 0 if await generate_story(story, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
