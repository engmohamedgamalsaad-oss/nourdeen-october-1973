#!/usr/bin/env python3
"""Full-story simplified Arabic audio trial for Ali Mostafa Mosharafa.

Reads the Arabic story blocks without changing story.json, applies an audio-only
plain-language rewrite, then renders one continuous two-speaker Fish Audio request.
"""
import hashlib
import json
import os
import subprocess
import urllib.request
from pathlib import Path

STORY = Path("stories/science/016/story.json")
OUT = Path("artifacts/ali-mosharafa-full-simplified-audio")
API = "https://api.fish.audio/v1/tts"
MODEL = "s2.1-pro-free"
NARRATOR = "b65cfd7ce5e44607aedafeea3dbb01e8"
KARMA = "592625f68416462f8b6161ddf5fdbffb"

# Audio-only wording. Facts and sequence are retained; difficult sentence
# structures are shortened. The website story text is never modified.
SIMPLIFIED_AR = {
  0: "في مدينة دمياط، وُلد علي مصطفى مشرفة يوم الحادي عشر من يوليو سنة ألف وثمانمئة وثمانية وتسعين. كان يحب الأرقام والأسئلة. ومع الوقت، قاده هذا الفضول إلى دراسة قوانين الطبيعة، حتى أصبح من أبرز علماء الفيزياء النظرية في مصر.",
  1: None,
  2: "الفيزياء النظرية تحاول فهم القواعد التي يسير بها الكون. ويستخدم العلماء فيها الرياضيات والتفكير، ثم يقارنون أفكارهم بالتجارب والملاحظات. أحب مشرفة الرياضيات؛ لأنها تساعدنا على وصف الحركة والطاقة والضوء والمادة بدقة.",
  3: "هل تعلم؟ وُلد علي مصطفى مشرفة في دمياط سنة ألف وثمانمئة وثمانية وتسعين، وتوفي في القاهرة يوم الخامس عشر من يناير سنة ألف وتسعمئة وخمسين.",
  4: "في سنة ألف وتسعمئة وأربعة عشر، حصل مشرفة على شهادة البكالوريا، وكان عمره ستة عشر عامًا فقط. وكان أصغر من حصل عليها في ذلك الوقت. بعد ذلك اختار دراسة الرياضيات في دار المعلمين العليا؛ لأنه أحب هذا العلم وأراد أن يتعمق فيه.",
  5: None,
  6: "تفوق مشرفة في دراسته، ثم اختير سنة ألف وتسعمئة وسبعة عشر في بعثة علمية إلى إنجلترا. درس في جامعة نوتنغهام، ثم واصل دراسته في كلية الملك بلندن. حصل على الدكتوراه سنة ألف وتسعمئة وثلاثة وعشرين، ثم حصل على دكتوراه العلوم سنة ألف وتسعمئة وأربعة وعشرين.",
  7: "هل تعلم؟ حصل مشرفة على دكتوراه العلوم سنة ألف وتسعمئة وأربعة وعشرين، وتذكر الهيئة العامة للاستعلامات أنه أول مصري نال هذه الدرجة.",
  8: None,
  9: "عاد مشرفة إلى مصر وبدأ تدريس الرياضيات. وفي سنة ألف وتسعمئة وستة وعشرين، أصبح أستاذًا للرياضيات التطبيقية في كلية العلوم بجامعة القاهرة، وكان عمره أقل من ثلاثين عامًا. ثم أصبح عميدًا للكلية سنة ألف وتسعمئة وستة وثلاثين، وكان أول مصري يتولى هذا المنصب. وساعد في بناء بيئة علمية تشجع الطلاب على البحث والتفكير.",
  10: "هل تعلم؟ أصبح مشرفة عميدًا لكلية العلوم بجامعة القاهرة سنة ألف وتسعمئة وستة وثلاثين، وكان عمره ثمانية وثلاثين عامًا.",
  11: "ومن تلاميذه سميرة موسى، التي أصبحت عالمة مصرية بارزة في أبحاث الإشعاع الذري. آمن مشرفة بقدرتها وشجعها على مواصلة طريقها العلمي. فالمعلم الجيد قد يساعد تلميذه على الوصول إلى مستقبل كبير.",
  12: "بحث مشرفة في نظرية الكم والنسبية، ودرس العلاقة بين المادة والإشعاع. ونشر أبحاثًا وكتبًا في الرياضيات والفيزياء. كما اهتم بتاريخ العلوم، وساعد على تقديم المعرفة العلمية باللغة العربية. وتذكر المصادر أنه تبادل الرسائل مع ألبرت أينشتاين. لكن إنجازه الحقيقي يظهر في أبحاثه وتعليمه للطلاب.",
  13: "النسبية تدرس العلاقة بين المكان والزمان والحركة والجاذبية. أما نظرية الكم فتشرح سلوك الأشياء الصغيرة جدًا، مثل الذرات والضوء. وهاتان النظريتان من أهم أسس الفيزياء الحديثة.",
  14: "وتذكر الهيئة العامة للاستعلامات أن مشرفة نشر نحو خمسة وعشرين بحثًا علميًا، وكتب قرابة اثني عشر كتابًا في الرياضيات والفيزياء. كما ترجم عشرة كتب في الرياضيات والفلك إلى العربية. وشارك تلميذه محمد مرسي أحمد في نشر كتاب مشهور للعالم الخوارزمي عن الجبر.",
  15: "واستمر استكشاف الفضاء بعد زمن مشرفة بعقود طويلة. والصورة التالية خريطة من وكالة ناسا لمكان هبوط أبولو أحد عشر على سطح القمر سنة ألف وتسعمئة وتسعة وستين. وهي مثال لاحق يوضح أهمية القياس والخرائط في البحث العلمي، وليست من أعمال مشرفة.",
  16: "لم تكن اهتمامات مشرفة محصورة في المعادلات. فقد أحب الموسيقى وكتب عنها أيضًا. وهذا يذكرنا بأن العالم إنسان واسع الفضول، ويمكن أن يجمع بين حب العلم وحب الفن.",
  17: "واهتم مشرفة بالموسيقى من ناحية علمية أيضًا. ففي سنة ألف وتسعمئة وخمس وأربعين، شارك في تأسيس جمعية محبي الموسيقى المصرية. ودرس المقامات المصرية والعلاقات الرياضية بين النغمات.",
  18: None,
  19: "والآن نتذكر أهم محطات حياته: وُلد في دمياط سنة ألف وثمانمئة وثمانية وتسعين. حصل على البكالوريا سنة ألف وتسعمئة وأربعة عشر. سافر في بعثة إلى إنجلترا سنة ألف وتسعمئة وسبعة عشر. حصل على الدكتوراه سنة ألف وتسعمئة وثلاثة وعشرين، ودكتوراه العلوم سنة ألف وتسعمئة وأربعة وعشرين. أصبح أستاذًا في جامعة القاهرة سنة ألف وتسعمئة وستة وعشرين، ثم عميدًا لكلية العلوم سنة ألف وتسعمئة وستة وثلاثين. وشارك في تأسيس جمعية محبي الموسيقى المصرية سنة ألف وتسعمئة وخمس وأربعين.",
  20: "توفي علي مصطفى مشرفة في القاهرة يوم الخامس عشر من يناير سنة ألف وتسعمئة وخمسين. لكن أثره بقي في العلم والتعليم. وتعلمنا سيرته أن الفضول والاجتهاد وحب المعرفة يمكن أن تترك أثرًا يستمر بعد صاحبه. فالعلم يبدأ بسؤال جيد، ويكبر بالبحث عن الدليل."
}

