#!/usr/bin/env python3
"""Generate only Ibn Sina's first Arabic (Karma) preview through the hosted NAMAA Space."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from gradio_client import Client

ROOT = Path(__file__).resolve().parents[1]
STORY_FILE = ROOT / "stories/history/005/story.json"
REFERENCE_SOURCE = ROOT / "assets/audio/science/magdi-yacoub/ar/000.mp3"
OUT = ROOT / "artifacts/ibn-sina-audio-staging"
OUT.mkdir(parents=True, exist_ok=True)

SPACE_ID = "omarelshehy/NAMAA-Egyptian-Voice"
EXPECTED_REQUEST_ID = os.environ["REQUEST_ID"]
BLOCK_INDEX = int(os.environ.get("BLOCK_INDEX", "0"))
if BLOCK_INDEX != 0:
    raise ValueError("This pilot is deliberately limited to Ibn Sina's first Arabic segment (block 0).")

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def audio_output_to_file(result, destination: Path) -> None:
    """Normalize Gradio Audio output variants to a local WAV file."""
    if isinstance(result, (tuple, list)) and len(result) == 2:
        sample_rate, audio_data = result
        if isinstance(audio_data, np.ndarray):
            sf.write(destination, audio_data.squeeze(), int(sample_rate))
            return
    if isinstance(result, dict):
        candidate = result.get("path") or result.get("name") or result.get("url")
    else:
        candidate = result
    if not isinstance(candidate, str) or not candidate:
        raise TypeError(f"Unexpected NAMAA Space audio response: {type(result).__name__}")
    if candidate.startswith("http://") or candidate.startswith("https://"):
        import requests
        response = requests.get(candidate, timeout=180)
        response.raise_for_status()
        temporary = destination.with_suffix(".download")
        temporary.write_bytes(response.content)
        candidate = str(temporary)
    source = Path(candidate)
    if not source.is_file():
        raise FileNotFoundError(f"NAMAA Space returned no accessible audio file: {candidate}")
    shutil.copyfile(source, destination)

def main() -> None:
    story = json.loads(STORY_FILE.read_text(encoding="utf-8"))
    blocks = story["i18n"]["ar"]["blocks"]
    first = blocks[0]
    if first.get("speaker") != "karma" or not first.get("text", "").strip():
        raise ValueError("The first Arabic Ibn Sina block is not the approved Karma segment.")
    if not REFERENCE_SOURCE.is_file():
        raise FileNotFoundError(f"Approved Karma reference audio is missing: {REFERENCE_SOURCE}")

    with tempfile.TemporaryDirectory(prefix="namaa-ibn-sina-") as temp_dir:
        temp = Path(temp_dir)
        reference = temp / "karma_reference.wav"
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(REFERENCE_SOURCE), "-t", "9", "-ac", "1", "-ar", "24000",
            "-c:a", "pcm_s16le", str(reference)
        ], check=True)

        print(f"Connecting to hosted NAMAA Space: {SPACE_ID}", flush=True)
        token = os.getenv("HF_TOKEN") or None
        client = Client(SPACE_ID, hf_token=token, verbose=True)
        print("Generating only Arabic block 0 (Karma)...", flush=True)
        result = client.predict(
            first["text"],
            str(reference),
            0.45,  # restrained expressiveness for a natural child voice
            0.8,
            0,
            0.5,
            api_name="/generate_tts_audio",
        )
        wav_path = temp / "namaa_output.wav"
        audio_output_to_file(result, wav_path)

        mp3_path = OUT / "000.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "128k",
            str(mp3_path)
        ], check=True)

    manifest = {
        "version": 1,
        "story": "ibn-sina",
        "section": "history",
        "language": "ar",
        "request_id": EXPECTED_REQUEST_ID,
        "provider": "huggingface-space",
        "model": "NAMAA-Space/NAMAA-Egyptian-TTS",
        "segments": [{
            "block_index": 0,
            "chunk_index": 0,
            "speaker": "karma",
            "voice": "magdi-yacoub-karma-reference",
            "provider": "huggingface-space",
            "model": "NAMAA-Space/NAMAA-Egyptian-TTS",
            "src": "000.mp3",
            "audio_sha256": sha256(mp3_path),
            "text": first["text"],
            "reference_sha256": sha256(REFERENCE_SOURCE),
        }],
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)
    print(f"READY: {mp3_path} ({mp3_path.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    main()
