#!/usr/bin/env python3
"""Generate static, per-speaker audio for published Khaledoon story packages.

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

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("ar", "en", "fr", "it", "de")
GENERATOR_VERSION = "3"
FISH_AUDIO_KARMA_VOICE_ID = "592625f68416462f8b6161ddf5fdbffb"
FISH_AUDIO_NARRATOR_VOICE_ID = "a02a8220d6014812aa5ff73434c54cc0"
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


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def text_hash(text: str, voice: str, rate: str, pitch: str, lang: str) -> str:
    payload = json.dumps(
        [GENERATOR_VERSION, lang, text, voice, rate, pitch],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def synthesize(
    text: str, voice: str, rate: str, pitch: str, destination: Path
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".partial.mp3")
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            temporary.unlink(missing_ok=True)
            communicator = edge_tts.Communicate(
                text, voice, rate=rate, pitch=pitch
            )
            await asyncio.wait_for(communicator.save(str(temporary)), timeout=35)
            if not temporary.is_file() or temporary.stat().st_size < 512:
                raise RuntimeError("TTS returned an empty or invalid MP3 file")
            temporary.replace(destination)
            await asyncio.sleep(1.0)
            return
        except Exception as exc:
            last_error = exc
            temporary.unlink(missing_ok=True)
            if attempt < 3:
                await asyncio.sleep(2 ** attempt)
    raise RuntimeError(
        f"Failed after 3 attempts for voice {voice}: {last_error}"
    ) from last_error


async def synthesize_fish_audio(text: str, destination: Path, voice_id: str) -> None:
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
    except urllib.error.HTTPError as exc:
        detail = exc.read(1200).decode("utf-8", errors="replace")
        raise RuntimeError(f"Fish Audio API returned HTTP {exc.code}: {detail}") from exc
    if len(audio) < 512:
        raise RuntimeError("Fish Audio returned an empty or invalid MP3 response")
    temporary.write_bytes(audio)
    temporary.replace(destination)


async def generate_story(story_path: Path) -> bool:
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

    story_audio_root = ROOT / "assets" / "audio" / section / slug
    completed = 0
    for lang in LANGUAGES:
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
            int(item["block_index"]): item
            for item in old_manifest.get("segments", [])
            if isinstance(item, dict) and str(item.get("block_index", "")).isdigit()
        }

        segments: list[dict[str, Any]] = []
        for block_index, block in enumerate(blocks):
            if not isinstance(block, dict):
                continue
            speaker = block.get("speaker")
            text = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
            if speaker not in ("karma", "narrator") or not text:
                continue
            primary_voice, rate, pitch = VOICE_SETTINGS[lang][speaker]
            use_fish_audio = lang == "ar" and speaker in ("karma", "narrator")
            fish_voice_id = (
                FISH_AUDIO_KARMA_VOICE_ID if speaker == "karma"
                else FISH_AUDIO_NARRATOR_VOICE_ID
            )
            candidates = (
                [fish_voice_id]
                if use_fish_audio
                else [primary_voice, *VOICE_FALLBACKS.get(lang, {}).get(speaker, ())]
            )
            filename = f"{block_index:03d}.mp3"
            destination = output_dir / filename
            previous = old_segments.get(block_index, {})
            previous_voice = previous.get("voice")
            if previous_voice in candidates:
                candidates.remove(previous_voice)
                candidates.insert(0, previous_voice)

            selected_voice = None
            digest = None
            for candidate_voice in candidates:
                candidate_hash = text_hash(text, candidate_voice, rate, pitch, lang)
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
                        await synthesize_fish_audio(text, destination, candidate_voice)
                    else:
                        await synthesize(text, candidate_voice, rate, pitch, destination)
                    selected_voice = candidate_voice
                    digest = candidate_hash
                    print(f"GENERATED {relative.parent}/{lang}/{filename} ({speaker}, {candidate_voice})")
                    break
                except Exception as exc:
                    print(f"VOICE RETRY {relative.parent}/{lang}/{filename}: {candidate_voice}: {exc}", file=sys.stderr)

            if selected_voice is None or digest is None:
                raise RuntimeError(
                    f"No working voice for {lang}/{speaker} block {block_index}; tried {candidates}"
                )

            segments.append({
                "block_index": block_index,
                "speaker": speaker,
                "voice": selected_voice,
                "provider": "fish-audio" if use_fish_audio else "edge-tts",
                "model": FISH_AUDIO_MODEL if use_fish_audio else "edge-tts",
                "src": filename,
                "hash": digest,
            })
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

    print(f"READY {relative.parent}: {completed} audio segments across {len(LANGUAGES)} languages")
    return True


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="process all published non-October stories")
    parser.add_argument("--paths", nargs="*", default=[], help="story.json paths to process")
    args = parser.parse_args()

    if args.all:
        paths = sorted((ROOT / "stories").glob("*/*/story.json"))
    else:
        paths = [ROOT / value for value in args.paths]

    if not paths:
        print("No story packages selected; nothing to do.")
        return 0

    seen: set[Path] = set()
    failures: list[str] = []
    for path in paths:
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        try:
            await generate_story(resolved)
        except Exception as exc:
            failures.append(f"{path}: {exc}")
            print(f"ERROR {path}: {exc}", file=sys.stderr)

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
