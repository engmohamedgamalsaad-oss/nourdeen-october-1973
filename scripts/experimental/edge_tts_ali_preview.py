#!/usr/bin/env python3
import asyncio
import subprocess
from pathlib import Path
import edge_tts

OUT = Path("artifacts/ali-mosharafa-edge-preview")
OUT.mkdir(parents=True, exist_ok=True)

LINES = [
    ("narrator", "في بيت مصري بسيط، اتولد علي مصطفى مشرفة سنة ألف وتسعمية. ومن صغره كان بيحب يسأل ويفهم، وما كانش يكتفي بمعرفة الإجابة؛ كان دايمًا عايز يعرف السبب."),
    ("karma", "يعني يا ترى كان بيحب العلوم من وهو صغير؟ وإيه اللي خلاه يهتم بالفيزياء بالذات؟"),
    ("narrator", "أيوه يا كارما. مع الوقت، بقى عنده شغف كبير بالرياضيات والفيزياء. اجتهد في دراسته، وسافر يكمل تعليمه في إنجلترا، وهناك تميز في أبحاثه العلمية."),
    ("karma", "طب هو كان عالم كبير وبس، ولا كان بيحاول يخلي العلم مفيد للناس كمان؟"),
    ("narrator", "كان مؤمن إن العلم مش حكر على حد، وإن المعرفة لازم تكون متاحة للناس. واهتم إنه يقرّب العلوم من المجتمع، ويشجع الشباب على التفكير والبحث."),
]

VOICES = {
    "narrator": ("ar-EG-ShakirNeural", "-2%"),
    "karma": ("ar-EG-SalmaNeural", "+4%"),
}

async def main():
    files = []
    for i, (speaker, text) in enumerate(LINES, 1):
        voice, rate = VOICES[speaker]
        target = OUT / f"{i:02d}-{speaker}.mp3"
        comm = edge_tts.Communicate(text, voice, rate=rate)
        await comm.save(str(target))
        if not target.exists() or target.stat().st_size < 1000:
            raise RuntimeError(f"Invalid audio output: {target}")
        files.append(target)
        print(f"CREATED {target} ({target.stat().st_size} bytes)")
    concat = OUT / "concat.txt"
    concat.write_text("".join(f"file '{p.resolve()}'\\n" for p in files), encoding="utf-8")
    final = OUT / "ali-mosharafa-edge-egyptian-preview.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
        "-c", "copy", str(final)
    ], check=True, capture_output=True)
    if final.stat().st_size < 5000:
        raise RuntimeError("Final MP3 is unexpectedly small")
    print(f"FINAL {final} ({final.stat().st_size} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
