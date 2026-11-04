#!/usr/bin/env python3
"""Isolated SILMA TTS proof of concept for Farouk El-Baz.

Reads the published Farouk El-Baz story and the already-approved Fish Audio
reference clips from Magdi Yacoub. Writes ONLY to artifacts/silma-trial/.
Never edits story JSON, published audio, or any production manifest.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORY_DIR = ROOT / "stories/science/012"
STORY_FILE = STORY_DIR / "story.json"
DATA_FILE = STORY_DIR / "data.json"
REFERENCE_DIR = ROOT / "assets/audio/science/magdi-yacoub/ar"
REFERENCE_MANIFEST = REFERENCE_DIR / "manifest.json"
OUTPUT_DIR = ROOT / "artifacts/silma-trial/farouk-el-baz/ar"

EXPECTED_VOICES = {
    "karma": "592625f68416462f8b6161ddf5fdbffb",
    "narrator": "b65cfd7ce5e44607aedafeea3dbb01e8",
}
REFERENCE_BLOCKS = {"karma": 0, "narrator": 1}
TRIAL_BLOCKS = (0, 1, 2)
EXPECTED_SPEAKERS = ("karma", "narrator", "karma")


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def convert_reference(source: Path, destination: Path) -> None:
    if not source.is_file() or source.stat().st_size < 512:
        raise FileNotFoundError(f"Missing/invalid approved reference audio: {source}")
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", "24000",
            "-c:a", "pcm_s16le", str(destination),
        ],
        check=True,
        timeout=90,
    )
    if not destination.is_file() or destination.stat().st_size < 1024:
        raise RuntimeError(f"Reference conversion produced no usable WAV: {destination}")


def main() -> None:
    package = read_json(STORY_FILE)
    metadata = read_json(DATA_FILE)
    if (
        package.get("format") != "KHALEDOON_STORY"
        or package.get("section") != "science"
        or package.get("slug") != "farouk-el-baz"
        or metadata.get("published") is not True
    ):
        raise RuntimeError("Farouk El-Baz is not the expected published story; stopping.")

    manifest = read_json(REFERENCE_MANIFEST)
    if manifest.get("story") != "magdi-yacoub" or manifest.get("language") != "ar":
        raise RuntimeError("The approved reference manifest is not Magdi Yacoub Arabic.")

    reference_segments = manifest.get("segments")
    if not isinstance(reference_segments, list):
        raise RuntimeError("Reference manifest has no segment list.")

    reference_text: dict[str, str] = {}
    reference_wav: dict[str, Path] = {}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for speaker, block_index in REFERENCE_BLOCKS.items():
        matches = [
            item for item in reference_segments
            if isinstance(item, dict) and item.get("block_index") == block_index
        ]
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one reference segment for {speaker}.")
        segment = matches[0]
        if (
            segment.get("speaker") != speaker
            or segment.get("provider") != "fish-audio"
            or segment.get("voice") != EXPECTED_VOICES[speaker]
            or not isinstance(segment.get("text"), str)
            or not segment["text"].strip()
        ):
            raise RuntimeError(f"Reference identity/transcript mismatch for {speaker}.")

        src_name = segment.get("src")
        if not isinstance(src_name, str) or Path(src_name).name != src_name:
            raise RuntimeError(f"Unsafe reference audio filename for {speaker}.")
        source = REFERENCE_DIR / src_name
        wav_path = OUTPUT_DIR / f"reference-{speaker}.wav"
        convert_reference(source, wav_path)
        reference_text[speaker] = segment["text"]
        reference_wav[speaker] = wav_path

    translations = package.get("i18n", {})
    arabic = translations.get("ar", {}) if isinstance(translations, dict) else {}
    blocks = arabic.get("blocks", []) if isinstance(arabic, dict) else []
    if len(blocks) <= max(TRIAL_BLOCKS):
        raise RuntimeError("Farouk El-Baz Arabic story has too few blocks.")

    selected = []
    for index, expected_speaker in zip(TRIAL_BLOCKS, EXPECTED_SPEAKERS):
        block = blocks[index]
        if not isinstance(block, dict) or block.get("speaker") != expected_speaker:
            raise RuntimeError(f"Unexpected speaker at Farouk block {index}.")
        text = block.get("text")
        if not isinstance(text, str) or not text.strip():
            raise RuntimeError(f"Empty Arabic text at Farouk block {index}.")
        selected.append((index, expected_speaker, text.strip()))

    # Import only after all source files and safety checks have passed.
    from silma_tts.api import SilmaTTS

    print("Loading SILMA TTS v1 on CPU. First run downloads model assets; output stays in the trial artifact folder.", flush=True)
    tts = SilmaTTS(device="cpu", enable_normalizer=True, force_tashkeel=True)

    results = []
    for index, speaker, text in selected:
        output = OUTPUT_DIR / f"{index:03d}-{speaker}.wav"
        print(f"Generating Farouk block {index} ({speaker})...", flush=True)
        _, sample_rate, _ = tts.infer(
            ref_file=str(reference_wav[speaker]),
            ref_text=reference_text[speaker],
            gen_text=text,
            file_wave=str(output),
            seed=20261104 + index,
            speed=1.0,
            normalize_numbers=True,
            force_tashkeel=True,
        )
        if not output.is_file() or output.stat().st_size < 2048:
            raise RuntimeError(f"SILMA did not produce a valid WAV: {output}")
        results.append({
            "block_index": index,
            "speaker": speaker,
            "source_text": text,
            "reference_story": "magdi-yacoub",
            "reference_audio": f"reference-{speaker}.wav",
            "reference_voice_id": EXPECTED_VOICES[speaker],
            "reference_transcript": reference_text[speaker],
            "engine": "SILMA TTS v1",
            "sample_rate": int(sample_rate),
            "output": output.name,
            "bytes": output.stat().st_size,
        })
        print(f"CREATED {output.relative_to(ROOT)} ({output.stat().st_size} bytes)", flush=True)

    report = {
        "status": "generated",
        "trial": "silma-farouk-el-baz-arabic",
        "production_files_modified": False,
        "story": "farouk-el-baz",
        "story_path": "stories/science/012/story.json",
        "reference_story": "magdi-yacoub",
        "reference_manifest": "assets/audio/science/magdi-yacoub/ar/manifest.json",
        "device": "cpu",
        "model": "SILMA TTS v1",
        "license": "Apache-2.0 model weights; MIT code",
        "segments": results,
        "note": "Generated files are experimental artifacts only; no production story/audio/manifest was changed.",
    }
    (OUTPUT_DIR / "trial-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SILMA TRIAL COMPLETE. Production files were not modified.", flush=True)


if __name__ == "__main__":
    main()
