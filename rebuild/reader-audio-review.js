(function () {
'use strict';
var params = new URLSearchParams(location.search);
if (params.get('draft') !== '1') return;
var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
var LANG_NAMES = { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية', it: 'الإيطالية', de: 'الألمانية' };
var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var core = window.KHAudioReviewCore;
if (!core) return;
var story = null, ctx = null, row = null, review = core.emptyReview(), entries = [], readyByKey = {};
var manifests = {}, manifestErrors = {}, audio = null, busy = false, activeLang = '', played = {}, acceptButtons = {};
var canWrite = false, manifestLoadFailure = false, initialized = false, initializing = false;
var pronunciationReport = null, pronunciationReportStatus = ''; 

function $(id) { return document.getElementById(id); }
function text(el, value) { el.textContent = value == null ? '' : String(value); }
function getContext() {
  try { ctx = JSON.parse(localStorage.getItem('kh-story-review-context') || 'null'); } catch (e) { ctx = null; }
  if (!ctx) {
    try { ctx = JSON.parse(localStorage.getItem('kh-story-preview-context') || localStorage.getItem('kh-story-preview-draft') || 'null'); } catch (e) { ctx = null; }
  }
  var id = params.get('submission'), table = params.get('table');
  if (id && (!ctx || String(ctx.submission_id) !== String(id))) {
    ctx = { submission_id: id, submission_table: table === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions' };
    try { localStorage.setItem('kh-story-review-context', JSON.stringify(ctx)); } catch (e) {}
  }
  return !!(ctx && ctx.submission_id);
}
async function adminToken() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('kh_adm_session') || sessionStorage.getItem('kh_adm_session') || 'null'); } catch (e) {}
  if (!s || !s.access_token) throw new Error('سجّل الدخول إلى لوحة الإدارة أولًا.');
  if (s.expires_at && s.expires_at - Date.now() / 1000 < 60 && s.refresh_token) {
    var rr = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (!rr.ok) throw new Error('انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.');
    var rd = await rr.json();
    s = { access_token: rd.access_token, refresh_token: rd.refresh_token, expires_at: Math.floor(Date.now() / 1000) + rd.expires_in };
    try { localStorage.setItem('kh_adm_session', JSON.stringify(s)); sessionStorage.setItem('kh_adm_session', JSON.stringify(s)); } catch (e) {}
  }
  return s.access_token;
}
function rowUrl() {
  var table = ctx.submission_table === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions';
  return SUPA + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(ctx.submission_id);
}
async function loadRow() {
  if (!getContext()) { canWrite = false; return false; }
  var stagedPackage = null;
  try { stagedPackage = JSON.parse(localStorage.getItem('kh-story-review-package') || 'null'); } catch (e) {}
  if (!stagedPackage || stagedPackage.section !== story.section || stagedPackage.slug !== story.slug) {
    throw new Error('هوية الحكاية في سياق الأدمن لا تطابق الحكاية المعروضة؛ أعد فتح المعاينة من صف الحكاية الصحيح.');
  }
  var token = await adminToken();
  canWrite = true;
  var res = await fetch(rowUrl() + '&select=*', { headers: { apikey: KEY, Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!res.ok) throw new Error('تعذرت قراءة سجل المراجعة (' + res.status + ').');
  var rows = await res.json();
  if (!rows.length) throw new Error('لم يتم العثور على سجل الحكاية.');
  row = rows[0];
  var meta = row.story_meta || {};
  review = core.cloneReview(meta.audio_review || null);
  return true;
}
function pronunciationReviewFor(entry) {
  if (!pronunciationReport || pronunciationReport.language !== entry.lang) return null;
  var match = pronunciationReport.items.find(function (item) {
    return item.entry.block_index === entry.block_index &&
      item.entry.chunk_index === entry.chunk_index && item.entry.src === entry.src;
  });
  if (!match) return null;
  var report = match.report || {};
  return {
    engine: 'faster-whisper-local',
    status: report.status || 'unknown',
    audio_sha256: report.audio_sha256 || '',
    hash_verified: match.hashVerified === true,
    match_ratio: report.match_ratio,
    detected_language: report.detected_language,
    language_probability: report.language_probability,
    language_mismatch: report.language_mismatch === true,
    language_detection_uncertain: report.language_detection_uncertain === true,
    expected_word_count: report.expected_word_count,
    recognized_word_count: report.recognized_word_count,
    transcript: report.transcript || '',
    mismatches: report.mismatches || [],
    low_confidence_words: report.low_confidence_words || []
  };
}
async function saveReview(entry, decision) {
  var key = entry && entry.key;
  if (busy) throw new Error('انتظر حتى يكتمل حفظ قرار المقطع السابق.');
  if (!row || !ctx) throw new Error('سجل المراجعة غير متصل بلوحة الإدارة.');
  busy = true;
  try {
    var token = await adminToken();
    var fresh = await fetch(rowUrl() + '&select=id,status,story_meta', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    if (!fresh.ok) throw new Error('تعذرت إعادة قراءة السجل قبل الحفظ (' + fresh.status + ').');
    var freshRows = await fresh.json();
    if (!freshRows.length) throw new Error('اختفى سجل الحكاية قبل الحفظ.');
    var current = freshRows[0], meta = Object.assign({}, current.story_meta || {});
    var currentReview = core.cloneReview(meta.audio_review || null);
    var decisionWithAnalysis = Object.assign({}, decision);
    var attachedPronunciationReview = pronunciationReviewFor(entry);
    if (attachedPronunciationReview) decisionWithAnalysis.pronunciation_review = attachedPronunciationReview;
    var next = core.applyDecision(currentReview, entry, decisionWithAnalysis);
    if (entry.source_base && entry.audio_sha256) next.audio_hashes[entry.source_base] = entry.audio_sha256;
    meta.audio_review = next;
    var saved = await fetch(rowUrl(), {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ story_meta: meta })
    });
    if (!saved.ok) throw new Error('تعذر حفظ مراجعة الصوت (' + saved.status + '): ' + (await saved.text()).slice(0, 180));
    var savedRows = await saved.json();
    var savedReview = savedRows[0] && savedRows[0].story_meta && savedRows[0].story_meta.audio_review;
    if (!savedReview || !savedReview.clips || !savedReview.clips[key]) throw new Error('لم يؤكد الخادم حفظ قرار المقطع.');
    var verify = await fetch(rowUrl() + '&select=id,story_meta', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    if (!verify.ok) throw new Error('تعذر التحقق النهائي من حفظ المراجعة.');
    var verifiedRows = await verify.json();
    var verified = verifiedRows[0] && verifiedRows[0].story_meta && verifiedRows[0].story_meta.audio_review;
    if (!verified || !verified.clips || !verified.clips[key] || verified.clips[key].status !== decision.status) {
      throw new Error('فشل التحقق النهائي من قرار المقطع.');
    }
    review = core.cloneReview(verified);
  } finally {
    busy = false;
  }
  render();
}
function manifestUrl(lang) {
  return new URL('../assets/audio/' + encodeURIComponent(story.section) + '/' + encodeURIComponent(story.slug) + '/' + encodeURIComponent(lang) + '/manifest.json', location.href).href;
}
async function loadArabicExpectedTexts(blocks) {
  var fallback = blocks.map(function (block) { return String(block && block.text || ''); });
  var url = new URL('../stories/' + encodeURIComponent(story.section) + '/' + encodeURIComponent(story.slug) + '/audio-pronunciation.json', location.href);
  var response = await fetch(url.href, { cache: 'no-cache' });
  if (response.status === 404) return fallback;
  if (!response.ok) throw new Error('تعذر تحميل ملف نص النطق العربي (' + response.status + ').');
  var data = await response.json();
  if (!data || data.version !== 1 || data.story !== story.slug || data.language !== 'ar' || !data.blocks || typeof data.blocks !== 'object') {
    throw new Error('ملف نص النطق العربي لا يطابق الحكاية الحالية.');
  }
  if (!Array.isArray(data.approved_audio_only_rewrites)) {
    throw new Error('قائمة تعديلات النطق الصوتي المعتمدة غير صالحة.');
  }
  var approved = {};
  data.approved_audio_only_rewrites.forEach(function (rawIndex) {
    var index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= blocks.length || approved[index]) {
      throw new Error('قائمة تعديلات النطق الصوتي تحتوي رقم مقطع غير صالح أو مكرر.');
    }
    if (typeof data.blocks[String(index)] !== 'string' || !data.blocks[String(index)].trim()) {
      throw new Error('يوجد تعديل نطق معتمد بلا نص صوتي للمقطع ' + (index + 1) + '.');
    }
    approved[index] = true;
  });
  return blocks.map(function (block, index) {
    return approved[index] ? data.blocks[String(index)] : fallback[index];
  });
}
async function loadManifests() {
  manifests = {}; manifestErrors = {}; entries = []; readyByKey = {}; played = {}; acceptButtons = {}; manifestLoadFailure = false;
  var expectedTexts = {};
  LANGS.forEach(function (lang) {
    var localized = story.i18n && story.i18n[lang];
    expectedTexts[lang] = localized && Array.isArray(localized.blocks)
      ? localized.blocks.map(function (block) { return String(block && block.text || ''); }) : [];
  });
  expectedTexts.ar = await loadArabicExpectedTexts(expectedTexts.ar.map(function (text) { return { text: text }; }));
  var results = await Promise.all(LANGS.map(async function (lang) {
    try {
      var res = await fetch(manifestUrl(lang), { cache: 'no-cache' });
      if (!res.ok) { var requestError = new Error('HTTP ' + res.status); requestError.isMissingManifest = res.status === 404; throw requestError; }
      var data = await res.json();
      if (!data || data.version !== 1 || data.story !== story.slug || data.section !== story.section || data.language !== lang || !Array.isArray(data.segments) || !data.segments.length) {
        throw new Error('بيانات manifest غير متوافقة مع الحكاية أو اللغة.');
      }
      data.segments.forEach(function (seg) {
        var expected = seg.speaker === 'karma' ? core.VOICES.karma : seg.speaker === 'narrator' ? core.VOICES.narrator : '';
        var engineOk = lang === 'ar'
          ? seg.provider === 'fish-audio' && seg.model === 's2.1-pro-free' && seg.voice === expected
          : seg.provider === 'edge-tts' && seg.model === 'edge-tts' && typeof seg.voice === 'string' && !!seg.voice.trim();
        if (!expected || !engineOk || typeof seg.src !== 'string' || !/^[A-Za-z0-9_-]+\.mp3$/.test(seg.src) || typeof seg.text !== 'string' || !seg.text.trim() || (seg.audio_sha256 != null && !/^[a-f0-9]{64}$/i.test(String(seg.audio_sha256)))) {
          throw new Error('مقطع صوتي لا يطابق المتحدث أو مزوّد/صوت اللغة المعتمد.');
        }
      });
      var localized = story.i18n && story.i18n[lang];
      var coverage = core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang]);
      if (!coverage.ok) throw new Error(coverage.error);
      manifests[lang] = data;
    } catch (e) {
      manifestErrors[lang] = String(e && e.message || e);
      if (!e || !e.isMissingManifest) manifestLoadFailure = true;
    }
  }));
  var pendingEntries = [];
  LANGS.forEach(function (lang) {
    var manifest = manifests[lang];
    if (!manifest) return;
    manifest.segments.forEach(function (seg) {
      pendingEntries.push((async function () {
        var blockIndex = Number(seg.block_index), chunkIndex = Number(seg.chunk_index || 0);
        var storyKey = story.section + '/' + story.slug + '#' + blockIndex + ':' + chunkIndex;
        var engine = { voice: seg.voice, provider: seg.provider, model: seg.model };
        var sourceBase = await core.baseKey(storyKey, lang, seg.speaker, seg.text, engine);
        var knownAudioHash = String(seg.audio_sha256 || review.audio_hashes[sourceBase] || '');
        var revision = String(knownAudioHash || seg.audio_revision || '');
        var base = await core.baseKey(storyKey, lang, seg.speaker, seg.text, Object.assign({}, engine, { audio_revision: revision }));
        var entry = { story_id: story.section + '/' + story.slug, lang: lang, block_index: blockIndex, chunk_index: chunkIndex,
          speaker: seg.speaker, base: base, source_base: sourceBase, audio_sha256: knownAudioHash,
          text: seg.text, src: seg.src, manifest: manifest, segment: seg };
        var regen = Number(review.regen[base] || 0);
        entry.key = await core.clipKey(base, regen);
        readyByKey[entry.key] = 'ready';
        return entry;
      })());
    });
  });
  entries = await Promise.all(pendingEntries);
}
function gate() {
  if (!initialized) return { ok: false, loading: true, total: 0, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0 };
  if (manifestLoadFailure) return { ok: false, loadError: true, total: entries.length, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0 };
  return core.evaluateFiveLanguageGate(manifests, entries, review, readyByKey, played);
}
function gateSummary() {
  var g = gate();
  if (g.loading) return 'جارٍ تحميل وفحص ملفات الصوت؛ لن يتاح اعتماد المعاينة قبل اكتمال الفحص.';
  if (g.loadError) {
    var details = LANGS.filter(function (lang) { return !!manifestErrors[lang]; }).map(function (lang) {
      return LANG_NAMES[lang] + ': ' + manifestErrors[lang];
    });
    return 'تعذر التحقق من ملفات الصوت بسبب خطأ تحميل أو بيانات غير صالحة. لا يمكن اعتماد المعاينة قبل إصلاح المشكلة.' + (details.length ? ' ' + details.join(' | ') : '');
  }
  if (g.missingLanguages) return 'مراجعة الصوت غير مكتملة: ملفات الصوت غير جاهزة للغات ' + g.missingLanguages.map(function (l) { return LANG_NAMES[l]; }).join('، ') + '.';
  if (g.ok) return 'تم قبول كل المقاطع الصوتية (' + g.accepted + '/' + g.total + ').';
  return core.gateMessage(g) + ' المقبول: ' + g.accepted + '/' + g.total + '.';
}
function canApprove() { return gate().ok; }
window.KHStoryAudioReview = { canApprove: canApprove, gateSummary: gateSummary, gate: gate };
var activeObjectUrl = null;
async function play(entry, button) {
  if (!entry || !entry.src) return;
  var control = button.closest('.kh-audio-review-controls');
  var stateNode = control && control.querySelector('.kh-audio-review-state');
  var acceptBtn = control && control.querySelector('.kh-audio-review-btn.accept');
  played[entry.key] = false;
  if (acceptBtn) acceptBtn.disabled = true;
  if (stateNode) stateNode.textContent = 'جارٍ تحميل الملف والتحقق من بصمته…';
  if (!audio) audio = new Audio();
  try {
    try { audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.pause(); audio.currentTime = 0; } catch (e) {}
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    var url = new URL(entry.src + '?v=' + encodeURIComponent(String(entry.audio_sha256 || entry.segment.audio_sha256 || entry.segment.hash || entry.manifest.generated_at || entry.manifest.version)), manifestUrl(entry.lang));
    var response = await fetch(url.href, { cache: 'no-store' });
    if (!response.ok) throw new Error('تعذر تحميل ملف الصوت (' + response.status + ').');
    var blob = await response.blob();
    var digest = await core.sha256Bytes(await blob.arrayBuffer());
    var previousKey = entry.key;
    if (entry.audio_sha256 !== digest) {
      entry.audio_sha256 = digest;
      entry.segment.audio_sha256 = digest;
      entry.base = await core.baseKey(entry.story_id, entry.lang, entry.speaker, entry.text, {
        voice: entry.segment.voice, provider: entry.segment.provider, model: entry.segment.model, audio_revision: digest
      });
      entry.key = await core.clipKey(entry.base, Number(review.regen[entry.base] || 0));
    }
    entry.segment.audio_sha256 = digest;
    readyByKey[entry.key] = 'ready';
    if (previousKey !== entry.key) {
      delete readyByKey[previousKey];
      delete played[previousKey];
      delete acceptButtons[previousKey];
      if (acceptBtn) acceptButtons[entry.key] = acceptBtn;
      if (control) control.dataset.clipKey = entry.key;
      if (stateNode) stateNode.textContent = 'تم التحقق من نسخة صوت مختلفة؛ يلزم مراجعتها من جديد.';
    }
    played[entry.key] = false;
    if (acceptBtn) acceptBtn.disabled = true;
    var old = document.querySelector('.kh-audio-review-playing');
    if (old) old.classList.remove('kh-audio-review-playing');
    button.classList.add('kh-audio-review-playing');
    activeObjectUrl = URL.createObjectURL(blob);
    audio.src = activeObjectUrl;
    audio.load();
    audio.onended = function () {
      button.classList.remove('kh-audio-review-playing');
      played[entry.key] = true;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = false;
      if (stateNode) stateNode.textContent = 'اكتمل الاستماع — يمكنك قبول المقطع أو رفضه.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    audio.onerror = function () {
      button.classList.remove('kh-audio-review-playing');
      played[entry.key] = false;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true;
      if (stateNode) stateNode.textContent = 'تعذر تشغيل المقطع؛ لم يتم تسجيل الاستماع.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    var playback = audio.play();
    if (playback && playback.catch) playback.catch(function () {
      button.classList.remove('kh-audio-review-playing');
      played[entry.key] = false;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true;
      if (stateNode) stateNode.textContent = 'تعذر بدء تشغيل المقطع؛ حاول مرة أخرى.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    });
  } catch (e) {
    button.classList.remove('kh-audio-review-playing');
    if (acceptBtn) acceptBtn.disabled = true;
    if (stateNode) stateNode.textContent = 'تعذر التحقق من الملف الصوتي: ' + (e.message || e);
  }
}
async function importPronunciationReport(file) {
  pronunciationReport = null; pronunciationReportStatus = '';
  if (!file) return;
  try {
    var report = JSON.parse(await file.text());
    if (!report || report.format !== 'KHALEDOON_AUDIO_PRONUNCIATION_REVIEW_V1' ||
        report.story !== story.slug || report.section !== story.section ||
        !LANGS.includes(report.language) || !Array.isArray(report.reports)) {
      throw new Error('ملف التقرير لا يطابق الحكاية أو القسم أو اللغة.');
    }
    var reportEntries = report.reports.filter(function (r) { return r && typeof r.src === 'string'; });
    if (!reportEntries.length || reportEntries.length !== report.reports.length) throw new Error('التقرير يحتوي نتائج بلا أسماء ملفات قابلة للربط.');
    var verified = [], seenSources = {};
    for (var i = 0; i < reportEntries.length; i++) {
      var item = reportEntries[i];
      if (seenSources[item.src]) throw new Error('التقرير يحتوي نتيجة مكررة للملف: ' + item.src);
      seenSources[item.src] = true;
      var entry = entries.find(function (e) {
        return e.lang === report.language && e.src === item.src &&
          (item.block_index == null || e.block_index === Number(item.block_index)) &&
          (item.chunk_index == null || e.chunk_index === Number(item.chunk_index));
      });
      if (!entry) throw new Error('تعذر مطابقة مقطع في التقرير مع manifest الحالي: ' + item.src);
      if (!/^[a-f0-9]{64}$/i.test(String(item.audio_sha256 || ''))) {
        verified.push({ entry: entry, report: item, blob: null, hashVerified: false });
        continue;
      }
      var url = new URL(entry.src, manifestUrl(entry.lang));
      var response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) throw new Error('تعذر التحقق من الملف الصوتي ' + item.src + ' (' + response.status + ').');
      var blob = await response.blob();
      var digest = await core.sha256Bytes(await blob.arrayBuffer());
      if (digest.toLowerCase() !== String(item.audio_sha256).toLowerCase()) {
        throw new Error('التقرير قديم أو لا يطابق الملف الصوتي الحالي: ' + item.src);
      }
      verified.push({ entry: entry, report: item, blob: blob, hashVerified: true });
    }
    pronunciationReport = { language: report.language, items: verified };
    var verifiedCount = verified.filter(function (item) { return item.hashVerified; }).length;
    var unverifiedCount = verified.length - verifiedCount;
    pronunciationReportStatus = 'تم التحقق من بصمات ' + verifiedCount + ' مقطعًا' +
      (unverifiedCount ? '؛ ' + unverifiedCount + ' نتيجة معروضة دون استماع موضعي لغياب بصمة صالحة' : '') +
      '. نتائج ASR إرشادية وتحتاج استماعًا بشريًا.';
  } catch (e) {
    pronunciationReport = null;
    pronunciationReportStatus = 'لم يُحمّل التقرير: ' + (e && e.message || e);
  }
  render();
}
function renderPronunciationResult(entry, panel) {
  var match = null;
  if (pronunciationReport && pronunciationReport.language === entry.lang) {
    match = pronunciationReport.items.find(function (item) {
      return item.entry.block_index === entry.block_index && item.entry.chunk_index === entry.chunk_index && item.entry.src === entry.src;
    }) || null;
  }
  if (!match) {
    var savedClip = review.clips[entry.key];
    if (savedClip && savedClip.pronunciation_review) {
      match = { entry: entry, report: savedClip.pronunciation_review, blob: null, hashVerified: false, stored: true };
    }
  }
  if (!match) return;
  var box = document.createElement('div'); box.className = 'kh-audio-asr-result';
  var report = match.report;
  var summary = document.createElement('div');
  var evidenceLabel = match.stored
    ? (report.hash_verified && report.audio_sha256 === entry.audio_sha256
      ? 'نتيجة محفوظة — بصمتها تطابق manifest، ويجب التحقق الحي عند الاستماع — '
      : 'نتيجة محفوظة ببصمة غير متحققة أو غير مطابقة — ')
    : (match.hashVerified ? 'نتيجة موثقة بالبصمة — ' : 'نتيجة غير موثقة بالبصمة — ');
  summary.textContent = evidenceLabel + 'مدقق النطق: ' + String(report.status || 'نتيجة غير محددة') +
    (typeof report.match_ratio === 'number' ? ' | تطابق النص: ' + Math.round(report.match_ratio * 100) + '%' : '') +
    (report.detected_language ? ' | اللغة المكتشفة: ' + report.detected_language : '') +
    (typeof report.language_probability === 'number' ? ' | احتمال اللغة: ' + Math.round(report.language_probability * 100) + '%' : '');
  box.appendChild(summary);
  if (report.language_mismatch || report.language_detection_uncertain) {
    var languageWarning = document.createElement('div');
    languageWarning.textContent = 'تنبيه: تحقق من اللغة المكتشفة يدويًا؛ المدقق لا يعتمد صحة اللغة تلقائيًا.';
    box.appendChild(languageWarning);
  }
  var flagged = [];
  (Array.isArray(report.mismatches) ? report.mismatches : []).forEach(function (item) {
    var recognized = Array.isArray(item.recognized) ? item.recognized : [];
    if (recognized.length) {
      recognized.forEach(function (word) {
        flagged.push({ word: word, expected: (item.expected || []).join(' '), start: item.start, end: item.end, type: 'اختلاف عن النص', playable: typeof item.start === 'number' });
      });
    } else {
      flagged.push({ word: 'لم يتعرف على: ' + (item.expected || []).join(' '), type: 'جزء متوقع غير موجود في التفريغ', playable: false });
    }
  });
  (Array.isArray(report.low_confidence_words) ? report.low_confidence_words : []).forEach(function (item) {
    flagged.push({ word: item.word, start: item.start, end: item.end, probability: item.probability, type: 'احتمال نطق منخفض', playable: typeof item.start === 'number' });
  });
  if (!flagged.length) {
    var clean = document.createElement('div');
    clean.textContent = Array.isArray(report.words)
      ? 'لم يرصد المدقق كلمات محددة للمراجعة؛ هذه نتيجة آلية إرشادية ولا تعني اعتماد النطق.'
      : 'لم ينتج المدقق تفريغًا صالحًا لهذا المقطع؛ راجع حالة التقرير واستمع للمقطع يدويًا.';
    box.appendChild(clean);
  }
  flagged.forEach(function (item) {
    var line = document.createElement('div'); line.className = 'kh-audio-asr-word';
    var label = document.createElement('span');
    label.textContent = item.word + (item.expected ? ' | المتوقع: ' + item.expected : '') + ' — ' + item.type +
      (typeof item.probability === 'number' ? ' (' + Math.round(item.probability * 100) + '%)' : '') +
      (typeof item.start === 'number' ? ' [' + item.start.toFixed(2) + 's]' : '');
    line.appendChild(label);
    if (item.playable && match.hashVerified && match.blob) {
      var listen = makeButton('▶ موضع الكلمة', 'asr-listen', function () {
        playPronunciationRange(match, item, listen, panel);
      });
      line.appendChild(listen);
    }
    box.appendChild(line);
  });
  panel.appendChild(box);
}
async function playPronunciationRange(match, item, button, panel) {
  if (!match || !match.hashVerified || !match.blob || !Number.isFinite(Number(item.start))) return;
  try {
    if (!audio) audio = new Audio();
    try { audio.pause(); audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; } catch (e) {}
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(match.blob);
    audio.src = activeObjectUrl;
    audio.load();
    await new Promise(function (resolve, reject) {
      audio.onloadedmetadata = resolve; audio.onerror = function () { reject(new Error('تعذر تحميل الصوت')); };
    });
    var start = Math.max(0, Number(item.start) - 0.35);
    var end = Number.isFinite(Number(item.end)) ? Number(item.end) + 0.55 : start + 2;
    audio.currentTime = Math.min(start, Math.max(0, audio.duration - 0.05));
    audio.onended = null;
    await audio.play();
    audio.ontimeupdate = function () {
      if (audio.currentTime >= end) { audio.pause(); audio.ontimeupdate = null; }
    };
  } catch (e) {
    var state = panel.querySelector('.kh-audio-review-state');
    if (state) state.textContent = 'تعذر تشغيل موضع الكلمة: ' + (e.message || e);
  }
}
function makeButton(label, cls, handler) {
  var b = document.createElement('button'); b.type = 'button'; b.className = 'kh-audio-review-btn ' + (cls || ''); b.textContent = label;
  b.addEventListener('click', handler); return b;
}
function render() {
  if (!story) return;
  var banner = document.getElementById('kh-audio-review-gate');
  if (!banner) { banner = document.createElement('div'); banner.id = 'kh-audio-review-gate'; banner.className = 'kh-audio-review-gate'; var first = document.querySelector('#blocks'); if (first && first.parentNode) first.parentNode.insertBefore(banner, first); }
  text(banner, gateSummary());
  banner.hidden = false;
  var lang = document.documentElement.lang;
  var host = $('blocks');
  if (!host) return;
  var importer = document.getElementById('kh-audio-asr-import');
  if (!importer) {
    importer = document.createElement('div'); importer.id = 'kh-audio-asr-import'; importer.className = 'kh-audio-review-gate';
    var importLabel = document.createElement('label'); importLabel.htmlFor = 'kh-audio-asr-file';
    importLabel.textContent = 'تحميل تقرير مدقق النطق (JSON) — ' + (pronunciationReportStatus || 'اختياري');
    var input = document.createElement('input'); input.id = 'kh-audio-asr-file'; input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', function () { importPronunciationReport(input.files && input.files[0]); });
    importer.append(importLabel, input); host.parentNode.insertBefore(importer, host);
  } else {
    var importLabelExisting = importer.querySelector('label');
    if (importLabelExisting) importLabelExisting.textContent = 'تحميل تقرير مدقق النطق (JSON) — ' + (pronunciationReportStatus || 'اختياري');
  }
  var blocks = Array.prototype.slice.call(host.querySelectorAll(':scope > .block'));
  blocks.forEach(function (block) { var old = block.querySelector(':scope > .kh-audio-review-controls'); if (old) old.remove(); });
  if (!manifests[lang]) return;
  if (activeLang !== lang) activeLang = lang;
  var manifest = manifests[lang];
  entries.filter(function (e) { return e.lang === lang; }).forEach(function (entry) {
    var block = blocks[entry.block_index];
    if (!block) return;
    var panel = document.createElement('div'); panel.className = 'kh-audio-review-controls'; panel.dataset.clipKey = entry.key;
    var saved = review.clips[entry.key];
    var state = document.createElement('span'); state.className = 'kh-audio-review-state';
    text(state, saved ? (saved.status === 'accepted' ? 'مقبول ✓' : 'مرفوض ✕') : 'لم يُراجع بعد');
    var playBtn = makeButton('▶ استماع', 'play', function () { play(entry, playBtn); });
    var acceptBtn = makeButton('✓ قبول', 'accept', async function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل قبوله.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      state.textContent = 'جارٍ الحفظ…';
      try { await saveReview(entry, { status: 'accepted' }); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
    });
    acceptBtn.disabled = !played[entry.key];
    acceptButtons[entry.key] = acceptBtn;
    var rejectBtn = makeButton('✕ رفض / ملاحظة', 'reject', function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الملاحظة أو الرفض.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      editor.hidden = !editor.hidden;
      rejectBtn.textContent = editor.hidden ? '✕ رفض / ملاحظة' : 'حفظ الرفض';
    });
    var editor = document.createElement('div'); editor.className = 'kh-audio-review-editor'; editor.hidden = true;
    var issue = document.createElement('select');
    [['text','مشكلة في النص أو النطق'],['audio_only','النص صحيح والمشكلة في الصوت فقط']].forEach(function (opt) {
      var o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1]; issue.appendChild(o);
    });
    var note = document.createElement('textarea'); note.maxLength = 1000; note.placeholder = 'ملاحظتك على هذا المقطع (مطلوبة عند الرفض)';
    var suggestion = document.createElement('textarea'); suggestion.maxLength = 1000; suggestion.placeholder = 'صياغة مقترحة بديلة (اختياري — لا تُطبّق تلقائيًا)';
    if (saved) { note.value = saved.note || ''; suggestion.value = saved.suggestion || ''; issue.value = saved.issue || 'text'; }
    var saveReject = makeButton('حفظ الرفض', 'reject-save', async function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الرفض.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      if (!note.value.trim()) { note.focus(); state.textContent = 'اكتب ملاحظة قبل حفظ الرفض.'; return; }
      state.textContent = 'جارٍ حفظ الرفض…';
      try { await saveReview(entry, { status: 'rejected', note: note.value, suggestion: suggestion.value, issue: issue.value }); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
    });
    editor.append(issue, note, suggestion, saveReject);
    panel.append(playBtn, acceptBtn, rejectBtn, state, editor);
    renderPronunciationResult(entry, panel);
    block.appendChild(panel);
  });
  text(banner, gateSummary());
  banner.hidden = false;
}
function injectStyles() {
  if ($('kh-audio-review-style')) return;
  var style = document.createElement('style'); style.id = 'kh-audio-review-style';
  style.textContent = [
    '.kh-audio-review-controls{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 0;padding:8px 10px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:10px;background:color-mix(in srgb,var(--panel) 88%,transparent);font:600 12px/1.5 Cairo,Arial,sans-serif}',
    '.kh-audio-review-btn{border:1px solid var(--accent);border-radius:8px;padding:5px 9px;background:transparent;color:inherit;font:700 12px Cairo,Arial,sans-serif;cursor:pointer;min-height:32px}',
    '.kh-audio-review-btn.accept{border-color:#4b9a70;color:#4b9a70}.kh-audio-review-btn.reject,.kh-audio-review-btn.reject-save{border-color:#b66b6b;color:#d88b8b}',
    '.kh-audio-review-btn.kh-audio-review-playing{background:var(--accent);color:#14202a}',
    '.kh-audio-review-state{margin-inline-start:auto;font-size:12px;color:var(--muted)}',
    '.kh-audio-review-editor{display:grid;grid-template-columns:1fr;gap:7px;flex:1 1 100%;min-width:0;padding-top:8px}',
    '.kh-audio-review-editor[hidden]{display:none!important}.kh-audio-review-editor textarea,.kh-audio-review-editor select{box-sizing:border-box;width:100%;min-width:0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:13px/1.6 Cairo,Arial,sans-serif}',
    '.kh-audio-review-gate{max-width:1100px;margin:8px auto;padding:8px 12px;border:1px solid var(--accent);border-radius:10px;color:var(--text);font:600 13px/1.6 Cairo,Arial,sans-serif}',
    '.kh-audio-review-gate[hidden]{display:none!important}',
    '.kh-audio-asr-result{display:grid;gap:6px;flex:1 1 100%;padding:8px;margin-top:6px;border-top:1px dashed var(--line);font-size:12px}',
    '.kh-audio-asr-word{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 0}',
    '@media print{.kh-audio-review-controls,.kh-audio-review-gate{display:none!important}}',
    '@media(max-width:600px){.kh-audio-review-controls{gap:5px;padding:7px}.kh-audio-review-btn{padding:5px 7px}.kh-audio-review-state{flex-basis:100%;margin:0}}'
  ].join('');
  document.head.appendChild(style);
}
async function initialize(nextStory) {
  if (!nextStory || !nextStory.slug || nextStory.section === 'october' || initializing || initialized) return;
  initializing = true;
  story = nextStory;
  injectStyles();
  try {
    var connected = await loadRow();
    if (!connected) { initializing = false; return; }
    await loadManifests();
    initialized = true;
    initializing = false;
    render();
  } catch (e) {
    manifestLoadFailure = true;
    initialized = true;
    initializing = false;
    var host = $('blocks');
    if (host) {
      var note = document.createElement('p'); note.className = 'kh-audio-review-gate';
      text(note, 'تعذر تحميل مراجعة الصوت: ' + (e.message || e));
      host.parentNode.insertBefore(note, host);
    }
  }
}
document.addEventListener('kh-story-audio-context', function () {
  if (window.__KH_STORY_PACKAGE) initialize(window.__KH_STORY_PACKAGE);
});
document.addEventListener('site-language-change', function () { render(); });
if (window.__KH_STORY_PACKAGE) initialize(window.__KH_STORY_PACKAGE);
})();