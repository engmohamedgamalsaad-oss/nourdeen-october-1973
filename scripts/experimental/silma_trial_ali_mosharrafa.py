import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORY = ROOT / "stories/science/016/story.json"
REFDIR = ROOT / "assets/audio/science/magdi-yacoub/ar"
OUT = ROOT / "artifacts/silma-trial/ali-mosharrafa/ar"
VOICES = {"narrator": (1, "b65cfd7ce5e44607aedafeea3dbb01e8"),
          "karma": (0, "592625f68416462f8b6161ddf5fdbffb")}
BLOCKS = (0, 1, 2, 5, 8, 18)

def main():
    story = json.loads(STORY.read_text(encoding="utf-8"))
    assert story.get("slug") == "ali-mosharafa"
    blocks = story["i18n"]["ar"]["blocks"]
    manifest = json.loads((REFDIR / "manifest.json").read_text(encoding="utf-8"))
    assert manifest.get("story") == "magdi-yacoub"
    OUT.mkdir(parents=True, exist_ok=True)
    refs = {}
    for speaker, (idx, voice_id) in VOICES.items():
        rows = [x for x in manifest["segments"] if x.get("block_index") == idx]
        assert len(rows) == 1
        row = rows[0]
        assert row.get("speaker") == speaker and row.get("voice") == voice_id
        assert row.get("provider") == "fish-audio"
        wav = OUT / ("reference-" + speaker + ".wav")
        subprocess.run(["ffmpeg","-y","-loglevel","error","-i",str(REFDIR / row["src"]),
                        "-ac","1","-ar","24000",str(wav)],check=True)
        refs[speaker] = (wav, row["text"])
    from silma_tts.api import SilmaTTS
    tts = SilmaTTS(device="cpu", enable_normalizer=True, force_tashkeel=True)
    results = []
    for idx in BLOCKS:
        block = blocks[idx]
        speaker, text = block["speaker"], block["text"].strip()
        assert speaker in refs and text
        wav, transcript = refs[speaker]
        dest = OUT / ("%03d-%s.wav" % (idx, speaker))
        tts.infer(ref_file=str(wav), ref_text=transcript, gen_text=text,
                  file_wave=str(dest), seed=20261104+idx, speed=1.0,
                  normalize_numbers=True, force_tashkeel=True)
        assert dest.exists() and dest.stat().st_size > 2048
        results.append({"block":idx,"speaker":speaker,"text":text,"file":dest.name,
                        "bytes":dest.stat().st_size})
        print("CREATED", dest.name, dest.stat().st_size, flush=True)
    (OUT / "trial-report.json").write_text(json.dumps({
        "status":"generated","story":"ali-mosharrafa","reference":"magdi-yacoub",
        "production_files_modified":False,"engine":"SILMA TTS v1","segments":results
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print("TRIAL COMPLETE",flush=True)

if __name__ == "__main__":
    main()
