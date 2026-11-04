#!/usr/bin/env python3
"""A/B narrator pronunciation test for Ali Mostafa Mosharafa only.

Keeps the approved narrator voice. Compares the same Arabic passage without
diacritics and with selective human-authored Arabic diacritics. No story JSON
or visible story content is modified.
"""
import hashlib, json, os, subprocess, urllib.request
from pathlib import Path

OUT = Path("artifacts/ali-mosharrafa-narrator-pronunciation-test")
VOICE_ID = "b65cfd7ce5e44607aedafeea3dbb01e8"
MODEL = "s2.1-pro-free"
API = "https://api.fish.audio/v1/tts"

BASELINE = (
    "في دمياط، وُلد علي مصطفى مشرفة. وبعد سنوات، سافر إلى إنجلترا، "
    "ودرس في جامعة نوتنغهام، ثم في كلية الملك بلندن. "
    "واهتم بدراسة نظرية الكم والنسبية، وتبادل المراسلات مع ألبرت أينشتاين. "
    "ومن تلاميذه سميرة موسى، كما شارك محمد مرسي أحمد في نشر كتاب الخوارزمي في الجبر. "
    "واهتم أيضًا بالموسيقى، وأسهم في تأسيس جمعية محبي الموسيقى المصرية."
)

SELECTIVELY_VOCALIZED = (
    "في دِمياط، وُلِدَ عَلِيّ مُصْطَفى مُشَرَّفَة. وبعدَ سنواتٍ، سافرَ إلى إنجلترا، "
    "ودَرَسَ في جامعةِ نوتِنْغْهام، ثم في كُلِّيَّةِ المَلِكِ بلَنْدَن. "
    "واهتمَّ بدراسةِ نَظَرِيَّةِ الكَمّ والنِّسْبِيَّة، وتبادَلَ المُراسَلاتِ مع أَلْبِرْت أَيْنْشْتايْن. "
    "ومن تلاميذِه سَميرة موسى، كما شاركَ مُحَمَّد مُرْسي أَحْمَد في نَشْرِ كتابِ الخَوارِزْمي في الجَبْر. "
    "واهتمَّ أيضًا بالموسيقى، وأسهمَ في تأسيسِ جَمْعِيَّةِ مُحِبِّي الموسيقى المِصْرِيَّة."
)

def request_audio(text, dest):
    key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
    if not key:
        raise RuntimeError("FISH_AUDIO_API_KEY is not configured in repository Actions secrets.")
    payload = {
        "text": text,
        "reference_id": VOICE_ID,
        "format": "mp3",
        "normalize": False,
        "temperature": 0.35,
        "top_p": 0.7,
        "prosody": {"speed": 0.95},
        "condition_on_previous_chunks": True,
        "chunk_length": 300,
        "latency": "normal"
    }
    req = urllib.request.Request(API, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST", headers={"Authorization": "Bearer " + key,
        "Content-Type": "application/json", "model": MODEL})
    with urllib.request.urlopen(req, timeout=180) as response:
        audio = response.read()
    if len(audio) < 512 or not (audio.startswith(b"ID3") or audio.startswith(b"\xff")):
        raise RuntimeError("Fish Audio returned an empty or invalid MP3 payload.")
    dest.write_bytes(audio)

def duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip())

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    samples = [
        ("01-baseline-original-text.mp3", BASELINE, "original_unvocalized"),
        ("02-selective-arabic-diacritics.mp3", SELECTIVELY_VOCALIZED, "selective_manual_diacritics")
    ]
    report = {"story": "ali-mosharafa", "voice_id": VOICE_ID, "model": MODEL,
              "test": "same_text_meaning_and_same_voice_ab_test",
              "settings": {"normalize": False, "temperature": 0.35, "top_p": 0.7,
                           "prosody.speed": 0.95, "condition_on_previous_chunks": True},
              "visible_story_modified": False, "samples": []}
    for filename, text, variant in samples:
        path = OUT / filename
        request_audio(text, path)
        report["samples"].append({"file": filename, "variant": variant,
            "duration_seconds": round(duration(path), 2),
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "text": text})
        print(f"CREATED {filename}")
    (OUT / "test-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("NARRATOR_PRONUNCIATION_AB_TEST_COMPLETE")

if __name__ == "__main__":
    main()