def main():
    key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
    if not key:
        raise RuntimeError("FISH_AUDIO_API_KEY is not configured in repository Actions secrets.")
    story = json.loads(STORY.read_text(encoding="utf-8"))
    blocks = story["i18n"]["ar"]["blocks"]
    if len(blocks) != len(SIMPLIFIED_AR):
        raise RuntimeError(f"Story block count changed: expected {len(SIMPLIFIED_AR)}, got {len(blocks)}")
    parts = []
    for i, block in enumerate(blocks):
        speaker = block.get("speaker", "narrator")
        text = SIMPLIFIED_AR[i]
        if text is None:
            text = block.get("text", "").strip()
        if not text:
            continue
        tag = "<|speaker:1|>" if speaker == "karma" else "<|speaker:0|>"
        parts.append(tag + text)
    full_text = "\n".join(parts)
    payload = {
        "text": full_text,
        "reference_id": [NARRATOR, KARMA],
        "format": "mp3",
        "normalize": False,
        "temperature": 0.35,
        "top_p": 0.7,
        "prosody": {"speed": 0.95},
        "condition_on_previous_chunks": True,
        "chunk_length": 300,
        "latency": "normal"
    }
    req = urllib.request.Request(
        API, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "model": MODEL}
    )
    with urllib.request.urlopen(req, timeout=300) as response:
        audio = response.read()
    if len(audio) < 1024 or not (audio.startswith(b"ID3") or audio.startswith(b"\xff")):
        raise RuntimeError("Fish Audio returned an empty or invalid MP3 payload.")
    OUT.mkdir(parents=True, exist_ok=True)
    audio_path = OUT / "ali-mosharafa-full-story-simplified.mp3"
    audio_path.write_bytes(audio)
    duration = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)
    ], text=True).strip())
    report = {
        "story": "ali-mosharafa",
        "mode": "audio_only_simplification_full_story_single_multispeaker_request",
        "voices": {"narrator": NARRATOR, "karma": KARMA},
        "model": MODEL,
        "story_json_modified": False,
        "blocks": len(blocks),
        "duration_seconds": round(duration, 2),
        "bytes": len(audio),
        "sha256": hashlib.sha256(audio).hexdigest(),
        "audio_text": full_text
    }
    (OUT / "production-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"CREATED {audio_path.name} ({duration:.2f}s, {len(audio)} bytes)")

if __name__ == "__main__":
    main()
