#!/usr/bin/env python3
"""Generate exactly Magdi Yacoub Arabic narrator segment 001; never run the story-wide pipeline."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY_PATH = ROOT / "stories/science/015/story.json"
DATA_PATH = ROOT / "stories/science/015/data.json"
AUDIO_DIR = ROOT / "assets/audio/science/magdi-yacoub/ar"
MANIFEST_PATH = AUDIO_DIR / "manifest.json"
AUDIO_PATH = AUDIO_DIR / "001.mp3"

# Preserve the exact narrator voice already recorded in the published manifest.
VOICE_ID = "b65cfd7ce5e44607aedafeea3dbb01e8"
MODEL = "s2.1-pro-free"
GENERATOR_VERSION = "3"
AUDIO_TEXT_VERSION = "manual-word-pronunciation-corrections-only-v1"
RATE = "-2%"
PITCH = "+0Hz"

EXPECTED_VISIBLE_TEXT = (
    "والإجابة تبدأ من الفضول والتعلّم، ثم التدريب الطويل والعمل مع فريق طبي. "
    "مجدي يعقوب لم يصبح جرّاح قلب في يوم واحد؛ فقد احتاج الطريق إلى دراسة وخبرة ومهارة، "
    "وإلى تعاون أطباء وممرضين وباحثين."
)

# Audio-only, limited vocalization: no automatic full-sentence tashkeel.
AUDIO_TEXT = (
    "والإجابة تبدأ من الفضول والتعلُّم، ثم التدريب الطويل والعمل مع فريق طِبِّيّ. "
    "مَجْدِي يَعْقُوب لم يصبح جَرَّاح قلب في يوم واحد؛ فقد احتاج الطريق إلى دراسة وخبرة ومهارة، "
    "وإلى تعاون أطباء وممرضين وباحثين."
)

MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")


def normalized_arabic(value: str) -> str:
    return re.sub(r"\s+", " ", MARKS.sub("", value)).strip()


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def text_hash(text: str) -> str:
    fields = [
        GENERATOR_VERSION,
        AUDIO_TEXT_VERSION,
        "ar",
        text,
        VOICE_ID,
        RATE,
        PITCH,
    ]
    payload = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def synthesize(api_key: str, destination: Path) -> None:
    payload = json.dumps(
        {
            "text": AUDIO_TEXT,
            "reference_id": VOICE_ID,
            "format": "mp3",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "model": MODEL,
    }
    raw_tmp = destination.with_name(".001.generated.tmp.mp3")
    last_error: Exception | None = None

    try:
        for attempt in range(1, 4):
            raw_tmp.unlink(missing_ok=True)
            request = urllib.request.Request(
                "https://api.fish.audio/v1/tts",
                data=payload,
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    audio = response.read()
                if len(audio) < 512:
                    raise RuntimeError("Fish Audio returned an empty or invalid MP3.")
                raw_tmp.write_bytes(audio)
                break
            except urllib.error.HTTPError as exc:
                detail = exc.read(1000).decode("utf-8", errors="replace")
                last_error = RuntimeError(f"Fish Audio HTTP {exc.code}: {detail}")
                if exc.code not in (408, 409, 425, 429, 500, 502, 503, 504):
                    raise last_error from exc
            except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as exc:
                last_error = exc
            if attempt == 3:
                raise RuntimeError(f"Fish Audio failed after 3 attempts: {last_error}") from last_error
            time.sleep(2 ** attempt)

        probe = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(raw_tmp),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        duration = float(probe.stdout.strip())
        if not 4.0 <= duration <= 90.0:
            raise RuntimeError(f"Unexpected audio duration: {duration:.2f} seconds.")

        # Replace only 001.mp3 after synthesis and technical checks have passed.
        raw_tmp.replace(destination)
        print(f"GENERATED {destination.relative_to(ROOT)} ({duration:.2f}s, {destination.stat().st_size} bytes)")
    finally:
        raw_tmp.unlink(missing_ok=True)


def main() -> None:
    package = load_json(STORY_PATH)
    metadata = load_json(DATA_PATH)
    if package.get("format") != "KHALEDOON_STORY" or package.get("section") != "science":
        raise RuntimeError("Unexpected story package; refusing to generate.")
    if package.get("slug") != "magdi-yacoub" or metadata.get("published") is not True:
        raise RuntimeError("Magdi Yacoub story is not the expected published package.")

    blocks = package.get("i18n", {}).get("ar", {}).get("blocks", [])
    if len(blocks) <= 1 or blocks[1].get("speaker") != "narrator":
        raise RuntimeError("Arabic block 1 is not the expected narrator segment.")
    visible_text = re.sub(r"\s+", " ", str(blocks[1].get("text") or "")).strip()
    if normalized_arabic(visible_text) != normalized_arabic(EXPECTED_VISIBLE_TEXT):
        raise RuntimeError("Visible story text changed; review the audio-only copy before generation.")
    if normalized_arabic(AUDIO_TEXT) != normalized_arabic(visible_text):
        raise RuntimeError("Audio-only copy changes visible wording; refusing to synthesize.")

    manifest = load_json(MANIFEST_PATH)
    matches = [x for x in manifest.get("segments", []) if x.get("block_index") == 1]
    if len(matches) != 1:
        raise RuntimeError("Manifest must contain exactly one block_index=1 segment.")
    segment = matches[0]
    if (
        segment.get("speaker") != "narrator"
        or segment.get("src") != "001.mp3"
        or segment.get("voice") != VOICE_ID
        or segment.get("provider") != "fish-audio"
    ):
        raise RuntimeError("Published segment 001 no longer matches the approved narrator voice; refusing to overwrite.")
    expected_hash = text_hash(AUDIO_TEXT)
    audio_is_valid = False
    if AUDIO_PATH.is_file() and AUDIO_PATH.stat().st_size >= 512:
        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(AUDIO_PATH)],
                check=True, capture_output=True, text=True, timeout=30,
            )
            duration = float(probe.stdout.strip())
            audio_is_valid = 4.0 <= duration <= 90.0
        except (subprocess.CalledProcessError, ValueError, OSError, subprocess.TimeoutExpired):
            audio_is_valid = False

    if audio_is_valid and segment.get("hash") == expected_hash and segment.get("text") == AUDIO_TEXT:
        print("UNCHANGED: Magdi Yacoub Arabic segment 001 is current and valid; no TTS request made.")
        return

    api_key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("FISH_AUDIO_API_KEY is missing from GitHub Actions secrets.")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    synthesize(api_key, AUDIO_PATH)

    # Update only the matching manifest record; preserve every other segment byte-for-byte in meaning.
    segment["hash"] = expected_hash
    segment["text"] = AUDIO_TEXT
    temporary_manifest = MANIFEST_PATH.with_name("manifest.json.tmp")
    temporary_manifest.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_manifest.replace(MANIFEST_PATH)

    print("UPDATED exactly:")
    print(" - assets/audio/science/magdi-yacoub/ar/001.mp3")
    print(" - assets/audio/science/magdi-yacoub/ar/manifest.json (segment block_index=1 only)")
    print(f"VOICE_ID={VOICE_ID}")
    print(f"MODEL={MODEL}")
    print(f"AUDIO_TEXT_VERSION={AUDIO_TEXT_VERSION}")


if __name__ == "__main__":
    main()
