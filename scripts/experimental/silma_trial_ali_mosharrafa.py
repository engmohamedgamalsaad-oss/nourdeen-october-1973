import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORY = ROOT / "stories/science/016/story.json"
REFDIR = ROOT / "assets/audio/science/magdi-yacoub/ar"
OUT = ROOT / "artifacts/silma-trial/ali-mosharrafa/ar"
VOICES = {
    "narrator": "b65cfd7ce5e44607aedafeea3dbb01e8",
    "karma": "592625f68416462f8b6161ddf5fdbffb",
}
BLOCKS = (0, 1, 2, 5, 8, 18)
MAX_REFERENCE_SECONDS = 7.8


def probe_duration(path):
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(raw)


def prepare_reference(manifest, speaker, voice_id):
    candidates = []
    for row in manifest["segments"]:
        if row.get("speaker") != speaker or row.get("voice") != voice_id:
            continue
        if row.get("provider") != "fish-audio" or not row.get("text", "").strip():
            continue
        source = REFDIR / row["src"]
        if not source.is_file():
            continue
        duration = probe_duration(source)
        if 0 < duration < MAX_REFERENCE_SECONDS:
            candidates.append((duration, row, source))
    if not candidates:
        raise RuntimeError(
            f"No complete {speaker} reference segment under "
            f"{MAX_REFERENCE_SECONDS}s; refusing to crop speech or mismatch ref_text."
        )
    duration, row, source = min(candidates, key=lambda item: item[0])
    wav = OUT / ("reference-" + speaker + ".wav")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(source),
        "-ac", "1", "-ar", "24000", str(wav)
    ], check=True)
    actual = probe_duration(wav)
    if actual >= 8.0:
        raise RuntimeError(f"Reference exceeds SILMA limit: {speaker} {actual:.3f}s")
    print(
        f"REFERENCE {speaker}: source={row['src']} duration={actual:.3f}s "
        f"block={row.get('block_index')} exact_text_chars={len(row['text'])}",
        flush=True,
    )
    return wav, row["text"], row["src"], actual


def main():
    story = json.loads(STORY.read_text(encoding="utf-8"))
    assert story.get("slug") == "ali-mosharafa"
    blocks = story["i18n"]["ar"]["blocks"]
    manifest = json.loads((REFDIR / "manifest.json").read_text(encoding="utf-8"))
    assert manifest.get("story") == "magdi-yacoub"
    OUT.mkdir(parents=True, exist_ok=True)

    refs = {}
    for speaker, voice_id in VOICES.items():
        refs[speaker] = prepare_reference(manifest, speaker, voice_id)

    # Keep colloquial Arabic intact: no forced automatic tashkeel and no
    # automatic number rewriting. The reference transcript is the exact
    # manifest text for the complete, uncut source segment.
    from silma_tts.api import SilmaTTS
    tts = SilmaTTS(device="cpu", enable_normalizer=False, force_tashkeel=False)
    results = []
    for idx in BLOCKS:
        block = blocks[idx]
        speaker, text = block["speaker"], block["text"].strip()
        assert speaker in refs and text
        wav, transcript, source_name, ref_duration = refs[speaker]
        dest = OUT / ("%03d-%s.wav" % (idx, speaker))
        tts.infer(
            ref_file=str(wav), ref_text=transcript, gen_text=text,
            file_wave=str(dest), seed=20261104 + idx, speed=1.0,
            normalize_numbers=False, force_tashkeel=False
        )
        assert dest.exists() and dest.stat().st_size > 2048
        results.append({
            "block": idx, "speaker": speaker, "text": text,
            "file": dest.name, "bytes": dest.stat().st_size,
            "reference_file": source_name, "reference_duration_seconds": ref_duration,
            "forced_tashkeel": False, "automatic_number_normalization": False
        })
        print("CREATED", dest.name, dest.stat().st_size, flush=True)

    (OUT / "trial-report.json").write_text(json.dumps({
        "status": "generated-not-quality-approved",
        "story": "ali-mosharrafa",
        "reference": "magdi-yacoub",
        "production_files_modified": False,
        "engine": "SILMA TTS v1",
        "reference_limit_seconds": MAX_REFERENCE_SECONDS,
        "segments": results
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print("TRIAL COMPLETE", flush=True)


if __name__ == "__main__":
    main()
