#!/usr/bin/env python3
"""Generate exactly one NAMAA Egyptian Arabic voice sample into private staging."""
from __future__ import annotations
import argparse, hashlib, json, os, subprocess, tempfile, urllib.request
from pathlib import Path
from typing import Any

SPACE = "omarelshehy/NAMAA-Egyptian-Voice"
MODEL = "NAMAA-Egyptian-TTS"
ROOT = Path(__file__).resolve().parents[1]
REFERENCE_URLS = {
    "karma": "https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/assets/audio/science/magdi-yacoub/ar/000.mp3",
    "narrator": "https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/assets/audio/science/magdi-yacoub/ar/001.mp3",
}

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def download_reference(speaker: str, destination: Path) -> str:
    request = urllib.request.Request(REFERENCE_URLS[speaker], headers={"User-Agent": "Khaledoon-NAMAA-review-samples/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        audio = response.read()
    if len(audio) < 512:
        raise RuntimeError(f"Reference recording for {speaker} is empty or invalid.")
    destination.write_bytes(audio)
    return sha256(audio)

def output_path(value: Any) -> Path:
    if isinstance(value, (str, Path)):
        candidate = Path(value)
        if candidate.is_file():
            return candidate
    if isinstance(value, dict):
        for key in ("path", "name"):
            if value.get(key):
                try: return output_path(value[key])
                except (FileNotFoundError, TypeError): pass
    if isinstance(value, (tuple, list)):
        for item in value:
            try: return output_path(item)
            except (FileNotFoundError, TypeError): pass
    raise FileNotFoundError(f"NAMAA returned no local audio file: {value!r}")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--story", type=Path, required=True)
    parser.add_argument("--block-index", type=int, required=True)
    parser.add_argument("--request-id", required=True)
    args = parser.parse_args()
    if args.block_index not in (0, 1):
        raise SystemExit("Only Ibn Sina's two approved voice-sample blocks (0 and 1) are allowed.")
    story_path = args.story if args.story.is_absolute() else ROOT / args.story
    story = json.loads(story_path.read_text(encoding="utf-8"))
    if story.get("format") != "KHALEDOON_STORY" or story.get("section") != "history" or story.get("slug") != "ibn-sina":
        raise SystemExit("NAMAA sample workflow is restricted to the Ibn Sina story.")
    blocks = story.get("i18n", {}).get("ar", {}).get("blocks", [])
    if args.block_index >= len(blocks):
        raise SystemExit("Requested sample block does not exist.")
    block = blocks[args.block_index]
    speaker = block.get("speaker")
    expected_speaker = "karma" if args.block_index == 0 else "narrator"
    if speaker != expected_speaker:
        raise SystemExit("Sample block speaker does not match the approved Karma/Narrator order.")
    text = " ".join(str(block.get("text") or "").split())
    if not text or len(text) > 300:
        raise SystemExit("NAMAA sample text must contain 1–300 characters.")
    out_dir = ROOT / ".audio-staging" / "history" / "ibn-sina" / "ar"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{args.block_index:03d}.mp3"
    destination = out_dir / filename
    voice = f"namaa-{speaker}"
    with tempfile.TemporaryDirectory(prefix="khaledoon-namaa-") as temp:
        temp_dir = Path(temp)
        reference = temp_dir / f"magdi-yacoub-{speaker}-reference.mp3"
        reference_hash = download_reference(speaker, reference)
        from gradio_client import Client
        token = os.environ.get("HF_TOKEN", "").strip() or None
        client = Client(SPACE, token=token, verbose=False)
        result = client.predict(
            text_input=text,
            audio_prompt_path_input=str(reference),
            exaggeration_input=0.5,
            temperature_input=0.8,
            seed_num_input=0,
            cfgw_input=0.5,
            api_name="/generate_tts_audio",
        )
        generated = output_path(result)
        converted = temp_dir / "sample.mp3"
        subprocess.run(
            ["ffmpeg", "-nostdin", "-y", "-i", str(generated), "-vn", "-codec:a", "libmp3lame", "-q:a", "3", str(converted)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90,
        )
        audio = converted.read_bytes()
        if len(audio) < 512:
            raise RuntimeError("NAMAA returned an empty or invalid audio sample.")
        destination.write_bytes(audio)
    audio_hash = sha256(destination.read_bytes())
    text_hash = sha256(json.dumps(
        [MODEL, voice, text, reference_hash, "exaggeration=0.5", "temperature=0.8", "cfgw=0.5"],
        ensure_ascii=False, separators=(",", ":"),
    ).encode("utf-8"))
    manifest = {
        "version": 1, "engine": "namaa-egyptian-tts", "story": "ibn-sina",
        "section": "history", "language": "ar",
        "segments": [{
            "block_index": args.block_index, "chunk_index": 0, "speaker": speaker,
            "voice": voice, "provider": "namaa", "model": MODEL, "src": filename,
            "hash": text_hash, "audio_sha256": audio_hash, "text": text,
            "reference_story": "magdi-yacoub", "reference_sha256": reference_hash,
            "request_id": args.request_id,
        }],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"GENERATED NAMAA {speaker} block={args.block_index} bytes={len(audio)} sha256={audio_hash}")
    print(f"PRIVATE_STAGING {destination.relative_to(ROOT)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
