"""Audio helpers: reference conversion, tensor normalisation, MP3 encoding."""
from __future__ import annotations

import subprocess

from .config import SAMPLE_RATE

MAX_MP3_BYTES = 13_500_000  # matches the story-audio-worker upload limit


def convert_reference(src_path: str, dst_wav: str) -> str:
    """Convert a reference recording to mono 24 kHz PCM WAV (same as the listen test)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", src_path, "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", dst_wav],
        check=True,
        capture_output=True,
    )
    return dst_wav


def as_numpy_audio(result):
    """Normalise whatever ``model.generate`` returns into (float32 1-D array, sample_rate)."""
    import numpy as np

    sample_rate = SAMPLE_RATE
    audio = result
    if isinstance(result, dict):
        audio = result.get("audio", result.get("waveform", result.get("samples")))
        sample_rate = int(result.get("sample_rate", result.get("sr", sample_rate)))
    elif isinstance(result, (tuple, list)) and len(result) >= 2 and isinstance(result[1], (int, float)):
        audio, sample_rate = result[0], int(result[1])
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    audio = np.asarray(audio, dtype=np.float32).squeeze()
    if audio.ndim != 1 or audio.size == 0 or not np.isfinite(audio).all():
        raise ValueError("Generated audio is empty, not mono, or contains invalid values.")
    if sample_rate != SAMPLE_RATE:
        raise ValueError(f"Unexpected sample rate {sample_rate}; expected {SAMPLE_RATE}.")
    return audio, sample_rate


def encode_mp3(audio, sample_rate: int, stem: str) -> bytes:
    """Write a WAV, encode it to 128 kbps MP3 with ffmpeg and return the MP3 bytes."""
    import soundfile as sf

    wav_path, mp3_path = f"{stem}.wav", f"{stem}.mp3"
    sf.write(wav_path, audio, sample_rate)
    subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", mp3_path],
        check=True,
        capture_output=True,
    )
    with open(mp3_path, "rb") as handle:
        data = handle.read()
    if not data or len(data) > MAX_MP3_BYTES:
        raise ValueError("Generated MP3 is empty or exceeds the worker upload limit.")
    return data
