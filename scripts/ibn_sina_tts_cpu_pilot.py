#!/usr/bin/env python3
"""One-story CPU TTS pilot for Khaledoon: Arabic (NAMAA) + English (Chatterbox).

Uses only the approved Magdi Yacoub narrator/Karma reference clips already in
this repository. Generates four short preview clips for Ibn Sina; it does not
publish audio or modify story content.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import soundfile as sf
import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "ibn-sina-tts-pilot"
REFS = OUT / "references"
OUT.mkdir(parents=True, exist_ok=True)
REFS.mkdir(parents=True, exist_ok=True)

torch.set_num_threads(min(4, os.cpu_count() or 1))
torch.manual_seed(2026)

REFERENCE_SOURCES = {
    "karma": ROOT / "assets/audio/science/magdi-yacoub/ar/000.mp3",
    "narrator": ROOT / "assets/audio/science/magdi-yacoub/ar/001.mp3",
}

TEXTS = {
    "ar": {
        "narrator": "الحكاية تبدأ مع ابن سينا، واسمه أبو علي الحسين بن عبد الله بن سينا. اتولد حوالي سنة تسعمية وتمانين ميلادية في منطقة بخارى، اللي موجودة دلوقتي في أوزبكستان. واتعرف بعد كده بلقب الشيخ الرئيس.",
        "karma": "يا ترى إزاي عالم عاش من أكتر من ألف سنة قدر يسيب أثر لسه بنتكلم عنه لحد النهارده؟",
    },
    "en": {
        "narrator": "The story begins with Ibn Sina, whose full name was Abu Ali al-Husayn ibn Abd Allah ibn Sina. He was born around 980 CE in the region of Bukhara, in present-day Uzbekistan. Later, he became known as al-Shaykh al-Ra’is.",
        "karma": "How could a scholar who lived more than a thousand years ago leave an influence that people still discuss today?",
    },
}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def prepare_reference(speaker: str) -> Path:
    source = REFERENCE_SOURCES[speaker]
    if not source.is_file():
        raise FileNotFoundError(f"Approved reference clip missing: {source}")
    target = REFS / f"{speaker}_reference.wav"
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(source), "-t", "10" if speaker == "narrator" else "9",
        "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(target)
    ], check=True)
    return target

def save_audio(audio: torch.Tensor, path: Path, sample_rate: int) -> None:
    data = audio.squeeze().detach().cpu().numpy()
    sf.write(path, data, sample_rate, subtype="PCM_16")
    mp3 = path.with_suffix(".mp3")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(path), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)
    ], check=True)

def main() -> None:
    started = time.time()
    refs = {speaker: prepare_reference(speaker) for speaker in ("narrator", "karma")}
    print("Loading official Chatterbox multilingual base model on CPU...", flush=True)
    source_dir = Path(os.environ["NAMAA_SOURCE_DIR"])
    if not (source_dir / "src/chatterbox/mtl_tts.py").is_file():
        raise FileNotFoundError(f"NAMAA-compatible Chatterbox source missing: {source_dir}")
    sys.path.insert(0, str(source_dir))
    from src.chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")

    records = []
    # English uses the official multilingual base checkpoint.
    for speaker in ("narrator", "karma"):
        print(f"Generating English preview for {speaker}...", flush=True)
        audio = model.generate(
            TEXTS["en"][speaker], language_id="en",
            audio_prompt_path=str(refs[speaker]),
            exaggeration=0.35 if speaker == "narrator" else 0.45,
            cfg_weight=0.5, temperature=0.8,
        )
        path = OUT / f"en_{speaker}.wav"
        save_audio(audio, path, model.sr)
        records.append({
            "language": "en", "speaker": speaker, "text": TEXTS["en"][speaker],
            "wav": path.name, "mp3": path.with_suffix(".mp3").name,
            "sha256": sha256(path),
        })
        del audio

    # Arabic uses NAMAA's Egyptian fine-tuned T3 weights on the same
    # multilingual Chatterbox architecture and the same approved voice refs.
    print("Downloading NAMAA Egyptian TTS checkpoint...", flush=True)
    namaa_dir = Path(snapshot_download(
        repo_id="NAMAA-Space/NAMAA-Egyptian-TTS",
        repo_type="model",
        allow_patterns=["t3_mtl23ls_v2.safetensors"],
    ))
    namaa_state = load_file(str(namaa_dir / "t3_mtl23ls_v2.safetensors"), device="cpu")
    model.t3.load_state_dict(namaa_state, strict=True)
    model.t3.to("cpu").eval()

    for speaker in ("narrator", "karma"):
        print(f"Generating Egyptian Arabic preview for {speaker}...", flush=True)
        audio = model.generate(
            TEXTS["ar"][speaker], language_id="ar",
            audio_prompt_path=str(refs[speaker]),
            exaggeration=0.35 if speaker == "narrator" else 0.45,
            cfg_weight=0.5, temperature=0.8,
        )
        path = OUT / f"ar_{speaker}.wav"
        save_audio(audio, path, model.sr)
        records.append({
            "language": "ar", "speaker": speaker, "text": TEXTS["ar"][speaker],
            "wav": path.name, "mp3": path.with_suffix(".mp3").name,
            "sha256": sha256(path),
        })
        del audio

    manifest = {
        "story": "history/ibn-sina",
        "scope": "four short preview clips only; not publish-ready",
        "models": {
            "english": "ResembleAI/Chatterbox multilingual base",
            "arabic": "NAMAA-Space/NAMAA-Egyptian-TTS (T3 fine-tune)",
        },
        "device": "cpu",
        "reference_sources": {
            speaker: str(path.relative_to(ROOT)) for speaker, path in REFERENCE_SOURCES.items()
        },
        "reference_sha256": {speaker: sha256(path) for speaker, path in refs.items()},
        "clips": records,
        "elapsed_seconds": round(time.time() - started, 2),
    }
    (OUT / "pilot_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)

if __name__ == "__main__":
    main()
