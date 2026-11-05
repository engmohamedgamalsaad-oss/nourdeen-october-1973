/* khaledoon/assets/audio-review-core.js
   منطق نقي لمراجعة واعتماد الصوت: مفتاح المقطع، حالة المراجعة story_meta.audio_review، شرط الاعتماد، وقسم برومبت الذكاء الاصطناعي.
   بلا DOM ولا شبكة. يعمل في المتصفح (window.KHAudioReviewCore) وفي Node للاختبار. */
(function (root) {
'use strict';

var VOICES = { karma: '592625f68416462f8b6161ddf5fdbffb', narrator: 'a02a8220d6014812aa5ff73434c54cc0' };
var GEN_VERSION = 'v1';
var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
/* لا توجد قائمة حكايات تجريبية: محرك المراجعة مشترك ويستقبل معرّف أي حكاية من القارئ. */

function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
/* مطابقة بلا تشكيل (للمقارنة فقط، لا تدخل في المفتاح) */
function strip(s) { return norm(s).replace(/[\u064B-\u065F\u0670\u0640]/g, ''); }

function engineOf(lang, speaker) {
  if (lang === 'ar') return { voice: VOICES[speaker] || '', provider: 'fish-audio', model: 's2.1-pro-free' };
  return { voice: 'edge-tts', provider: 'edge-tts', model: 'default' };
}

async function sha256(str) {
  var c = root.crypto && root.crypto.subtle ? root.crypto : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
  var buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

/* المفتاح الأساسي: الحكاية + اللغة + المتحدث + الصوت + المزوّد/الموديل + النص المنطوق (بعد تطبيع المسافات) + إصدار المولّد.
   رقم المقطع وترتيبه لا يدخلان فيه. */
async function baseKey(storyId, lang, speaker, spokenText, engine) {
  var e = engine && typeof engine === 'object' ? {
    voice: String(engine.voice || ''),
    provider: String(engine.provider || ''),
    model: String(engine.model || '')
  } : engineOf(lang, speaker);
  return sha256(['khaudio', GEN_VERSION, storyId, lang, speaker, e.voice, e.provider, e.model, norm(spokenText)].join('\u241F'));
}
/* المفتاح النهائي = الأساسي + عدّاد «إعادة الصوت» */
async function clipKey(base, regen) { return regen ? sha256(base + '\u241Fr' + regen) : base; }

/* Validate complete one-to-one coverage of every spoken story block by manifest chunks. */
function validateManifestCoverage(blocks, segments) {
  if (!Array.isArray(blocks) || !blocks.length || !Array.isArray(segments) || !segments.length) {
    return { ok: false, error: 'الحكاية أو ملف الصوت لا يحتوي على مقاطع قابلة للمراجعة.' };
  }
  var seen = Object.create(null), chunks = Object.create(null);
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i] || {};
    var blockIndex = Number(seg.block_index), chunkIndex = Number(seg.chunk_index || 0);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
      return { ok: false, error: 'يوجد مقطع صوتي مرتبط بترقيم خارج حدود الحكاية.' };
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
    var indexes = chunks[b];
    if (!indexes || !indexes.length) {
      return { ok: false, error: 'لا يوجد ملف صوتي للمقطع ' + (b + 1) + '.' };
    }
    indexes.sort(function (a, c) { return a - c; });
    for (var n = 0; n < indexes.length; n++) {
      if (indexes[n] !== n) return { ok: false, error: 'يوجد جزء مفقود أو فجوة في ملفات المقطع ' + (b + 1) + '.' };
    }
  }
  return { ok: true, blocks: blocks.length, segments: segments.length };
}

function emptyReview() { return { version: 1, regen: {}, clips: {} }; }
function cloneReview(r) {
  var x = r && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : emptyReview();
  if (!x.regen || typeof x.regen !== 'object') x.regen = {};
  if (!x.clips || typeof x.clips !== 'object') x.clips = {};
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
  var clip = {
    story_id: entry.story_id, lang: entry.lang, block_index: entry.block_index, chunk_index: Number(entry.chunk_index || 0), speaker: entry.speaker,
    base: entry.base, text: entry.text, status: decision.status, decided_at: at
  };
  if (decision.status === 'rejected') {
    clip.note = String(decision.note || '').slice(0, 1000);
    clip.suggestion = String(decision.suggestion || '').slice(0, 1000);
    clip.issue = decision.issue === 'audio_only' ? 'audio_only' : 'text';
  }
  r.clips[entry.key] = clip;
  return r;
}

/* شرط اعتماد المعاينة: كل مقطع (في اللغات الخمس) جاهز ومقبول، ولا مرفوض ولا غير مراجَع. */
function evaluateGate(entries, review, readyByKey) {
  var r = cloneReview(review), out = { ok: true, total: entries.length, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0 };
  entries.forEach(function (e) {
    var c = r.clips[e.key];
    if (readyByKey[e.key] !== 'ready') out.notReady++;
    if (c && c.status === 'accepted') out.accepted++;
    else if (c && c.status === 'rejected') out.rejected++;
    else out.unreviewed++;
  });
  out.ok = out.total > 0 && out.notReady === 0 && out.rejected === 0 && out.unreviewed === 0 && out.accepted === out.total;
  return out;
}
function evaluateFiveLanguageGate(manifests, entries, review, readyByKey) {
  var missing = LANGS.filter(function (lang) { return !manifests || !manifests[lang]; });
  if (missing.length) {
    return {
      ok: false, missingLanguages: missing, total: Array.isArray(entries) ? entries.length : 0,
      accepted: 0, rejected: 0, unreviewed: Array.isArray(entries) ? entries.length : 0, notReady: 0
    };
  }
  return evaluateGate(entries, review, readyByKey);
}

function gateMessage(g) {
  if (g.ok) return '';
  var parts = [];
  if (g.notReady) parts.push(g.notReady + ' مقطع صوته غير جاهز');
  if (g.rejected) parts.push(g.rejected + ' مقطع مرفوض');
  if (g.unreviewed) parts.push(g.unreviewed + ' مقطع لم تتم مراجعته');
  return 'لا يمكن اعتماد المعاينة بعد: ' + (parts.join('، ') || 'لا توجد مقاطع صوتية') + '. راجع كل مقاطع اللغات الخمس واقبلها أولًا.';
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
  VOICES: VOICES, GEN_VERSION: GEN_VERSION, LANGS: LANGS,
  norm: norm, strip: strip, engineOf: engineOf,
  sha256: sha256, baseKey: baseKey, clipKey: clipKey,
  validateManifestCoverage: validateManifestCoverage,
  emptyReview: emptyReview, cloneReview: cloneReview, applyDecision: applyDecision,
  evaluateGate: evaluateGate, evaluateFiveLanguageGate: evaluateFiveLanguageGate, gateMessage: gateMessage, bumpAudioOnly: bumpAudioOnly, buildPromptSection: buildPromptSection
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.KHAudioReviewCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
