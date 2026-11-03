#!/usr/bin/env python3
"""Read-only Arabic pronunciation QA report. No TTS, network, or source-file writes."""
from __future__ import annotations
import argparse, hashlib, json, re, statistics, sys, types
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
STORIES = ROOT / "stories"
QA_DIR = ROOT / "audio-qa"
LANG = "ar"
SPEAKERS = ("karma", "narrator")
PROTECTED = {"october", "october-1973", "october1973"}
MIN_BYTES, BYTES_PER_SECOND = 512, 16000
RATIO_LOW, RATIO_HIGH, MIN_SAMPLES = 0.65, 1.50, 4
STORY_RE = re.compile(r"^([a-z0-9-]+)/([A-Za-z0-9_-]+)$")
# The complete Arabic alphabet; do not omit letters ف through ي.
TOKEN_RE = re.compile(r"[\u0621-\u063A\u0641-\u064A\u0640-\u065F\u0670]+")
MARK_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
NUMBER_RE = re.compile(r"[0-9\u0660-\u0669]+(?:[.,\u066B][0-9\u0660-\u0669]+)?")
LATIN_RE = re.compile(r"[A-Za-z]+")
PREFIXES = ("وال", "بال", "فال", "كال", "لل", "ول", "وب", "ال", "و", "ب", "ل", "ف", "ك")
TRIGGER_PREFIXES = ("و", "ب", "ل", "ف", "ك")
LEVEL_ORDER = {"needs_review": 0, "pending_update": 1, "info": 2}
LEVEL_AR = {"needs_review": "يحتاج مراجعة", "pending_update": "تحديث معلّق", "info": "معلومة"}
NEEDS_AR = {"none": "—", "editor_review": "مراجعة تحريرية", "human_listen": "استماع بشري"}


def load_generator():
    sys.path.insert(0, str(HERE))
    try:
        import edge_tts
    except ImportError:
        sys.modules.setdefault("edge_tts", types.ModuleType("edge_tts"))
    import generate_story_audio as generator
    return generator


