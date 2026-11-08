#!/usr/bin/env python3
"""Generate exactly one Arabic Ibn Sina segment through the hosted NAMAA Space."""
# Retry after correcting the Gradio Client constructor keyword to hf_token.
# This run uses Gradio file upload and the supported Hugging Face token parameter.
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
from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parents[1]
STORY_FILE = ROOT / "stories/history/005/story.json"
REFERENCE_SOURCES = {
    "karma": ROOT / "assets/audio/science/magdi-yacoub/ar/000.mp3",
    "narrator": ROOT / "assets/audio/science/magdi-yacoub/ar/001.mp3",
}
OUT = ROOT / "artifacts/ibn-sina-audio-staging"
OUT.mkdir(parents=True, exist_ok=True)
SPACE_ID = "omarelshehy/NAMAA-Egyptian-Voice"
REQUEST_ID = os.environ["REQUEST_ID"]
BLOCK_INDEX = int(os.environ.get("BLOCK_INDEX", "0"))

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def audio_output_to_file(result, destination: Path) -> None:
    if isinstance(result, (tuple, list)) and len(result) == 2:
        sample_rate, audio_data = result
        if isinstance(audio_data, np.ndarray):
            sf.write(destination, audio_data.squeeze(), int(sample_rate))
            return
    candidate = (result.get("path") or result.get("name") or result.get("url")) if isinstance(result, dict) else result
    if not isinstance(candidate, str) or not candidate:
        raise TypeError(f"Unexpected NAMAA Space audio response: {type(result).__name__}")
    if candidate.startswith(("http://", "https://")):
        import requests
        response = requests.get(candidate, timeout=180)
        response.raise_for_status()
        downloaded = destination.with_suffix(".download")
        downloaded.write_bytes(response.content)
        candidate = str(downloaded)
    source = Path(candidate)
    if not source.is_file():
        raise FileNotFoundError(f"NAMAA Space returned no accessible audio file: {candidate}")
    shutil.copyfile(source, destination)

def main() -> None:
    story = json.loads(STORY_FILE.read_text(encoding="utf-8"))
    blocks = story["i18n"]["ar"]["blocks"]
    if not 0 <= BLOCK_INDEX < len(blocks):
        raise ValueError(f"Arabic block index out of range: {BLOCK_INDEX}")
    block = blocks[BLOCK_INDEX]
    speaker = block.get("speaker")
    if speaker not in REFERENCE_SOURCES or not block.get("text", "").strip():
        raise ValueError(f"Arabic block {BLOCK_INDEX} is missing an approved speaker or text.")
    reference_source = REFERENCE_SOURCES[speaker]
    if not reference_source.is_file():
        raise FileNotFoundError(f"Approved {speaker} reference audio is missing: {reference_source}")

    with tempfile.TemporaryDirectory(prefix="namaa-ibn-sina-") as temp_dir:
        temp = Path(temp_dir)
        reference = temp / f"{speaker}_reference.wav"
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(reference_source), "-t", "9" if speaker == "karma" else "10",
            "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(reference)
        ], check=True)

        print(f"Connecting to hosted NAMAA Space: {SPACE_ID}", flush=True)
        client = Client(SPACE_ID, hf_token=os.getenv("HF_TOKEN") or None, verbose=True)
        print(f"Generating Arabic block {BLOCK_INDEX} ({speaker}) only...", flush=True)
        result = client.predict(
            block["text"], handle_file(str(reference)),
            0.45 if speaker == "karma" else 0.35,
            0.8, 0, 0.5,
            api_name="/generate_tts_audio",
        )
        wav_path = temp / "namaa_output.wav"
        audio_output_to_file(result, wav_path)
        mp3_path = OUT / f"{BLOCK_INDEX:03d}.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "128k",
            str(mp3_path)
        ], check=True)

    manifest = {
        "version": 1, "story": "ibn-sina", "section": "history", "language": "ar",
        "request_id": REQUEST_ID, "provider": "huggingface-space",
        "model": "NAMAA-Space/NAMAA-Egyptian-TTS",
        "segments": [{
            "block_index": BLOCK_INDEX, "chunk_index": 0, "speaker": speaker,
            "voice": f"magdi-yacoub-{speaker}-reference",
            "provider": "huggingface-space", "model": "NAMAA-Space/NAMAA-Egyptian-TTS",
            "src": mp3_path.name, "audio_sha256": sha256(mp3_path),
            "text": block["text"], "reference_sha256": sha256(reference_source),
        }],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)
    print(f"READY: {mp3_path} ({mp3_path.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    main()
