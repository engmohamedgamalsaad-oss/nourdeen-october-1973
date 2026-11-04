#!/usr/bin/env python3
"""Isolated SILMA TTS trial for Ali Mustafa Mosharrafa.

Uses approved narrator B and Karma reference recordings from Magdi Yacoub.
Reads the published story but writes generated WAVs only to artifacts/.
No production story, audio, or manifest is modified.
"""
from __future__ import annotations
import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORY_FILE = ROOT / "stories/science/016/story.json"
REFERENCE_DIR = ROOT / "assets/audio/science/magdi-yacoub/ar"
REFERENCE_MANIFEST = REFERENCE_DIR / "manifest.json"
OUTPUT_DIR = ROOT / "artifacts/silma-trial/ali-mosharrafa/ar"

VOICES = {
    "karma": {"block": 0, "voice": "592625f68416462f8b6161ddf5fdbffb"},
    "narrator": {"block": 1, "voice": "b65cfd7ce5e44607aedafeea3dbb01e8"},
}
TRIAL_BLOCKS = (0, 1, 2, 5, 18)


def read_json(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return obj


def to_wav(source: Path, destination: Path) -> None:
    if not source.is_file() or source.stat().st_size < 512:
        raise FileNotFoundError(f"Missing/invalid approved reference audio: {source}")
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-vn", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(destination)
    ], check=True, timeout=90)
    if not destination.is_file() or destination.stat().st_size < 1024:
        raise RuntimeError(f"Invalid converted reference: {destination}")


def main() -> None:
    story = read_json(STORY_FILE)
    if story.get("format") != "KHALEDOON_STORY" or story.get("slug") != "ali-mosharafa" or story.get("section") != "science":
        raise RuntimeError("Expected Ali Mustafa Mosharrafa story (science/016); stopping.")

    ar = story.get("i18n", {}).get("ar", {})
    blocks = ar.get("blocks", [])
    if not blocks or max(TRIAL_BLOCKS) >= len(blocks):
        raise RuntimeError("Arabic story blocks are missing or incomplete.")

    ref = read_json(REFERENCE_MANIFEST)
    if ref.get("story") != "magdi-yacoub" or ref.get("language") != "ar":
        raise RuntimeError("Expected approved Magdi Yacoub Arabic reference manifest.")
    segments = ref.get("segments", [])
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ref_text, ref_wav = {}, {}
    for speaker, spec in VOICES.items():
        matches = [s for s in segments if s.get("block_index") == spec["block"]]
        if len(matches) != 1:
            raise RuntimeError(f"Expected one {speaker} reference segment.")
        s = matches[0]
        if s.get("speaker") != speaker or s.get("provider") != "fish-audio" or s.get("voice") != spec["voice"]:
            raise RuntimeError(f"Reference voice identity mismatch: {speaker}")
        if not isinstance(s.get("text"), str) or not s["text"].strip():
            raise RuntimeError(f"Reference transcript missing: {speaker}")
        filename = s.get("src")
        if not isinstance(filename, str) or Path(filename).name != filename:
            raise RuntimeError(f"Unsafe reference filename: {speaker}")
        wav = OUTPUT_DIR / f"reference-{speaker}.wav"
        to_wav(REFERENCE_DIR / filename, wav)
        ref_text[speaker], ref_wav[speaker] = s["text"], wav

    selected = []
    for i in TRIAL_BLOCKS:
        block = blocks[i]
        speaker = block.get("speaker")
        text = block.get("text")
        if speaker not in VOICES or not isinstance(text, str) or not text.strip():
            raise RuntimeError(f"Invalid story block {i}.")
        selected.append((i, speaker, text.strip()))

    from silma_tts.api import SilmaTTS
    print("Loading SILMA TTS v1 on CPU; first run may download model weights.", flush=True)
    tts = SilmaTTS(device="cpu", enable_normalizer=True, force_tashkeel=True)

    outputs = []
    for i, speaker, text in selected:
        output = OUTPUT_DIR / f"{i:03d}-{speaker}.wav"
        print(f"Generating story block {i} ({speaker})...", flush=True)
        _, sample_rate, _ = tts.infer(
            ref_file=str(ref_wav[speaker]), ref_text=ref_text[speaker],
            gen_text=text, file_wave=str(output), seed=20261104 + i,
            speed=1.0, normalize_numbers=True, force_tashkeel=True,
        )
        if not output.is_file() or output.stat().st_size < 2048:
            raise RuntimeError(f"No usable generated WAV: {output}")
        outputs.append({
            "block_index": i, "speaker": speaker, "text": text,
            "reference_story": "magdi-yacoub",
            "reference_audio": f"reference-{speaker}.wav",
            "reference_voice_id": VOICES[speaker]["voice"],
            "reference_transcript": ref_text[speaker],
            "engine": "SILMA TTS v1", "sample_rate": int(sample_rate),
            "output": output.name, "bytes": output.stat().st_size,
        })
        print(f"CREATED {output.name}: {output.stat().st_size} bytes", flush=True)

    report = {
        "status": "generated", "trial": "silma-ali-mosharrafa-ar",
        "production_files_modified": False, "story": "ali-mosharrafa",
        "story_path": "stories/science/016/story.json",
        "reference_story": "magdi-yacoub", "device": "cpu",
        "model": "SILMA TTS v1", "segments": outputs,
        "note": "Experimental artifacts only; production audio and manifests were not changed."
    }
    (OUTPUT_DIR / "trial-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SILMA ALI MOSHARAFFA TRIAL COMPLETE.", flush=True)


if __name__ == "__main__":
    main()
