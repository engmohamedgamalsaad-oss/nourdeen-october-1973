/* khaledoon/assets/audio-review-core.js
   منطق نقي لمراجعة واعتماد الصوت: مفتاح المقطع، حالة المراجعة story_meta.audio_review، شرط الاعتماد، وقسم برومبت الذكاء الاصطناعي.
   بلا DOM ولا شبكة. يعمل في المتصفح (window.KHAudioReviewCore) وفي Node للاختبار. */
(function (root) {
'use strict';

var GEN_VERSION = 'v1';
var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
/* العربية وحدها شرط اعتماد ونشر الحكاية؛ اللغات الأخرى اختيارية ومستقلة. */
var REQUIRED_LANGS = ['ar'];
/* لا توجد قائمة حكايات تجريبية: محرك المراجعة مشترك ويستقبل معرّف أي حكاية من القارئ. */

function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
/* مطابقة بلا تشكيل (للمقارنة فقط، لا تدخل في المفتاح) */
function strip(s) { return norm(s).replace(/[\u064B-\u065F\u0670\u0640]/g, ''); }

function engineOf(lang, speaker) {
  return { voice: speaker === 'karma' ? 'omnivoice-karma-reference' : speaker === 'narrator' ? 'omnivoice-narrator-reference' : '', provider: 'omnivoice', model: 'VoiceTut Egyptian Tashkeel' };
}

async function sha256(str) {
  var c = root.crypto && root.crypto.subtle ? root.crypto : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
  var buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
async function sha256Bytes(buffer) {
  var c = root.crypto && root.crypto.subtle ? root.crypto : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
  var buf = await c.subtle.digest('SHA-256', buffer);
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

/* المفتاح الأساسي: الحكاية + اللغة + المتحدث + الصوت + المزوّد/الموديل + النص المنطوق (بعد تطبيع المسافات) + إصدار المولّد.
   رقم المقطع وترتيبه لا يدخلان فيه. */
async function baseKey(storyId, lang, speaker, spokenText, engine) {
  var e = engine && typeof engine === 'object' ? {
    voice: String(engine.voice || ''),
    provider: String(engine.provider || ''),
    model: String(engine.model || ''),
    audio_revision: String(engine.audio_revision || '')
  } : engineOf(lang, speaker);
  var parts = ['khaudio', GEN_VERSION, storyId, lang, speaker, e.voice, e.provider, e.model, norm(spokenText)];
  if (e.audio_revision) parts.push(e.audio_revision);
  return sha256(parts.join('\u241F'));
}
/* المفتاح النهائي = الأساسي + عدّاد «إعادة الصوت» */
async function clipKey(base, regen) { return regen ? sha256(base + '\u241Fr' + regen) : base; }

/* Validate complete one-to-one coverage of every spoken story block by manifest chunks. */
function validateManifestCoverage(blocks, segments, expectedTexts, allowPartial) {
  if (!Array.isArray(blocks) || !blocks.length || !Array.isArray(segments) || !segments.length) {
    return { ok: false, error: 'الحكاية أو ملف الصوت لا يحتوي على مقاطع قابلة للمراجعة.' };
  }
  var seen = Object.create(null), chunks = Object.create(null), speakable = Object.create(null), speakableCount = 0;
  for (var b = 0; b < blocks.length; b++) {
    var candidate = blocks[b] || {};
    if ((candidate.speaker === 'narrator' || candidate.speaker === 'karma') && norm(candidate.text || '')) {
      speakable[b] = true;
      speakableCount++;
    }
  }
  if (!speakableCount) return { ok: false, error: 'لا توجد مقاطع راوٍ أو كارما قابلة للمراجعة.' };
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i] || {};
    var blockIndex = Number(seg.block_index), chunkIndex = Number(seg.chunk_index || 0);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length || !speakable[blockIndex]) {
      return { ok: false, error: 'يوجد مقطع صوتي مرتبط بكتلة غير منطوقة أو بترقيم خارج حدود الحكاية.' };
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return { ok: false, error: 'ترقيم أجزاء المقطع الصوتي غير صالح.' };
    }
    if (!blocks[blockIndex] || blocks[blockIndex].speaker !== seg.speaker) {
      return { ok: false, error: 'المتحدث في ملف الصوت لا يطابق المتحدث في الحكاية عند المقطع ' + (blockIndex + 1) + '.' };
    }
    var key = blockIndex + ':' + chunkIndex;
    if (seen[key]) return { ok: false, error: 'يوجد جزء صوتي مكرر للمقطع ' + (blockIndex + 1) + '.' };
    seen[key] = true;
    if (!chunks[blockIndex]) chunks[blockIndex] = [];
    chunks[blockIndex].push(chunkIndex);
  }
  for (var b = 0; b < blocks.length; b++) {
    if (!speakable[b]) continue;
    var indexes = chunks[b];
    if (!indexes || !indexes.length) {
      if (allowPartial === true) continue;
      return { ok: false, error: 'لا يوجد ملف صوتي للمقطع ' + (b + 1) + '.' };
    }
    indexes.sort(function (a, c) { return a - c; });
    for (var n = 0; n < indexes.length; n++) {
      if (indexes[n] !== n) return { ok: false, error: 'يوجد جزء مفقود أو فجوة في ملفات المقطع ' + (b + 1) + '.' };
    }
    var expected = Array.isArray(expectedTexts) && typeof expectedTexts[b] === 'string'
      ? expectedTexts[b] : String(blocks[b].text || '');
    var actual = indexes.map(function (chunk) {
      var found = segments.find(function (seg) {
        return Number(seg.block_index) === b && Number(seg.chunk_index || 0) === chunk;
      });
      return String(found && found.text || '');
    }).join(' ');
    if (norm(expected) !== norm(actual)) {
      return { ok: false, error: 'نص الصوت لا يطابق نص الحكاية الحالي عند المقطع ' + (b + 1) + '.' };
    }
  }
  return { ok: true, blocks: blocks.length, segments: segments.length };
}

/* النص الذي يجب أن يطابقه الصوت: نص القراءة المعتمد الذي أُرسل للتوليد، ثم نص النطق المعتمد، ثم نص الحكاية. */
function expectedSpokenText(storyText, pronunciationText, speechRecord) {
  if (speechRecord && speechRecord.status === 'approved' && typeof speechRecord.approved_text === 'string' && norm(speechRecord.approved_text)) {
    return speechRecord.approved_text;
  }
  if (typeof pronunciationText === 'string' && norm(pronunciationText)) return pronunciationText;
  return String(storyText || '');
}
function isSpeakable(block) {
  return !!block && (block.speaker === 'narrator' || block.speaker === 'karma') && !!norm(block.text || '');
}
/* يفصل المقاطع القديمة: كتلة نص صوتها المسجّل لا يطابق النص المتوقع الحالي. لا يُعدَّل سجل الموافقة ولا يُقبل الصوت القديم بصمت. */
function splitStaleSegments(blocks, segments, expectedTexts) {
  var byBlock = Object.create(null), fresh = [], stale = [];
  (Array.isArray(segments) ? segments : []).forEach(function (seg) {
    var b = Number(seg && seg.block_index);
    if (!Number.isInteger(b) || !Array.isArray(blocks) || !isSpeakable(blocks[b])) { fresh.push(seg); return; }
    (byBlock[b] || (byBlock[b] = [])).push(seg);
  });
  Object.keys(byBlock).forEach(function (key) {
    var b = Number(key), list = byBlock[key].slice().sort(function (x, y) { return Number(x.chunk_index || 0) - Number(y.chunk_index || 0); });
    var expected = Array.isArray(expectedTexts) && typeof expectedTexts[b] === 'string' ? expectedTexts[b] : String(blocks[b].text || '');
    var actual = list.map(function (s) { return String(s.text || ''); }).join(' ');
    if (norm(expected) === norm(actual)) fresh = fresh.concat(list); else stale.push(b);
  });
  stale.sort(function (x, y) { return x - y; });
  return { fresh: fresh, stale: stale };
}
/* كتل منطوقة بلا أي مقطع صوتي (تُحسب بعد استبعاد القديم). */
function uncoveredBlocks(blocks, segments) {
  var covered = Object.create(null), out = [];
  (Array.isArray(segments) ? segments : []).forEach(function (seg) { covered[Number(seg && seg.block_index)] = true; });
  (Array.isArray(blocks) ? blocks : []).forEach(function (block, index) {
    if (isSpeakable(block) && !covered[index]) out.push(index);
  });
  return out;
}

function boundedText(value, max) { return String(value == null ? '' : value).slice(0, max); }
function finiteNumber(value) {
  if (value == null || value === '') return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function normalizePronunciationReview(input, entry, attachedAt) {
  if (!input || typeof input !== 'object') return null;
  var digest = boundedText(input.audio_sha256, 64).toLowerCase();
  var entryDigest = boundedText(entry && entry.audio_sha256, 64).toLowerCase();
  var hashValid = /^[a-f0-9]{64}$/.test(digest) && digest === entryDigest && input.hash_verified === true;
  function words(items) {
    return (Array.isArray(items) ? items : []).slice(0, 30).map(function (item) {
      if (!item || typeof item !== 'object') return null;
      return {
        word: boundedText(item.word, 120),
        start: finiteNumber(item.start),
        end: finiteNumber(item.end),
        probability: finiteNumber(item.probability)
      };
    }).filter(Boolean);
  }
  var mismatches = (Array.isArray(input.mismatches) ? input.mismatches : []).slice(0, 30).map(function (item) {
    if (!item || typeof item !== 'object') return null;
    return {
      type: boundedText(item.type, 24),
      expected: (Array.isArray(item.expected) ? item.expected : []).slice(0, 30).map(function (v) { return boundedText(v, 120); }),
      recognized: (Array.isArray(item.recognized) ? item.recognized : []).slice(0, 30).map(function (v) { return boundedText(v, 120); }),
      start: finiteNumber(item.start),
      end: finiteNumber(item.end)
    };
  }).filter(Boolean);
  return {
    format: 'KHALEDOON_AUDIO_PRONUNCIATION_REVIEW_RESULT_V1',
    engine: boundedText(input.engine || 'faster-whisper-local', 48),
    status: boundedText(input.status || 'unknown', 48),
    audio_sha256: digest,
    hash_verified: hashValid,
    attached_at: attachedAt,
    match_ratio: finiteNumber(input.match_ratio),
    detected_language: boundedText(input.detected_language, 8),
    language_probability: finiteNumber(input.language_probability),
    language_mismatch: input.language_mismatch === true,
    language_detection_uncertain: input.language_detection_uncertain === true,
    expected_word_count: finiteNumber(input.expected_word_count),
    recognized_word_count: finiteNumber(input.recognized_word_count),
    transcript: boundedText(input.transcript, 4000),
    mismatches: mismatches,
    low_confidence_words: words(input.low_confidence_words)
  };
}

function emptyReview() { return { version: 1, regen: {}, clips: {}, audio_hashes: {} }; }
function cloneReview(r) {
  var x = r && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : emptyReview();
  if (!x.regen || typeof x.regen !== 'object') x.regen = {};
  if (!x.clips || typeof x.clips !== 'object') x.clips = {};
  if (!x.audio_hashes || typeof x.audio_hashes !== 'object') x.audio_hashes = {};
  x.version = 1;
  return x;
}

/* تسجيل قرار أدمن واحد. القبول والرفض متعارضان لنفس المفتاح (آخر قرار يستبدل السابق). */
function applyDecision(review, entry, decision, now) {
  var r = cloneReview(review);
  var at = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
  /* أي قرار قديم لنفس اللغة ورقم المقطع بمفتاح مختلف يُعتبر مستبدلًا */
  Object.keys(r.clips).forEach(function (k) {
    var c = r.clips[k];
    if (k !== entry.key && c.lang === entry.lang && c.block_index === entry.block_index && Number(c.chunk_index || 0) === Number(entry.chunk_index || 0)) {
      if (c.status === 'accepted') delete r.clips[k]; else c.resolved = true;
    }
  });
  var previousClip = r.clips[entry.key];
  if (!previousClip || !previousClip.replacement_cleanup) {
    var matchingRejected = Object.keys(r.clips).map(function (key) { return r.clips[key]; }).find(function (candidate) {
      return candidate && candidate.status === 'rejected' && candidate.replacement_cleanup &&
        candidate.lang === entry.lang && Number(candidate.block_index) === Number(entry.block_index) &&
        Number(candidate.chunk_index || 0) === Number(entry.chunk_index || 0);
    });
    if (matchingRejected) previousClip = matchingRejected;
  }
  var clip = {
    story_id: entry.story_id, lang: entry.lang, block_index: entry.block_index, chunk_index: Number(entry.chunk_index || 0), speaker: entry.speaker,
    base: entry.base, source_base: entry.source_base || '', src: entry.src || '', audio_sha256: entry.audio_sha256 || '',
    text: entry.text, status: decision.status, decided_at: at
  };
  if (previousClip && previousClip.replacement_cleanup) {
    // Carry the private old-file pointer forward when rejection is replaced by acceptance.
    clip.replacement_cleanup = previousClip.replacement_cleanup;
  }
  if (decision.pronunciation_review) {
    clip.pronunciation_review = normalizePronunciationReview(decision.pronunciation_review, entry, at);
  } else if (previousClip && previousClip.pronunciation_review) {
    clip.pronunciation_review = previousClip.pronunciation_review;
  }
  if (entry.source_base && entry.audio_sha256) r.audio_hashes[entry.source_base] = entry.audio_sha256;
  if (decision.status === 'rejected') {
    clip.note = String(decision.note || '').slice(0, 1000);
    clip.suggestion = String(decision.suggestion || '').slice(0, 1000);
    clip.issue = decision.issue === 'audio_only' ? 'audio_only' : 'text';
  }
  r.clips[entry.key] = clip;
  return r;
}

/* شرط اعتماد المعاينة: كل مقطع (في اللغات الخمس) جاهز ومقبول، ولا مرفوض ولا غير مراجَع. */
function evaluateGate(entries, review, readyByKey, listenedByKey) {
  var r = cloneReview(review), listened = listenedByKey || {}, out = { ok: true, total: entries.length, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0, notListened: 0 };
  entries.forEach(function (e) {
    var c = r.clips[e.key];
    if (readyByKey[e.key] !== 'ready') out.notReady++;
    if (listened[e.key] !== true) out.notListened++;
    if (c && c.status === 'accepted') out.accepted++;
    else if (c && c.status === 'rejected') out.rejected++;
    else out.unreviewed++;
  });
  out.ok = out.total > 0 && out.notReady === 0 && out.notListened === 0 && out.rejected === 0 && out.unreviewed === 0 && out.accepted === out.total;
  return out;
}
function evaluateFiveLanguageGate(manifests, entries, review, readyByKey, listenedByKey, requiredLangs) {
  var required = Array.isArray(requiredLangs) && requiredLangs.length ? requiredLangs : REQUIRED_LANGS;
  var missing = required.filter(function (lang) { return !manifests || !manifests[lang]; });
  if (missing.length) {
    return {
      ok: false, missingLanguages: missing, total: Array.isArray(entries) ? entries.length : 0,
      accepted: 0, rejected: 0, unreviewed: Array.isArray(entries) ? entries.length : 0, notReady: 0
    };
  }
  return evaluateGate(entries, review, readyByKey, listenedByKey);
}

/* Translation provenance gate: every non-Arabic block must still point to the exact current Arabic source block. */
function validateTranslationAlignment(story, language) {
  if (language === 'ar') return { ok: true, reason: '', staleBlocks: [] };
  var ar = story && story.i18n && story.i18n.ar && story.i18n.ar.blocks;
  var local = story && story.i18n && story.i18n[language] && story.i18n[language].blocks;
  if (!Array.isArray(ar) || !Array.isArray(local) || local.length !== ar.length) {
    return { ok: false, reason: 'ترجمة هذه اللغة لا تطابق عدد المقاطع العربية؛ حدّث ترجمة الحكاية أولًا.', staleBlocks: null };
  }
  var stale = [];
  for (var i = 0; i < ar.length; i++) {
    var a = ar[i] || {}, b = local[i] || {};
    if (a.type !== b.type || a.speaker !== b.speaker ||
        (a.image_after || '') !== (b.image_after || '') ||
        Object.prototype.hasOwnProperty.call(a, 'heading') !== Object.prototype.hasOwnProperty.call(b, 'heading')) {
      stale.push(i);
      continue;
    }
    if ((typeof b.source_ar_text !== 'string' || b.source_ar_text !== a.text ||
        (Object.prototype.hasOwnProperty.call(a, 'heading') && b.source_ar_heading !== a.heading)) && stale.indexOf(i) < 0) stale.push(i);
    if (a.type === 'timeline') {
      var arRows = String(a.text || '').split('\n'), localRows = String(b.text || '').split('\n');
      if ((arRows.length !== localRows.length || arRows.some(function (row, rowIndex) { return row.split(' — ')[0] !== String(localRows[rowIndex] || '').split(' — ')[0]; })) && stale.indexOf(i) < 0) stale.push(i);
    }
  }
  if (stale.length) {
    return { ok: false, reason: 'ترجمة المقطع ' + (stale[0] + 1) + ' قديمة أو غير موثقة المصدر. أعد ترجمتها من النص العربي المعتمد قبل توليد الصوت.', staleBlocks: stale };
  }
  return { ok: true, reason: '', staleBlocks: [] };
}

function gateMessage(g) {
  if (g.ok) return '';
  var parts = [];
  if (g.notReady) parts.push(g.notReady + ' مقطع صوته غير جاهز');
  if (g.notListened) parts.push(g.notListened + ' مقطع لم يتم الاستماع إليه كاملًا في هذه المعاينة');
  if (g.rejected) parts.push(g.rejected + ' مقطع مرفوض');
  if (g.unreviewed) parts.push(g.unreviewed + ' مقطع لم تتم مراجعته');
  return 'لا يمكن اعتماد المعاينة بعد: ' + (parts.join('، ') || 'لا توجد مقاطع صوتية') + '. راجع كل مقاطع اللغات المطلوبة واقبلها أولًا.';
}

/* قبل النسخ للذكاء الاصطناعي: المقاطع المرفوضة بنوع «الصوت فقط» يرتفع لها عدّاد إعادة الصوت مرة واحدة،
   فيتغير مفتاحها ويفقد القبول وتُعاد صياغة الصوت لهذا المقطع فقط. النص لا يتغير. */
function bumpAudioOnly(review) {
  var r = cloneReview(review), n = 0;
  Object.keys(r.clips).forEach(function (k) {
    var c = r.clips[k];
    if (c.status === 'rejected' && c.issue === 'audio_only' && !c.resolved && !c.bumped) {
      r.regen[c.base] = (r.regen[c.base] || 0) + 1;
      c.bumped = true;
      n++;
    }
  });
  return { review: r, bumped: n };
}

var SPEAKER_AR = { karma: 'كارما', narrator: 'الراوي' };
var LANG_AR = { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية', it: 'الإيطالية', de: 'الألمانية' };

/* القسم الذي يُضاف إلى زر النسخ الحالي. فارغ إن لم توجد مراجعة. */
function buildPromptSection(review) {
  var r = cloneReview(review), list = Object.keys(r.clips).map(function (k) { return r.clips[k]; });
  var acc = list.filter(function (c) { return c.status === 'accepted'; });
  var rej = list.filter(function (c) { return c.status === 'rejected' && !c.resolved; });
  if (!rej.length && !acc.length) return '';
  function order(a, b) { return LANGS.indexOf(a.lang) - LANGS.indexOf(b.lang) || a.block_index - b.block_index; }
  acc.sort(order); rej.sort(order);
  var L = [];
  L.push('=== مراجعة الصوت — قرارات الأدمن ===');
  L.push('الأدمن راجع الحكاية بصريًا وصوتيًا. الاعتراض على الصوت لا يعني بالضرورة أن النص خطأ؛ لكل مقطع مرفوض نوع معالجة واحد من اثنين:');
  L.push('(أ) المشكلة في النص أو النطق: أعد صياغة الجملة لتسهيل النطق (طريقة المعالجة رقم 4) مع الحفاظ على المعنى التاريخي. غيّر هذا المقطع فقط في اللغة المذكورة.');
  L.push('(ب) النص صحيح والمشكلة في الصوت فقط: لا تغيّر النص إطلاقًا، وأبقِه حرفيًا كما هو. لا تطلب خدمة TTS ولا تُنشئ ملفات صوتية من داخل هذه المهمة؛ تُعالج إعادة التوليد في مسار الصوت المنفصل بعد موافقة الأدمن.');
  L.push('قواعد عامة: لا تغيّر أي مقطع غير مذكور بالأسفل. حافظ على عدد المقاطع وترتيبها وعلى المتحدث لكل مقطع. أعد حزمة الحكاية كاملة بنفس العقد المعتمد. لا تضف أي بيانات قبول أو رفض أو مراجعة صوت في الناتج؛ الأدمن وحده يقبل الصوت.');
  L.push('اللهجة (للعربية فقط): مصرية طبيعية، بدون ميل للصعيدية.');
  L.push('');
  L.push('المقاطع المرفوضة (' + rej.length + '):');
  if (!rej.length) L.push('لا يوجد.');
  rej.forEach(function (c, i) {
    L.push((i + 1) + ') اللغة: ' + (LANG_AR[c.lang] || c.lang) + ' | المقطع رقم ' + (c.block_index + 1) + ' | الجزء: ' + (Number(c.chunk_index || 0) + 1) + ' | المتحدث: ' + (SPEAKER_AR[c.speaker] || c.speaker));
    L.push('   نوع المعالجة: ' + (c.issue === 'audio_only' ? '(ب) النص صحيح والصوت فقط — لا تغيّر النص' : '(أ) المشكلة في النص أو النطق — أعد الصياغة لتسهيل النطق'));
    L.push('   النص وقت المراجعة: ' + norm(c.text));
    L.push('   ملاحظة الأدمن: ' + (norm(c.note) || 'لا توجد ملاحظة'));
    if (norm(c.suggestion)) L.push('   الصياغة المقترحة: ' + norm(c.suggestion));
  });
  L.push('');
  L.push('المقاطع المقبولة (' + acc.length + ') — لا تغيّرها:');
  if (!acc.length) L.push('لا يوجد.');
  acc.forEach(function (c) {
    L.push('- ' + (LANG_AR[c.lang] || c.lang) + ' | المقطع رقم ' + (c.block_index + 1) + ' | ' + (SPEAKER_AR[c.speaker] || c.speaker));
  });
  return L.join('\n');
}

var api = {
  GEN_VERSION: GEN_VERSION, LANGS: LANGS, REQUIRED_LANGS: REQUIRED_LANGS,
  expectedSpokenText: expectedSpokenText, splitStaleSegments: splitStaleSegments, uncoveredBlocks: uncoveredBlocks,
  norm: norm, strip: strip, engineOf: engineOf,
  sha256: sha256, sha256Bytes: sha256Bytes, baseKey: baseKey, clipKey: clipKey,
  validateManifestCoverage: validateManifestCoverage,
  emptyReview: emptyReview, cloneReview: cloneReview, applyDecision: applyDecision,
  evaluateGate: evaluateGate, evaluateFiveLanguageGate: evaluateFiveLanguageGate, validateTranslationAlignment: validateTranslationAlignment, gateMessage: gateMessage, bumpAudioOnly: bumpAudioOnly, buildPromptSection: buildPromptSection
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.KHAudioReviewCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