def read_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise ValueError(f"{path}: expected JSON object")
    return value


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def legacy_hash(generator, text: str, voice: str, rate: str, pitch: str) -> str:
    # Historical v3 hash did not include ARABIC_AUDIO_TEXT_VERSION.
    payload = json.dumps([generator.GENERATOR_VERSION, LANG, text, voice, rate, pitch],
                         ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def strip_marks(value: str) -> str:
    return MARK_RE.sub("", value).replace("\u0640", "")


def neutral_key(value: str) -> str:
    return strip_marks(value).replace("ى", "ي")


def loose_key(value: str) -> str:
    value = neutral_key(value)
    for char in ("أ", "إ", "آ"):
        value = value.replace(char, "ا")
    return value.replace("ة", "ه")


def tokenize(value: str) -> list[dict[str, Any]]:
    return [{"start": m.start(), "end": m.end(), "raw": m.group(),
             "key": loose_key(m.group())} for m in TOKEN_RE.finditer(value)]


def skip_prefix(value: str, start: int, count: int) -> int:
    pos = start
    while count and pos < len(value):
        if not MARK_RE.match(value[pos]) and value[pos] != "\u0640":
            count -= 1
        pos += 1
    while pos < len(value) and (MARK_RE.match(value[pos]) or value[pos] == "\u0640"):
        pos += 1
    return pos


def prefix_length(word: str, target: str) -> int | None:
    if word == target:
        return 0
    for prefix in PREFIXES:
        if word.startswith(prefix) and word[len(prefix):] == target and len(word) > len(prefix):
            return len(prefix)
    return None


def load_lexicon(generator, path: Path) -> dict[str, Any]:
    data = generator.read_json(path)
    entities, ids = [], set()
    for item in data.get("entities", []):
        entity_id = str(item.get("id") or "").strip()
        canonical = str(item.get("canonical") or "").strip()
        if not entity_id or not canonical or entity_id in ids:
            raise ValueError(f"{path}: every entity needs a unique id and canonical form")
        ids.add(entity_id)
        forms, seen = [], set()
        for form in [canonical, *item.get("variants", [])]:
            form = str(form).strip()
            keys = tuple(x["key"] for x in tokenize(form))
            if keys and keys not in seen:
                seen.add(keys)
                forms.append({"raw": form, "keys": keys})
        entities.append({"id": entity_id, "forms": forms})
    known = {key for e in entities for form in e["forms"] for key in form["keys"]}
    return {"entities": entities, "known": known,
            "triggers": {loose_key(x) for x in data.get("title_triggers", [])},
            "colloquial": [loose_key(x) for x in data.get("colloquial_markers", [])]}


def find_entities(value: str, lexicon: dict[str, Any]) -> list[dict[str, Any]]:
    tokens, hits = tokenize(value), {}
    for entity in lexicon["entities"]:
        for form in entity["forms"]:
            keys = form["keys"]
            for i in range(len(tokens) - len(keys) + 1):
                prefix = prefix_length(tokens[i]["key"], keys[0])
                if prefix is None or any(tokens[i+j]["key"] != keys[j] for j in range(1, len(keys))):
                    continue
                start = skip_prefix(value, tokens[i]["start"], prefix) if prefix else tokens[i]["start"]
                end = tokens[i + len(keys) - 1]["end"]
                hits.setdefault((entity["id"], start), {
                    "entity": entity["id"], "start": start, "end": end, "raw": value[start:end]})
    return sorted(hits.values(), key=lambda x: x["start"])


def find_candidates(value: str, lexicon: dict[str, Any]) -> list[dict[str, str]]:
    tokens, found = tokenize(value), []
    for i in range(len(tokens) - 1):
        key = tokens[i]["key"]
        trigger = key in lexicon["triggers"] or any(
            key.startswith(p) and key[len(p):] in lexicon["triggers"] for p in TRIGGER_PREFIXES)
        if not trigger or value[tokens[i]["end"]:tokens[i+1]["start"]] != " ":
            continue
        nxt = tokens[i+1]
        known = any(prefix_length(nxt["key"], k) is not None for k in lexicon["known"])
        if not known and len(nxt["key"]) > 2 and nxt["key"] not in lexicon["triggers"]:
            found.append({"candidate": nxt["raw"], "after": tokens[i]["raw"]})
    return found


class Report:
    def __init__(self, story: str):
        self.story, self.findings, self.sequence = story, [], 0

    def add(self, kind, level, message, *, proof="computed", needs="none",
            block=None, chunk=None, speaker=None, entity=None, evidence=None):
        self.sequence += 1
        raw = "|".join(map(str, (self.story, kind, block, chunk, speaker, entity, self.sequence)))
        self.findings.append({
            "id": hashlib.sha1(raw.encode()).hexdigest()[:12], "kind": kind, "level": level,
            "proof": proof, "needs": needs, "pronunciation_error_proven": False,
            "story": self.story, "block": block, "chunk": chunk, "speaker": speaker,
            "entity": entity, "message": message, "evidence": evidence or {}})


def safe_audio_path(directory: Path, src: str) -> Path:
    if not src or Path(src).name != src or src in {".", ".."}:
        raise ValueError(f"Unsafe audio filename in manifest: {src!r}")
    path = directory / src
    if path.is_symlink():
        raise ValueError(f"Refusing symlinked audio file: {path}")
    return path


def analyse(generator, section: str, story_id: str, lexicon: dict[str, Any]) -> dict[str, Any]:
    story_path = STORIES / section / story_id / "story.json"
    resolved = story_path.resolve()
    if STORIES.resolve() not in resolved.parents:
        raise ValueError("Story path resolves outside stories/")
    package = read_json(resolved)
    if package.get("format") != "KHALEDOON_STORY" or package.get("section") != section:
        raise ValueError(f"{story_path}: invalid story package or section")
    slug = str(package.get("slug") or "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"{story_path}: invalid slug")
    blocks = (package.get("i18n") or {}).get(LANG, {}).get("blocks")
    if not isinstance(blocks, list) or not blocks:
        raise ValueError(f"{story_path}: missing Arabic blocks")
    data_path = story_path.with_name("data.json")
    if not data_path.is_file() or read_json(data_path).get("published") is not True:
        raise ValueError("Only published stories are supported")

    audio_dir = ROOT / "assets" / "audio" / section / slug / LANG
    manifest_path = audio_dir / "manifest.json"
    story_key = f"{section}/{story_id}"
    report = Report(story_key)
    voices = {"karma": generator.FISH_AUDIO_KARMA_VOICE_ID,
              "narrator": generator.FISH_AUDIO_NARRATOR_VOICE_ID}
    manifest = read_json(manifest_path) if manifest_path.is_file() else {}
    segments = [x for x in manifest.get("segments", []) if isinstance(x, dict)]
    if not manifest_path.is_file():
        report.add("manifest_missing", "needs_review", "لا يوجد manifest عربي لهذه الحكاية.")
    by_key = {}
    for item in segments:
        if not str(item.get("block_index", "")).isdigit():
            report.add("manifest_invalid_segment", "needs_review",
                       "مقطع في manifest بلا block_index رقمي؛ تم استبعاده.")
            continue
        key = (int(item["block_index"]), int(item.get("chunk_index", 0)))
        if key in by_key:
            report.add("manifest_duplicate_segment", "needs_review",
                       "تكرار لنفس المقطع داخل manifest.", block=key[0], chunk=key[1])
            continue
        by_key[key] = item
    legacy_manifest = bool(segments) and any("chunk_index" not in x or "text" not in x for x in segments)
    if legacy_manifest:
        report.add("manifest_legacy_format", "info",
                   "manifest قديم؛ تتم مقارنة hash بصيغته التاريخية المعروفة دون تعديل الملف.",
                   evidence={"segments": len(segments)})

    rows, occurrences, numbers, expected = [], [], [], set()
    for block_index, block in enumerate(blocks):
        if not isinstance(block, dict):
            continue
        speaker = block.get("speaker")
        original = re.sub(r"\s+", " ", str(block.get("text") or "")).strip()
        if speaker not in SPEAKERS or not original:
            continue
        audio_text = generator.prepare_arabic_audio_text(original)
        chunks = generator.split_audio_chunks(audio_text)
        _, rate, pitch = generator.VOICE_SETTINGS[LANG][speaker]
        spans, cursor = [], 0
        for chunk_text in chunks:
            at = audio_text.find(chunk_text, cursor)
            at = cursor if at < 0 else at
            spans.append((at, at + len(chunk_text)))
            cursor = at + len(chunk_text)
        for hit in find_entities(audio_text, lexicon):
            occurrences.append({**hit, "block": block_index, "speaker": speaker})
            for (_, end_a), (start_b, _) in zip(spans, spans[1:]):
                if hit["start"] < end_a and hit["end"] > start_b:
                    report.add("split_entity", "needs_review",
                               f"الاسم «{hit['raw']}» يعبر حد ملفين صوتيين؛ يُستحسن الاستماع للانتقال.",
                               needs="human_listen", block=block_index, speaker=speaker,
                               entity=hit["entity"], evidence={"boundary_char": end_a})
        if len(chunks) > 1:
            report.add("block_would_split", "info", f"المقطع سينقسم إلى {len(chunks)} ملفات.",
                       block=block_index, speaker=speaker,
                       evidence={"chunk_chars": [len(x) for x in chunks]})
        for pattern, kind in ((NUMBER_RE, "digits"), (LATIN_RE, "latin")):
            for m in pattern.finditer(original):
                numbers.append({"block": block_index, "type": kind, "text": m.group(),
                                "context": original[max(0,m.start()-12):m.end()+12]})
        for candidate in find_candidates(audio_text, lexicon):
            report.add("candidate_name", "info",
                       f"مرشح اسم أو مصطلح غير موجود في المعجم: «{candidate['candidate']}» بعد «{candidate['after']}».",
                       proof="heuristic", needs="editor_review", block=block_index,
                       speaker=speaker, evidence=candidate)
        if speaker == "narrator":
            markers = sorted({x for x in lexicon["colloquial"]
                              if any(t["key"] == x for t in tokenize(original))})
            if len(markers) >= 2:
                report.add("colloquial_in_narrator", "info",
                           "مقطع الراوي يحوي مفردات عامية؛ ملاحظة تحريرية وليست خطأ نطق.",
                           proof="heuristic", needs="editor_review", block=block_index,
                           speaker=speaker, evidence={"markers": markers})

        for chunk_index, chunk_text in enumerate(chunks):
            expected.add((block_index, chunk_index))
            segment = by_key.get((block_index, chunk_index))
            filename = f"{block_index:03d}.mp3" if chunk_index == 0 else f"{block_index:03d}-{chunk_index:02d}.mp3"
            row = {"block": block_index, "chunk": chunk_index, "speaker": speaker,
                   "chars": len(strip_marks(chunk_text)), "file": filename,
                   "manifest_voice": None, "voice_now": voices[speaker],
                   "hash_status": "no_manifest_segment", "size": None, "est_seconds": None,
                   "chars_per_second": None, "generator_would": "GENERATE", "reason": "new_segment"}
            if segment is not None:
                old_voice = segment.get("voice")
                row["manifest_voice"] = old_voice
                src = str(segment.get("src") or filename)
                audio_path = safe_audio_path(audio_dir, src)
                row["file"] = src
                if audio_path.is_file():
                    row["size"] = audio_path.stat().st_size
                    row["est_seconds"] = round(row["size"] / BYTES_PER_SECOND, 1)
                if segment.get("speaker") not in (None, speaker):
                    report.add("speaker_mismatch", "needs_review",
                               "المتحدث في manifest يختلف عن story.json.",
                               block=block_index, chunk=chunk_index, speaker=speaker)
                saved = segment.get("hash")
                if old_voice and saved:
                    if generator.text_hash(chunk_text, old_voice, rate, pitch, LANG) == saved:
                        row["hash_status"] = "current_hash_match"
                    elif legacy_hash(generator, chunk_text, old_voice, rate, pitch) == saved:
                        row["hash_status"] = "legacy_hash_match"
                    else:
                        row["hash_status"] = "unmatched_unknown"
                if row["hash_status"] == "current_hash_match" and old_voice == voices[speaker] and row["size"] and row["size"] >= MIN_BYTES:
                    row["generator_would"], row["reason"] = "UNCHANGED", "up_to_date"
                elif old_voice and old_voice != voices[speaker]:
                    row["reason"] = "voice_refresh"
                elif row["hash_status"] == "legacy_hash_match":
                    row["reason"] = "legacy_hash_format_only"
                elif row["hash_status"] == "unmatched_unknown":
                    row["reason"] = "hash_unmatched_unknown"
                else:
                    row["reason"] = "audio_file_missing_or_refresh"
                if not row["size"] or row["size"] < MIN_BYTES:
                    report.add("audio_file_missing", "needs_review",
                               f"ملف الصوت {src} غير موجود أو أصغر من الحد المقبول.",
                               block=block_index, chunk=chunk_index, speaker=speaker)
                if row["hash_status"] == "unmatched_unknown":
                    report.add("hash_unmatched_unknown", "pending_update",
                               "الـhash لا يطابق الصيغتين المعروفتين؛ السبب غير محسوم.",
                               block=block_index, chunk=chunk_index, speaker=speaker,
                               evidence={"saved_hash": saved, "generator_version": generator.GENERATOR_VERSION})
            rows.append(row)

    for key, segment in sorted(by_key.items()):
        if key not in expected:
            report.add("manifest_extra_segment", "info", "مقطع في manifest لا ينتجه النص الحالي.",
                       block=key[0], chunk=key[1], evidence={"src": segment.get("src")})
    for speaker in SPEAKERS:
        old = sorted({x["manifest_voice"] for x in rows if x["speaker"] == speaker and x["manifest_voice"]})
        changed = sorted({x["block"] for x in rows if x["speaker"] == speaker
                          and x["manifest_voice"] and x["manifest_voice"] != voices[speaker]})
        if changed:
            report.add("voice_refresh_pending", "pending_update",
                       f"صوت {speaker} المحفوظ يختلف عن إعداد المولّد الحالي؛ تحديث معلّق وليس خطأ نطق.",
                       speaker=speaker, evidence={"blocks": changed, "manifest_voices": old,
                                                  "current_voice": voices[speaker]})

    usable = []
    for row in rows:
        if row["size"] and row["hash_status"] != "unmatched_unknown":
            row["chars_per_second"] = round(row["chars"] / (row["size"] / BYTES_PER_SECOND), 1)
            usable.append(row)
    values = [x["chars_per_second"] for x in usable]
    size_summary = {"bytes_per_second": BYTES_PER_SECOND, "samples": len(usable)}
    if len(values) >= MIN_SAMPLES:
        pooled = statistics.median(values)
        size_summary["pooled_median_chars_per_second"] = round(pooled, 1)
        for speaker in SPEAKERS:
            own = [x["chars_per_second"] for x in usable if x["speaker"] == speaker]
            median = statistics.median(own) if len(own) >= MIN_SAMPLES else pooled
            basis = speaker if len(own) >= MIN_SAMPLES else "pooled"
            size_summary[f"median_{speaker}"] = {"value": round(median, 1), "basis": basis, "samples": len(own)}
            for row in (x for x in usable if x["speaker"] == speaker):
                ratio = row["chars_per_second"] / median if median else 1
                row["size_ratio"] = round(ratio, 2)
                if ratio > RATIO_HIGH or ratio < RATIO_LOW:
                    note = "نص كثير بالنسبة لمدة الصوت" if ratio > RATIO_HIGH else "مدة الصوت أطول من المتوقع"
                    report.add("size_outlier", "needs_review",
                               f"مؤشر حجم تقريبي: {note}. ليس دليلًا على البتر أو خطأ النطق؛ يحتاج استماعًا.",
                               proof="heuristic", needs="human_listen", block=row["block"],
                               chunk=row["chunk"], speaker=speaker,
                               evidence={"ratio": round(ratio,2), "estimated_seconds": row["est_seconds"],
                                         "median_basis": basis})

    entity_table = []
    for entity_id in sorted({x["entity"] for x in occurrences}):
        for speaker in SPEAKERS:
            hits = [x for x in occurrences if x["entity"] == entity_id and x["speaker"] == speaker]
            if not hits:
                continue
            forms = {}
            for hit in hits:
                forms.setdefault(hit["raw"], []).append(hit["block"])
            entity_table.append({"entity": entity_id, "speaker": speaker, "count": len(hits),
                                 "blocks": sorted({x["block"] for x in hits}),
                                 "forms": [{"form": f, "count": len(v)} for f,v in forms.items()]})
            groups = {}
            for form in forms:
                groups.setdefault(neutral_key(form), []).append(form)
            if len(groups) > 1:
                report.add("orthographic_variance", "needs_review",
                           f"الكيان {entity_id} مكتوب بصيغ مختلفة عند {speaker}؛ اختلاف نص لا يثبت اختلاف النطق.",
                           needs="editor_review", speaker=speaker, entity=entity_id,
                           evidence={"forms": list(groups.values())})
            for variants in groups.values():
                marked = {tuple(MARK_RE.findall(form)) for form in variants if MARK_RE.search(form)}
                if len(marked) > 1:
                    report.add("diacritics_conflict", "needs_review",
                               f"تشكيل الكيان {entity_id} مختلف بين الظهورات.",
                               needs="human_listen", speaker=speaker, entity=entity_id,
                               evidence={"forms": variants})
                elif marked and any(not MARK_RE.search(form) for form in variants):
                    report.add("diacritics_partial", "info",
                               f"الكيان {entity_id} مشكول في بعض الظهورات وغير مشكول في أخرى.",
                               needs="editor_review", speaker=speaker, entity=entity_id,
                               evidence={"forms": variants})
    if numbers:
        report.add("numbers_and_latin_present", "info",
                   "النص يحتوي أرقامًا أو حروفًا لاتينية؛ رُصد وجودها فقط ولم تُفحص طريقة نطقها.",
                   proof="heuristic", needs="human_listen", evidence={"items": numbers})

    findings = sorted(report.findings, key=lambda x: (LEVEL_ORDER[x["level"]], x["kind"],
                       x["block"] if x["block"] is not None else -1))
    return {"story": story_key, "slug": slug, "language": LANG,
            "inputs": {"story_json_sha256": file_hash(resolved),
                       "manifest_sha256": file_hash(manifest_path) if manifest_path.is_file() else None,
                       "generator_version": generator.GENERATOR_VERSION,
                       "arabic_audio_text_version": getattr(generator, "ARABIC_AUDIO_TEXT_VERSION", None),
                       "current_voices": voices,
                       "manifest_format": "legacy" if legacy_manifest else "current_or_empty"},
            "segments": rows, "entities": entity_table, "size_indicators": size_summary,
            "findings": findings}


def summarise(result):
    levels, kinds = {}, {}
    for item in result["findings"]:
        levels[item["level"]] = levels.get(item["level"], 0) + 1
        kinds[item["kind"]] = kinds.get(item["kind"], 0) + 1
    rows = result["segments"]
    return {"by_level": levels, "by_kind": kinds, "segments_total": len(rows),
            "generator_would_regenerate": sum(x["generator_would"] == "GENERATE" for x in rows),
            "generator_would_keep": sum(x["generator_would"] == "UNCHANGED" for x in rows),
            "legacy_hash_matches": sum(x["hash_status"] == "legacy_hash_match" for x in rows),
            "current_hash_matches": sum(x["hash_status"] == "current_hash_match" for x in rows),
            "unmatched_hashes": sum(x["hash_status"] == "unmatched_unknown" for x in rows),
            "pronunciation_errors_proven": 0}


def to_markdown(result):
    s = result["summary"]
    lines = [f"# تقرير دفتر النطق v1 — {result['story']} ({result['slug']})", "",
             "> تقرير قراءة فقط. لا توليد صوت ولا استدعاء API ولا تعديل للصوت أو manifest أو نص الحكاية.",
             "> لا يثبت هذا الإصدار أي خطأ نطق؛ النتائج حقائق بيانات أو مؤشرات تستحق المراجعة.", "",
             "## الملخص", f"- المقاطع المفحوصة: {s['segments_total']}",
             f"- hash قديم مطابق: {s['legacy_hash_matches']}",
             f"- hash حالي مطابق: {s['current_hash_matches']}",
             f"- hash غير محسوم: {s['unmatched_hashes']}",
             f"- أخطاء نطق مثبتة: {s['pronunciation_errors_proven']}",
             f"- وفق محاكاة المولّد: سيُعاد توليد {s['generator_would_regenerate']} وسيُبقى {s['generator_would_keep']}؛ لم يُشغّل المولّد.", "",
             "## النتائج", "| المستوى | النوع | المقطع | المتحدث | يحتاج | الإثبات | التفصيل |",
             "|---|---|---|---|---|---|---|"]
    for f in result["findings"]:
        where = "—" if f["block"] is None else str(f["block"])
        if f["chunk"] not in (None, 0):
            where += f".{f['chunk']}"
        detail = f["message"].replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {LEVEL_AR[f['level']]} | {f['kind']} | {where} | {f['speaker'] or '—'} | "
                     f"{NEEDS_AR[f['needs']]} | {'محسوب' if f['proof']=='computed' else 'تقريبي'} | {detail} |")
    lines += ["", "## المقاطع", "| المقطع | المتحدث | أحرف | KB | ثوانٍ تقريبًا | حرف/ثانية | hash | قرار المولّد |",
              "|---|---|---:|---:|---:|---:|---|---|"]
    for x in result["segments"]:
        kb = "—" if x["size"] is None else f"{x['size']/1024:.0f}"
        sec = "—" if x["est_seconds"] is None else str(x["est_seconds"])
        cps = "—" if x["chars_per_second"] is None else str(x["chars_per_second"])
        lines.append(f"| {x['block']}.{x['chunk']} | {x['speaker']} | {x['chars']} | {kb} | {sec} | {cps} | "
                     f"{x['hash_status']} | {x['generator_would']} ({x['reason']}) |")
    lines += ["", "## الكيانات المرصودة", "| الكيان | المتحدث | مرات الظهور | المقاطع | الصيغ |", "|---|---|---:|---|---|"]
    for x in result["entities"]:
        forms = "، ".join(f"{v['form']} ×{v['count']}" for v in x["forms"])
        lines.append(f"| {x['entity']} | {x['speaker']} | {x['count']} | {', '.join(map(str,x['blocks']))} | {forms} |")
    lines += ["", "## حدود الفحص",
              "- لا يمكن إثبات صحة نطق اسم أو رقم دون استماع أو تعرّف على الكلام.",
              "- اختلاف الصوت عن إعداد المولّد الحالي تحديث معلّق وليس حكمًا على جودة التسجيل القديم.",
              "- حجم MP3 مؤشر تقريبي فقط، وليس دليلًا على البتر أو الصمت.",
              "- hash غير المعروف يبقى غير محسوم؛ لا يُنسب تلقائيًا إلى تغيّر النص.", "",
              "## المدخلات", json.dumps(result["inputs"], ensure_ascii=False, indent=2), ""]
    return "\n".join(lines)


def write_outputs(result):
    QA_DIR.mkdir(parents=True, exist_ok=True)
    if QA_DIR.is_symlink():
        raise RuntimeError("Refusing symlinked audio-qa directory")
    targets = {QA_DIR / "report.json": json.dumps(result, ensure_ascii=False, indent=2) + "\n",
               QA_DIR / "report.md": to_markdown(result)}
    for path, content in targets.items():
        if path.is_symlink() or path.resolve().parent != QA_DIR.resolve():
            raise RuntimeError(f"Refusing unsafe output path: {path}")
        temp = path.with_name(path.name + ".tmp")
        temp.write_text(content, encoding="utf-8")
        temp.replace(path)
    return list(targets)


def main():
    parser = argparse.ArgumentParser(description="Read-only Arabic pronunciation QA report")
    parser.add_argument("--story", default="science/015", help="section/id; default science/015")
    parser.add_argument("--lexicon", default=str(QA_DIR / "lexicon.json"))
    parser.add_argument("--write", action="store_true",
                        help="write audio-qa/report.json and report.md; otherwise print Markdown")
    args = parser.parse_args()
    match = STORY_RE.fullmatch(args.story)
    if not match:
        print("Invalid --story; expected section/id", file=sys.stderr)
        return 2
    section, story_id = match.groups()
    if section.casefold() in PROTECTED:
        print(f"SKIP protected section: {section}", file=sys.stderr)
        return 2
    try:
        lexicon_path = Path(args.lexicon).resolve()
        if not lexicon_path.is_file():
            raise FileNotFoundError(f"Lexicon not found: {lexicon_path}")
        generator = load_generator()
        lexicon = load_lexicon(generator, lexicon_path)
        result = analyse(generator, section, story_id, lexicon)
        result["summary"] = summarise(result)
        if args.write:
            for path in write_outputs(result):
                print(f"WROTE {path.relative_to(ROOT)}", file=sys.stderr)
        print(to_markdown(result))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
