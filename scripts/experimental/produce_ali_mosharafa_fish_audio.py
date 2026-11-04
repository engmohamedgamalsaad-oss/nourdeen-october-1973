#!/usr/bin/env python3
"""Isolated Arabic audio production for Ali Mostafa Mosharafa.

Uses the already-approved Fish Audio narrator/Karma identities. Arabic audio text
is prepared separately with text2tashkeel/rawi-ensemble; visible story text is
never modified. All outputs stay under artifacts/ and are uploaded by Actions.
"""
from __future__ import annotations
import asyncio, hashlib, json, os, re, subprocess, urllib.request
from pathlib import Path
from text2tashkeel import Diacritizer

ROOT = Path(__file__).resolve().parents[2]
STORY = ROOT / "stories/science/016/story.json"
OUT = ROOT / "artifacts/ali-mosharrafa-audio/ar"
VOICE_IDS = {
    "narrator": "b65cfd7ce5e44607aedafeea3dbb01e8",
    "karma": "592625f68416462f8b6161ddf5fdbffb",
}
MODEL = "s2.1-pro-free"
API = "https://api.fish.audio/v1/tts"

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def split_text(text: str, limit: int = 360) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.!?؟؛])\s+", text)
    result, current = [], ""
    for sentence in sentences:
        if len(sentence) > limit:
            words, pieces, piece = sentence.split(), [], ""
            for word in words:
                candidate = (piece + " " + word).strip()
                if piece and len(candidate) > limit:
                    pieces.append(piece); piece = word
                else: piece = candidate
            if piece: pieces.append(piece)
        else: pieces = [sentence]
        for piece in pieces:
            candidate = (current + " " + piece).strip()
            if current and len(candidate) > limit:
                result.append(current); current = piece
            else: current = candidate
    if current: result.append(current)
    return result

def fish_request(text: str, voice_id: str, dest: Path):
    key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
    if not key:
        raise RuntimeError("FISH_AUDIO_API_KEY is not configured in repository Actions secrets.")
    payload = json.dumps({"text": text, "reference_id": voice_id, "format": "mp3"},
                         ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API, data=payload, method="POST", headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "model": MODEL,
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        audio = response.read()
    if len(audio) < 512 or not audio.startswith(b"ID3") and not audio.startswith(b"\xff"):
        raise RuntimeError("Fish Audio returned an empty or invalid MP3 payload.")
    dest.write_bytes(audio)

def probe(path: Path) -> float:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(raw)

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    story = json.loads(STORY.read_text(encoding="utf-8"))
    assert story.get("slug") == "ali-mosharafa" and story.get("section") == "science"
    blocks = story["i18n"]["ar"]["blocks"]
    diacritizer = Diacritizer("rawi-ensemble")
    manifest_segments, pronunciation = [], {}
    ordered_files = []
    for block_index, block in enumerate(blocks):
        speaker = block.get("speaker")
        visible = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
        if speaker not in VOICE_IDS or not visible:
            continue
        # Rawi is used only to prepare speech text. The source story stays unchanged.
        speech_text = diacritizer.diacritize(visible)
        if not isinstance(speech_text, str) or not speech_text.strip():
            raise RuntimeError(f"Arabic diacritization returned empty text at block {block_index}.")
        pronunciation[str(block_index)] = speech_text
        chunks = split_text(speech_text)
        for chunk_index, chunk in enumerate(chunks):
            filename = f"{block_index:03d}.mp3" if chunk_index == 0 else f"{block_index:03d}-{chunk_index:02d}.mp3"
            dest = OUT / filename
            fish_request(chunk, VOICE_IDS[speaker], dest)
            duration = probe(dest)
            if duration <= 0.15:
                raise RuntimeError(f"Audio segment unexpectedly short: {filename}")
            digest = hashlib.sha256(dest.read_bytes()).hexdigest()
            manifest_segments.append({
                "block_index": block_index, "chunk_index": chunk_index,
                "speaker": speaker, "voice": VOICE_IDS[speaker],
                "provider": "fish-audio", "model": MODEL, "src": filename,
                "duration_seconds": round(duration, 3), "sha256": digest,
                "visible_text": visible, "audio_text": chunk,
            })
            ordered_files.append(dest)
            print(f"CREATED block={block_index} chunk={chunk_index} speaker={speaker} duration={duration:.2f}s")
    if not manifest_segments:
        raise RuntimeError("No speakable Arabic story blocks were found.")
    (OUT / "audio-pronunciation.json").write_text(json.dumps({
        "version": 1, "story": "ali-mosharafa", "language": "ar",
        "diacritizer": "text2tashkeel/rawi-ensemble", "blocks": pronunciation
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps({
        "version": 1, "engine": "fish-audio+s2.1-pro-free",
        "story": "ali-mosharafa", "section": "science", "language": "ar",
        "voice_ids": VOICE_IDS, "segments": manifest_segments
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Concatenate all generated clips in story order, with short clean pauses.
    concat = OUT / "concat.txt"
    silence = OUT / "pause.mp3"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", "0.35", "-q:a", "9", str(silence)])
    entries = []
    for i, audio_file in enumerate(ordered_files):
        entries.append(f"file '{audio_file.name}'")
        if i != len(ordered_files)-1:
            entries.append("file 'pause.mp3'")
    concat.write_text("\n".join(entries) + "\n", encoding="utf-8")
    raw_final = OUT / "ali-mosharafa-raw.mp3"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
         "-c", "copy", str(raw_final)])
    final = OUT / "ali-mosharafa-ar.mp3"
    run(["ffmpeg", "-y", "-i", str(raw_final), "-af",
         "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000",
         "-codec:a", "libmp3lame", "-b:a", "128k", str(final)])
    (OUT / "production-report.json").write_text(json.dumps({
        "status": "generated_pending_human_listening_review",
        "story": "ali-mosharafa", "language": "ar",
        "blocks": len(pronunciation), "segments": len(manifest_segments),
        "voices": VOICE_IDS, "diacritizer": "text2tashkeel/rawi-ensemble",
        "final_file": final.name, "final_duration_seconds": round(probe(final), 2),
        "visible_story_modified": False,
        "audio_postprocessing": ["350ms pauses between chunks", "EBU-style loudness normalization", "24kHz resampling"],
        "human_listening_review": "required"
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("AUDIO_PRODUCTION_COMPLETE")

if __name__ == "__main__":
    asyncio.run(main())
