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
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("ar", "en", "fr", "it", "de")
GENERATOR_VERSION = "3"
ARABIC_AUDIO_TEXT_VERSION = "text2tashkeel-0.1.0-rawi-ensemble-fish-prosody-v2"
FISH_AUDIO_KARMA_VOICE_ID = "592625f68416462f8b6161ddf5fdbffb"
FISH_AUDIO_NARRATOR_VOICE_ID = "b65cfd7ce5e44607aedafeea3dbb01e8"  # approved narrator voice B; force a complete published non-October refresh after prior run stalled
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
    fields = [GENERATOR_VERSION, lang, text, voice, rate, pitch]
    if lang == "ar":
        fields.insert(1, ARABIC_AUDIO_TEXT_VERSION)
    payload = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


_ARABIC_DIACRITIZER = None


def diacritize_arabic_text(text: str) -> str:
    """Prepare an audio-only Arabic reading copy without changing story text."""
    global _ARABIC_DIACRITIZER
    if not re.search(r"[\u0600-\u06FF]", text):
        return text

    if _ARABIC_DIACRITIZER is None:
        try:
            from text2tashkeel import Diacritizer
        except ImportError as exc:
            raise RuntimeError(
                "Arabic audio requires text2tashkeel==0.1.0; refusing to synthesize unvocalized Arabic."
            ) from exc
        _ARABIC_DIACRITIZER = Diacritizer("rawi-ensemble")

    # The model documentation recommends one sentence per call. Keep the
    # sentence context intact and preserve the original punctuation/spacing.
    parts = re.split(r"(?<=[.!?؟؛])(?=\s)|(?<=\n)", text)
    output: list[str] = []
    for part in parts:
        if not part or part.isspace():
            output.append(part)
            continue
        if re.search(r"[\u0600-\u06FF]", part):
            vocalized = _ARABIC_DIACRITIZER.diacritize(part)
            if not isinstance(vocalized, str) or not vocalized.strip():
                raise RuntimeError("Arabic diacritizer returned empty text.")
            output.append(vocalized)
        else:
            output.append(part)
    return "".join(output)


def normalize_arabic_audio(path: Path) -> None:
    """Normalize Arabic Fish tracks to a consistent loudness before publishing."""
    normalized = path.with_name(path.stem + ".normalized.mp3")
    try:
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(path),
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-ar", "44100", "-b:a", "128k", str(normalized),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=90,
        )
        if not normalized.is_file() or normalized.stat().st_size < 512:
            raise RuntimeError("FFmpeg loudnorm returned an empty audio file")
        normalized.replace(path)
    except Exception:
        normalized.unlink(missing_ok=True)
        raise


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


def fish_speed_from_rate(rate: str) -> float:
    """Translate Edge-style percentage rate into Fish Audio's speed multiplier."""
    match = re.fullmatch(r"([+-]?\d+(?:\.\d+)?)%", rate.strip())
    if not match:
        return 1.0
    return max(0.5, min(2.0, 1.0 + float(match.group(1)) / 100.0))


async def synthesize_fish_audio(
    text: str, destination: Path, voice_id: str, speed: float = 1.0
) -> None:
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
        "prosody": {"speed": speed, "volume": 0},
    }, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None

    for attempt in range(1, 4):
        temporary.unlink(missing_ok=True)
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
            normalize_arabic_audio(temporary)
            temporary.replace(destination)
            return
        except urllib.error.HTTPError as exc:
            detail = exc.read(1200).decode("utf-8", errors="replace")
            last_error = RuntimeError(f"Fish Audio API returned HTTP {exc.code}: {detail}")
            if exc.code not in (408, 409, 425, 429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            last_error = exc

        temporary.unlink(missing_ok=True)
        if attempt < 3:
            await asyncio.sleep(2 ** attempt)

    raise RuntimeError(
        f"Fish Audio failed after {attempt} attempt(s) for voice {voice_id}: {last_error}"
    ) from last_error


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
            (int(item["block_index"]), int(item.get("chunk_index", 0))): item
            for item in old_manifest.get("segments", [])
            if isinstance(item, dict) and str(item.get("block_index", "")).isdigit()
        }

        segments: list[dict[str, Any]] = []
        for block_index, block in enumerate(blocks):
            if not isinstance(block, dict):
                continue
            speaker = block.get("speaker")
            original_text = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
            if speaker not in ("karma", "narrator") or not original_text:
                continue

            audio_text = diacritize_arabic_text(original_text) if lang == "ar" else original_text
            chunks = split_audio_chunks(audio_text)
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
                            await synthesize_fish_audio(
                                chunk_text, destination, candidate_voice,
                                speed=fish_speed_from_rate(rate),
                            )
                        else:
                            await synthesize(chunk_text, candidate_voice, rate, pitch, destination)
                        selected_voice = candidate_voice
                        digest = candidate_hash
                        print(f"GENERATED {relative.parent}/{lang}/{filename} ({speaker}, {candidate_voice})")
                        break
                    except Exception as exc:
                        print(f"VOICE RETRY {relative.parent}/{lang}/{filename}: {candidate_voice}: {exc}", file=sys.stderr)

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
