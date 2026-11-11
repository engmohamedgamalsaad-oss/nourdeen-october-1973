(function () {
'use strict';
var params = new URLSearchParams(location.search);
if (params.get('draft') !== '1') return;
var SCRIPT_SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
var REQUIRED_LANGS = ['ar', 'en'];
var LANG_NAMES = { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية', it: 'الإيطالية', de: 'الألمانية' };
var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var core = window.KHAudioReviewCore;
if (!core) return;
var story = null, ctx = null, row = null, review = core.emptyReview(), entries = [], readyByKey = {};
var manifestStale = {}, manifestGaps = {}, manifestMissing = {};
var manifests = {}, manifestErrors = {}, audio = null, busy = false, activeLang = '', played = {}, acceptButtons = {};
var canWrite = false, manifestLoadFailure = false, initialized = false, initializing = false;
var pronunciationReport = null, pronunciationReportStatus = ''; 
var initialArabicStageAttempted = false;
var speechTexts = {}, speechTextBusy = {}, speechTextDirty = {};
var loadedAudio = {};
var activeControl = null;

/* أيقونات SVG ثابتة (لا تحتوي أي بيانات خارجية) */
var ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9z"/></svg>',
  spinner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10h-3a7 7 0 1 1-7-7z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>'
};

function $(id) { return document.getElementById(id); }
function text(el, value) { el.textContent = value == null ? '' : String(value); }
function speakerLabel(speaker) { return speaker === 'karma' ? 'كارما' : speaker === 'narrator' ? 'الراوي' : String(speaker || ''); }
function speakerAvatar(speaker) {
  var a = document.createElement('span');
  a.className = 'kh-avatar';
  a.setAttribute('aria-hidden', 'true');
  a.textContent = speaker === 'karma' ? '👧' : '🎙️';
  return a;
}
function fmtTime(sec) {
  sec = Number(sec);
  if (!isFinite(sec) || sec < 0) sec = 0;
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
/* حالة المشغّل البصرية للبطاقة: idle | loading | playing | paused | ended | error | unavailable */
function setPlayerState(control, state) {
  if (!control) return;
  control.dataset.player = state;
  if (state !== 'loading') control.dataset.indeterminate = '0';
}
function resetProgress(control) {
  if (!control) return;
  var fill = control.querySelector('.kh-audio-progress-fill');
  var time = control.querySelector('.kh-audio-time');
  if (fill) fill.style.width = '0%';
  if (time) time.textContent = '0:00 / 0:00';
}
function updateProgress(control) {
  if (!control || !audio) return;
  var fill = control.querySelector('.kh-audio-progress-fill');
  var time = control.querySelector('.kh-audio-time');
  var d = audio.duration, c = audio.currentTime;
  if (fill) fill.style.width = (isFinite(d) && d > 0 ? Math.min(100, (c / d) * 100) : 0) + '%';
  if (time) time.textContent = fmtTime(c) + ' / ' + fmtTime(isFinite(d) ? d : 0);
}
function markProgressDone(control) {
  if (!control) return;
  var fill = control.querySelector('.kh-audio-progress-fill');
  var time = control.querySelector('.kh-audio-time');
  if (fill) fill.style.width = '100%';
  if (time) time.textContent = 'اكتمل الاستماع';
}
/* نسبة التحميل أثناء جلب ملف الصوت؛ null تعني أن حجم الملف غير معروف */
function showLoadProgress(control, ratio) {
  if (!control) return;
  var fill = control.querySelector('.kh-audio-progress-fill');
  var time = control.querySelector('.kh-audio-time');
  if (ratio == null) {
    control.dataset.indeterminate = '1';
    if (time) time.textContent = 'جارٍ التحميل…';
    return;
  }
  control.dataset.indeterminate = '0';
  var pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  if (fill) fill.style.width = pct + '%';
  if (time) time.textContent = 'تحميل ' + pct + '%';
}
/* سطر حالة الصوت: idle قبل التحميل، preparing أثناءه، ready بعده، ثم playing/paused/ended/failed */
function setAudioStatus(control, kind, message) {
  var node = control && control.querySelector('.kh-audio-ready-state');
  if (!node) return;
  node.className = 'kh-audio-ready-state ' + kind;
  node.textContent = message;
}
function iconButton(iconKey, label, cls, handler) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'kh-audio-review-btn ' + (cls || '');
  var ico = document.createElement('span');
  ico.className = 'kh-btn-ico';
  ico.innerHTML = ICONS[iconKey] || '';
  var lbl = document.createElement('span');
  lbl.className = 'kh-btn-lbl';
  lbl.textContent = label;
  b.append(ico, lbl);
  b.addEventListener('click', handler);
  return b;
}
function setButtonFace(btn, iconKey, label) {
  if (!btn) return;
  var ico = btn.querySelector('.kh-btn-ico'), lbl = btn.querySelector('.kh-btn-lbl');
  if (ico && iconKey) ico.innerHTML = ICONS[iconKey] || '';
  if (lbl && label != null) lbl.textContent = label;
}
function setPlayButton(button, mode) {
  var face = mode === 'pause' ? ['pause', 'إيقاف مؤقت']
    : mode === 'resume' ? ['play', 'استئناف']
    : mode === 'loading' ? ['spinner', 'جارٍ التحميل…']
    : ['play', 'تشغيل'];
  setButtonFace(button, face[0], face[1]);
  button.dataset.mode = mode;
}
function setAcceptState(btn, enabled, hasSaved) {
  if (!btn) return;
  btn.disabled = !enabled;
  if (enabled) setButtonFace(btn, 'check', 'موافقة على الصوت');
  else setButtonFace(btn, 'lock', hasSaved ? 'تم حفظ القرار — استمع مجددًا لتغييره' : 'استمع للنهاية لتفعيل الموافقة');
}
function buildSteps(labels) {
  var ol = document.createElement('ol');
  ol.className = 'kh-audio-steps';
  labels.forEach(function (label, i) {
    var li = document.createElement('li');
    li.dataset.n = String(i + 1);
    li.textContent = label;
    ol.appendChild(li);
  });
  return ol;
}
function syncSteps(control) {
  if (!control) return;
  var items = control.querySelectorAll('.kh-audio-steps li');
  if (items.length < 2) return;
  var listened = control.dataset.listened === '1';
  var decided = control.dataset.review === 'accepted' || control.dataset.review === 'rejected';
  items[0].className = (listened || decided) ? 'done' : 'active';
  items[1].className = decided ? 'done' : (listened ? 'active' : '');
}
/* يعيد بطاقة متوقفة/غير نشطة إلى شكلها الهادئ مع الاحتفاظ بحالة "تم الاستماع" */
function settleControl(ctrl) {
  if (!ctrl) return;
  var done = played[ctrl.dataset.clipKey] === true;
  var loaded = ctrl.dataset.loaded === '1';
  setPlayerState(ctrl, done ? 'ended' : 'idle');
  if (done) markProgressDone(ctrl); else resetProgress(ctrl);
  setAudioStatus(ctrl, done ? 'ended' : (loaded ? 'ready' : 'idle'),
    done ? 'اكتمل الاستماع' : (loaded ? 'تم التحميل · جاهز للتشغيل' : 'لم يُحمَّل بعد — اضغط تشغيل'));
  var btn = ctrl.querySelector('.kh-audio-review-btn.play');
  if (btn) setPlayButton(btn, 'play');
}
async function fetchBlobWithProgress(href, onProgress) {
  var response = await fetch(href, { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر تحميل ملف الصوت (' + response.status + ').');
  var total = Number(response.headers.get('content-length')) || 0;
  var type = response.headers.get('content-type') || '';
  if (type.indexOf('audio/') !== 0) type = 'audio/mpeg';
  if (!response.body || typeof response.body.getReader !== 'function') {
    onProgress(null);
    return await response.blob();
  }
  var reader = response.body.getReader(), chunks = [], received = 0;
  onProgress(total ? 0 : null);
  for (;;) {
    var step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    received += step.value.length;
    onProgress(total ? Math.min(1, received / total) : null);
  }
  onProgress(1);
  return new Blob(chunks, { type: type });
}
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
    var refreshController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var refreshTimeout = refreshController ? setTimeout(function () { refreshController.abort(); }, 15000) : null;
    var rr;
    try {
      rr = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
        cache: 'no-store',
        signal: refreshController ? refreshController.signal : undefined
      });
    } catch (refreshError) {
      if (refreshError && refreshError.name === 'AbortError') {
        throw new Error('انتهت مهلة تجديد جلسة الإدارة بعد 15 ثانية. سجّل الدخول إلى لوحة الإدارة من جديد ثم أعد فتح المعاينة.');
      }
      throw new Error('تعذر تجديد جلسة الإدارة: ' + (refreshError && refreshError.message || refreshError));
    } finally {
      if (refreshTimeout) clearTimeout(refreshTimeout);
    }
    if (!rr.ok) throw new Error('انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.');
    var rd = await rr.json();
    s = { access_token: rd.access_token, refresh_token: rd.refresh_token, expires_at: Math.floor(Date.now() / 1000) + rd.expires_in };
    try { localStorage.setItem('kh_adm_session', JSON.stringify(s)); sessionStorage.setItem('kh_adm_session', JSON.stringify(s)); } catch (e) {}
  }
  return s.access_token;
}
/* اسم الخدمة الخارجية التي أصدرت upstream_status بحسب الإجراء المطلوب، لا افتراض أنها Gemini دائمًا. */
function upstreamServiceName(action) {
  if (action === 'prepare_speech_text') return 'Gemini';
  if (action === 'generate' || action === 'generation_status' || action === 'stage') return 'GitHub Actions';
  return 'خدمة خارجية';
}
async function audioAssetsRequest(payload) {
  var token = await adminToken();
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeout = controller ? setTimeout(function () { controller.abort(); }, payload && (payload.action === 'prepare_speech_text' || payload.action === 'publish_audio') ? 125000 : 25000) : null;
  var response;
  try {
    response = await fetch(SUPA + '/functions/v1/audio-review-assets', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
  } catch (networkError) {
    if (networkError && networkError.name === 'AbortError') throw new Error('تجاوز تجهيز نص القراءة 125 ثانية من دون استجابة. لم يتم اعتماد أي نص؛ أعد المحاولة بعد قليل.');
    throw new Error('تعذر الاتصال بخدمة تجهيز النص: ' + (networkError && networkError.message || networkError));
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  var data = null;
  try { data = await response.json(); } catch (e) {}
  if (!response.ok) {
    var detail = data && (data.error || data.message);
    if (data && data.upstream_status) {
      var upstreamService = upstreamServiceName(payload && payload.action);
      detail = (detail || ('تعذر الاتصال بخدمة ' + upstreamService)) +
        (data.upstream_message ? ' — ' + data.upstream_message : '') +
        ' (الخدمة: ' + upstreamService + ' — رمز HTTP: ' + data.upstream_status + ')';
    }
    var error = new Error(detail || 'تعذر الاتصال بمخزن الصوت الخاص (' + response.status + ').');
    error.status = response.status;
    throw error;
  }
  return data || {};
}
async function ensureArabicAudioStaged(expectedArabicTexts) {
  if (story.section !== 'history' || story.slug !== 'ibn-sina' ||
      document.documentElement.lang !== 'ar') return;
  // Restore the verified restart-baseline package into private review storage.
  // The pinned artifact is the successful Arabic Ibn Sina package; it is not public.
  var artifact = {
    action: 'stage',
    section: 'history',
    slug: 'ibn-sina',
    language: 'ar',
    artifact_id: 13563200242,
    run_id: 42344425713,
    artifact_name: 'ibn-sina-arabic-audio-staging',
    baseline_restore: true
  };
  try {
    var current = await audioAssetsRequest({
      action: 'manifest', section: 'history', slug: 'ibn-sina', language: 'ar'
    });
    var existing = current && current.manifest;
    if (existing && Array.isArray(existing.segments) && existing.segments.length) return;
  } catch (error) {
    if (!error || error.status !== 404) throw error;
  }
  var staged = await audioAssetsRequest(artifact);
  if (!staged || staged.success !== true || staged.staged !== true) {
    throw new Error('لم يؤكد مخزن الصوت الخاص استلام المقطع الأول.');
  }
}
function rowUrl() {
  var table = ctx.submission_table === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions';
  return SUPA + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(ctx.submission_id);
}
async function loadRow() {
  var stagedPackage = null;
  try { stagedPackage = JSON.parse(localStorage.getItem('kh-story-review-package') || 'null'); } catch (e) {}
  if (!stagedPackage || stagedPackage.section !== story.section || stagedPackage.slug !== story.slug) {
    throw new Error('هوية الحكاية في سياق الأدمن لا تطابق الحكاية المعروضة؛ أعد فتح المعاينة من صف الحكاية الصحيح.');
  }
  var result = await audioAssetsRequest({ action: 'review_get', section: story.section, slug: story.slug });
  review = core.cloneReview(result.audio_review || null);
  speechTexts = result.audio_review && result.audio_review.speech_texts && typeof result.audio_review.speech_texts === 'object'
    ? result.audio_review.speech_texts : {};
  canWrite = true;
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
function stableReviewJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableReviewJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableReviewJson(value[key]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}
function pronunciationReviewMatches(clip, expected) {
  return stableReviewJson(clip && clip.pronunciation_review || null) === stableReviewJson(expected || null);
}
async function saveReview(entry, decision) {
  var key = entry && entry.key;
  if (busy) throw new Error('انتظر حتى يكتمل حفظ قرار المقطع السابق.');
  if (!canWrite || !story) throw new Error('مراجعة الصوت غير متصلة بسجل الحكاية.');
  busy = true;
  try {
    var decisionWithAnalysis = Object.assign({}, decision);
    var attachedPronunciationReview = pronunciationReviewFor(entry);
    if (attachedPronunciationReview) decisionWithAnalysis.pronunciation_review = attachedPronunciationReview;
    var currentResult = await audioAssetsRequest({ action: 'review_get', section: story.section, slug: story.slug });
    var currentReview = core.cloneReview(currentResult.audio_review || null);
    var next = core.applyDecision(currentReview, entry, decisionWithAnalysis);
    next.speech_texts = speechTexts;
    var expectedPronunciationReview = next.clips[key] && next.clips[key].pronunciation_review || null;
    if (entry.source_base && entry.audio_sha256) next.audio_hashes[entry.source_base] = entry.audio_sha256;
    var saved = await audioAssetsRequest({
      action: 'review_save', section: story.section, slug: story.slug, audio_review: next
    });
    var savedReview = saved && saved.audio_review;
    if (!savedReview || !savedReview.clips || !savedReview.clips[key] ||
        savedReview.clips[key].status !== decision.status ||
        !pronunciationReviewMatches(savedReview.clips[key], expectedPronunciationReview)) {
      throw new Error('استجابة الحفظ لم تتضمن قرار المقطع وتفاصيل مراجعة النطق كاملة.');
    }
    var verifyResult = await audioAssetsRequest({ action: 'review_get', section: story.section, slug: story.slug });
    var verified = verifyResult && verifyResult.audio_review;
    if (!verified || !verified.clips || !verified.clips[key] ||
        verified.clips[key].status !== decision.status ||
        !pronunciationReviewMatches(verified.clips[key], expectedPronunciationReview)) {
      throw new Error('لم يؤكد الخادم بقاء قرار المقطع وتفاصيل مراجعة النطق في سجل المراجعة.');
    }
    review = core.cloneReview(verified);
    speechTexts = verified.speech_texts && typeof verified.speech_texts === 'object' ? verified.speech_texts : speechTexts;
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
  var indexUrl = new URL('../stories/index.json', location.href);
  var indexResponse = await fetch(indexUrl.href, { cache: 'no-cache' });
  if (!indexResponse.ok) throw new Error('تعذر تحميل فهرس الحكايات لتحديد ملف نص النطق العربي.');
  var storyIndex = await indexResponse.json();
  var indexedStory = Array.isArray(storyIndex) ? storyIndex.find(function (item) {
    return item && item.section === story.section && item.title === (story.i18n && story.i18n.ar && story.i18n.ar.title);
  }) : null;
  if (!indexedStory || typeof indexedStory.path !== 'string' || !indexedStory.path.startsWith('stories/')) {
    throw new Error('تعذر مطابقة الحكاية الحالية مع مسار ملف نص النطق المعتمد في الفهرس.');
  }
  var url = new URL('../' + indexedStory.path + 'audio-pronunciation.json', location.href);
  var response = await fetch(url.href, { cache: 'no-cache' });
  if (response.status === 404) return fallback;
  if (!response.ok) throw new Error('تعذر تحميل ملف نص النطق العربي (' + response.status + ').');
  var data = await response.json();
  if (!data || (data.version !== 1 && data.format !== 'KHALEDOON_AUDIO_PRONUNCIATION_V1') ||
      data.story !== story.slug || data.section !== story.section || data.language !== 'ar' ||
      !data.blocks || typeof data.blocks !== 'object') {
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
  manifests = {}; manifestErrors = {}; manifestStale = {}; manifestGaps = {}; manifestMissing = {}; entries = []; readyByKey = {}; played = {}; acceptButtons = {}; manifestLoadFailure = false;
  loadedAudio = {};
  var expectedTexts = {};
  LANGS.forEach(function (lang) {
    var localized = story.i18n && story.i18n[lang];
    expectedTexts[lang] = localized && Array.isArray(localized.blocks)
      ? localized.blocks.map(function (block) { return String(block && block.text || ''); }) : [];
  });
  var storyArabicTexts = expectedTexts.ar.slice();
  expectedTexts.ar = await loadArabicExpectedTexts(expectedTexts.ar.map(function (text) { return { text: text }; }));
  /* الصوت العربي يُقارن بنص القراءة المعتمد الذي أُرسل للتوليد (إن وُجد)، لا بنص الحكاية الأصلي. */
  expectedTexts.ar = expectedTexts.ar.map(function (pron, index) {
    return core.expectedSpokenText(storyArabicTexts[index], pron, speechTexts[speechTextKey(index)]);
  });
  // Audio is now produced only by the persistent VoiceTut queue; do not stage legacy NAMAA artifacts.
  var results = await Promise.all(LANGS.map(async function (lang) {
    try {
      var privateResult;
      try {
        privateResult = await audioAssetsRequest({
          action: 'manifest', section: story.section, slug: story.slug, language: lang
        });
      } catch (requestError) {
        if (requestError.status === 404) requestError.isMissingManifest = true;
        throw requestError;
      }
      var data = privateResult.manifest;
      if (!data || !privateResult.signed_sources) throw new Error('استجابة مخزن الصوت الخاص لا تحتوي manifest أو روابطًا مؤقتة.');
      data.segments.forEach(function (segment) {
        segment.signed_src = privateResult.signed_sources[segment.src] || '';
        if (!segment.signed_src) throw new Error('لم يُنشأ رابط مؤقت للمقطع ' + segment.src + '.');
      });
      if (!data || data.version !== 1 || data.story !== story.slug || data.section !== story.section || data.language !== lang || !Array.isArray(data.segments) || !data.segments.length) {
        throw new Error('بيانات manifest غير متوافقة مع الحكاية أو اللغة.');
      }
      data.segments.forEach(function (seg) {
        var engineOk = seg.provider === 'omnivoice' && seg.model === 'VoiceTut Egyptian Tashkeel' &&
          seg.voice === (seg.speaker === 'karma' ? 'omnivoice-karma-reference' : 'omnivoice-narrator-reference');
        if (!engineOk || typeof seg.src !== 'string' || !/^[A-Za-z0-9_-]+\.mp3$/.test(seg.src) || typeof seg.text !== 'string' || !seg.text.trim() || (seg.audio_sha256 != null && !/^[a-f0-9]{64}$/i.test(String(seg.audio_sha256)))) {
          throw new Error('مقطع صوتي لا يطابق المتحدث أو مزوّد/صوت اللغة المعتمد.');
        }
      });
      var localized = story.i18n && story.i18n[lang];
      var split = core.splitStaleSegments(localized && localized.blocks, data.segments, expectedTexts[lang]);
      manifestStale[lang] = split.stale;
      data.segments = split.fresh;
      if (data.segments.length) {
        var coverage = core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang], data.provider === 'omnivoice' || split.stale.length > 0);
        if (!coverage.ok) throw new Error(coverage.error);
      }
      manifestGaps[lang] = core.uncoveredBlocks(localized && localized.blocks, data.segments);
      manifests[lang] = data;
    } catch (e) {
      manifestErrors[lang] = String(e && e.message || e);
      if (e && e.isMissingManifest) manifestMissing[lang] = true;
      else if (REQUIRED_LANGS.indexOf(lang) >= 0) manifestLoadFailure = true;
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
          text: seg.text, src: seg.src, signed_src: seg.signed_src, manifest: manifest, segment: seg };
        var regen = Number(review.regen[base] || 0);
        entry.key = await core.clipKey(base, regen);
        readyByKey[entry.key] = 'ready';
        return entry;
      })());
    });
  });
  entries = await Promise.all(pendingEntries);

  // A review decision belongs to the exact audio bytes, not merely the
  // story slot or a previously cached key. If the current manifest hash differs
  // from the hash recorded with an older decision, keep that historical record
  // in the database but exclude it from this preview's active review state.
  entries.forEach(function (entry) {
    if (!entry.audio_sha256) return;
    Object.keys(review.clips).forEach(function (key) {
      var saved = review.clips[key];
      if (!saved || saved.lang !== entry.lang ||
          Number(saved.block_index) !== entry.block_index ||
          Number(saved.chunk_index || 0) !== entry.chunk_index ||
          !saved.audio_sha256) return;
      if (String(saved.audio_sha256).toLowerCase() !== String(entry.audio_sha256).toLowerCase()) {
        delete review.clips[key];
      }
    });
  });
}
function gate() {
  if (!initialized) return { ok: false, loading: true, total: 0, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0 };
  if (manifestLoadFailure) return { ok: false, loadError: true, total: entries.length, accepted: 0, rejected: 0, unreviewed: 0, notReady: 0 };
  var requiredEntries = entries.filter(function (entry) { return REQUIRED_LANGS.indexOf(entry.lang) >= 0; });
  var g = core.evaluateFiveLanguageGate(manifests, requiredEntries, review, readyByKey, played, REQUIRED_LANGS);
  var stale = 0, gaps = 0;
  REQUIRED_LANGS.forEach(function (lang) {
    stale += (manifestStale[lang] || []).length;
    gaps += (manifestGaps[lang] || []).length;
  });
  g.staleBlocks = stale; g.uncoveredBlocks = gaps;
  if (stale || gaps) g.ok = false;
  return g;
}
function gateSummary() {
  var g = gate();
  if (g.loading) return 'جارٍ تحميل وفحص ملفات الصوت؛ لن يتاح اعتماد المعاينة قبل اكتمال الفحص.';
  if (g.loadError) {
    var details = REQUIRED_LANGS.filter(function (lang) { return !!manifestErrors[lang]; }).map(function (lang) {
      return LANG_NAMES[lang] + ': ' + manifestErrors[lang];
    });
    return 'تعذر التحقق من ملفات الصوت بسبب خطأ تحميل أو بيانات غير صالحة. لا يمكن اعتماد المعاينة قبل إصلاح المشكلة.' + (details.length ? ' ' + details.join(' | ') : '');
  }
  if (g.missingLanguages) return 'مراجعة الصوت غير مكتملة: ملفات الصوت غير جاهزة للغات ' + g.missingLanguages.map(function (l) { return LANG_NAMES[l]; }).join('، ') + '.';
  if (g.ok) return 'تم قبول كل المقاطع الصوتية (' + g.accepted + '/' + g.total + ').';
  if (g.staleBlocks) return 'يوجد ' + g.staleBlocks + ' مقطع صوته قديم ولا يطابق نص القراءة المعتمد؛ أعد توليد صوته من النص المعتمد قبل الاعتماد.';
  if (g.uncoveredBlocks) return 'يوجد ' + g.uncoveredBlocks + ' مقطع بلا ملف صوتي بعد؛ ولّد صوته قبل الاعتماد.';
  return core.gateMessage(g) + ' المقبول: ' + g.accepted + '/' + g.total + '.';
}
function renderGateBanner(banner) {
  var g = gate();
  banner.replaceChildren();
  banner.dataset.state = g.loading ? 'loading' : (g.loadError ? 'error' : (g.ok ? 'ok' : 'pending'));
  var head = document.createElement('div');
  head.className = 'kh-gate-head';
  var title = document.createElement('div');
  title.className = 'kh-gate-title';
  var avatar = document.createElement('span');
  avatar.className = 'kh-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = '🎧';
  var titleText = document.createElement('span');
  text(titleText, 'مراجعة الصوت قبل اعتماد المعاينة');
  title.append(avatar, titleText);
  var pill = document.createElement('span');
  pill.className = 'kh-gate-pill';
  text(pill, g.loading ? 'جارٍ الفحص…' : g.loadError ? 'خطأ في التحميل' : g.ok ? 'جاهز للاعتماد ✓' : 'المراجعة غير مكتملة');
  head.append(title, pill);
  var message = document.createElement('div');
  message.className = 'kh-gate-message';
  text(message, gateSummary());
  banner.append(head, message);
  if (!entries.length) return;
  var total = entries.length;
  var ready = entries.filter(function (entry) { return readyByKey[entry.key] === 'ready'; }).length;
  var accepted = entries.filter(function (entry) {
    var clip = review.clips[entry.key];
    return clip && clip.status === 'accepted';
  }).length;
  function meterRow(label, value, kind) {
    var rowEl = document.createElement('div');
    rowEl.className = 'kh-meter-row';
    rowEl.dataset.kind = kind;
    var caption = document.createElement('div');
    caption.className = 'kh-meter-cap';
    var captionLabel = document.createElement('span');
    text(captionLabel, label);
    var captionValue = document.createElement('strong');
    text(captionValue, value + '/' + total);
    caption.append(captionLabel, captionValue);
    var bar = document.createElement('div');
    bar.className = 'kh-meter';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', label);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(value));
    var fill = document.createElement('span');
    fill.style.width = (total ? Math.round(value / total * 100) : 0) + '%';
    bar.appendChild(fill);
    rowEl.append(caption, bar);
    banner.appendChild(rowEl);
  }
  meterRow('المقاطع الجاهزة للاستماع', ready, 'ready');
  meterRow('المقاطع المقبولة بعد الاستماع', accepted, 'accepted');
  var chips = document.createElement('div');
  chips.className = 'kh-lang-chips';
  LANGS.forEach(function (lang) {
    var list = entries.filter(function (entry) { return entry.lang === lang; });
    var acc = list.filter(function (entry) {
      var clip = review.clips[entry.key];
      return clip && clip.status === 'accepted';
    }).length;
    var chip = document.createElement('span');
    chip.className = 'kh-lang-chip';
    chip.dataset.state = !list.length ? 'none' : (acc === list.length ? 'done' : 'part');
    text(chip, LANG_NAMES[lang] + ' ' + (list.length ? acc + '/' + list.length : '—'));
    chips.appendChild(chip);
  });
  banner.appendChild(chips);
  if (g.missingLanguages || g.loadError) {
    var partial = document.createElement('small');
    text(partial, 'هذه الأعداد تخص ملفات اللغات التي أمكن تحميلها فقط؛ الإجمالي النهائي لا يكتمل قبل توفر manifests اللغات الخمس.');
    banner.appendChild(partial);
  }
}
function canApprove() { return gate().ok; }
window.KHStoryAudioReview = { canApprove: canApprove, gateSummary: gateSummary, gate: gate };
var activeObjectUrl = null, activeEntryKey = '', activePlayButton = null;
async function play(entry, button, forceRestart) {
  if (!entry || !entry.src) return;
  var control = button.closest('.kh-audio-review-controls');
  var stateNode = control && control.querySelector('.kh-audio-review-state');
  var acceptBtn = control && control.querySelector('.kh-audio-review-btn.accept');
  if (control && control.dataset.player === 'loading') return;
  if (activeEntryKey === entry.key && audio && audio.src) {
    if (forceRestart) {
      try {
        audio.currentTime = 0;
        await audio.play();
        setPlayButton(button, 'pause');
        setPlayerState(control, 'playing');
        setAudioStatus(control, 'playing', 'يعمل الآن من البداية');
        updateProgress(control);
        if (stateNode) stateNode.textContent = 'أُعيد تشغيل المقطع من البداية…';
      } catch (e) {
        if (stateNode) stateNode.textContent = 'تعذرت إعادة التشغيل: ' + (e.message || e);
      }
      return;
    }
    if (!audio.paused) {
      audio.pause();
      setPlayButton(button, 'resume');
      setPlayerState(control, 'paused');
      setAudioStatus(control, 'paused', 'متوقف مؤقتًا');
      if (stateNode) stateNode.textContent = 'تم إيقاف المقطع مؤقتًا.';
    } else {
      try {
        await audio.play();
        setPlayButton(button, 'pause');
        setPlayerState(control, 'playing');
        setAudioStatus(control, 'playing', 'يعمل الآن');
        if (stateNode) stateNode.textContent = 'المقطع يعمل الآن…';
      } catch (e) {
        if (stateNode) stateNode.textContent = 'تعذر استكمال التشغيل: ' + (e.message || e);
      }
    }
    return;
  }
  played[entry.key] = false;
  if (control) control.dataset.listened = '0';
  syncSteps(control);
  if (acceptBtn) setAcceptState(acceptBtn, false, false);
  if (activeControl && activeControl !== control) settleControl(activeControl);
  activeControl = control;
  setPlayerState(control, 'loading');
  resetProgress(control);
  setPlayButton(button, 'loading');
  if (stateNode) stateNode.textContent = 'جارٍ تحميل الملف والتحقق من بصمته…';
  setAudioStatus(control, 'preparing', 'جارٍ تحميل الصوت…');
  if (!audio) audio = new Audio();
  try {
    try { audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null; audio.pause(); audio.currentTime = 0; } catch (e) {}
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    activeEntryKey = '';
    activePlayButton = null;
    var cacheId = entry.lang + '|' + entry.src;
    var cached = loadedAudio[cacheId];
    var blob, digest;
    if (cached && cached.blob && cached.digest && (!entry.audio_sha256 || entry.audio_sha256 === cached.digest)) {
      blob = cached.blob;
      digest = cached.digest;
    } else {
      var url = new URL(entry.signed_src || entry.src, manifestUrl(entry.lang));
      url.searchParams.set('v', String(entry.audio_sha256 || entry.segment.audio_sha256 || entry.segment.hash || entry.manifest.generated_at || entry.manifest.version));
      blob = await fetchBlobWithProgress(url.href, function (ratio) { showLoadProgress(control, ratio); });
      digest = await core.sha256Bytes(await blob.arrayBuffer());
      loadedAudio[cacheId] = { blob: blob, digest: digest };
    }
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
    if (control) control.dataset.loaded = '1';
    setAudioStatus(control, 'ready', 'تم التحميل والتحقق من البصمة');
    resetProgress(control);
    if (previousKey !== entry.key) {
      delete readyByKey[previousKey];
      delete played[previousKey];
      delete acceptButtons[previousKey];
      if (acceptBtn) acceptButtons[entry.key] = acceptBtn;
      if (control) control.dataset.clipKey = entry.key;
      if (stateNode) stateNode.textContent = 'تم التحقق من نسخة صوت مختلفة؛ يلزم مراجعتها من جديد.';
    }
    played[entry.key] = false;
    if (acceptBtn) setAcceptState(acceptBtn, false, false);
    activeObjectUrl = URL.createObjectURL(blob);
    activeEntryKey = entry.key;
    activePlayButton = button;
    audio.src = activeObjectUrl;
    audio.onloadedmetadata = function () { updateProgress(control); };
    audio.ontimeupdate = function () { updateProgress(control); };
    audio.load();
    setPlayButton(button, 'pause');
    setPlayerState(control, 'playing');
    setAudioStatus(control, 'playing', 'يعمل الآن');
    audio.onended = function () {
      setPlayButton(button, 'play');
      setPlayerState(control, 'ended');
      updateProgress(control);
      setAudioStatus(control, 'ended', 'اكتمل الاستماع');
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = true;
      if (control) control.dataset.listened = '1';
      syncSteps(control);
      if (acceptButtons[entry.key]) setAcceptState(acceptButtons[entry.key], true, false);
      if (stateNode) stateNode.textContent = 'اكتمل الاستماع — يمكنك الموافقة على المقطع أو رفضه.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    audio.onerror = function () {
      setPlayButton(button, 'play');
      setPlayerState(control, 'error');
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = false;
      if (acceptButtons[entry.key]) setAcceptState(acceptButtons[entry.key], false, false);
      setAudioStatus(control, 'failed', 'فشل تجهيز الصوت للتشغيل');
      if (stateNode) stateNode.textContent = 'تعذر تشغيل المقطع؛ لم يتم تسجيل الاستماع.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    var playback = audio.play();
    if (playback && playback.catch) playback.catch(function () {
      setPlayButton(button, 'play');
      setPlayerState(control, 'error');
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = false;
      if (acceptButtons[entry.key]) setAcceptState(acceptButtons[entry.key], false, false);
      setAudioStatus(control, 'failed', 'تعذر بدء التشغيل');
      if (stateNode) stateNode.textContent = 'تعذر بدء تشغيل المقطع؛ حاول مرة أخرى.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    });
  } catch (e) {
    setPlayButton(button, 'play');
    setPlayerState(control, 'error');
    activeEntryKey = '';
    activePlayButton = null;
    if (acceptBtn) setAcceptState(acceptBtn, false, false);
    setAudioStatus(control, 'failed', 'فشل تجهيز الصوت للتشغيل');
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
      var url = new URL(entry.signed_src || entry.src, manifestUrl(entry.lang));
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
    activeEntryKey = '';
    activePlayButton = null;
    if (activeControl) settleControl(activeControl);
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
var generationBusy = false, generationMessage = '';
function nextBlockIndexForLanguage(language) {
  var localized = story && story.i18n && story.i18n[language];
  var sourceBlocks = localized && Array.isArray(localized.blocks) ? localized.blocks : [];
  var karma = [], narrator = [];
  sourceBlocks.forEach(function (block, index) {
    if (block && block.speaker === 'karma') karma.push(index);
    else if (block && block.speaker === 'narrator') narrator.push(index);
  });
  var ordered = karma.concat(narrator);
  var accepted = new Set(Object.values(review.clips || {}).filter(function (clip) {
    return clip && clip.lang === language && clip.status === 'accepted';
  }).map(function (clip) { return Number(clip.block_index); }));
  for (var i = 0; i < ordered.length; i++) if (!accepted.has(ordered[i])) return ordered[i];
  return -1;
}
async function generateNextQueuedBlock(language, statusNode, button) {
  if (generationBusy) return;
  var nextBlock = nextBlockIndexForLanguage(language);
  if (nextBlock < 0) { text(statusNode, 'كل مقاطع هذه اللغة معتمدة بالفعل.'); return; }
  if (language === 'ar') {
    if (Object.keys(speechTextBusy).some(function (key) { return speechTextBusy[key]; })) {
      text(statusNode, 'انتظر حتى ينتهي تجهيز أو اعتماد نص القراءة الحالي.'); return;
    }
    var speechRecord = speechTexts[speechTextKey(nextBlock)];
    if (!speechRecord || speechRecord.status !== 'approved' || !speechRecord.approved_text || speechTextDirty[nextBlock]) {
      text(statusNode, 'المقطع ' + (nextBlock + 1) + ' متوقف: جهّز نص القراءة وراجعه واعتمده أولًا.'); return;
    }
  }
  generationBusy = true; button.disabled = true;
  text(statusNode, 'جارٍ إرسال المقطع ' + (nextBlock + 1) + ' إلى طابور VoiceTut…');
  try {
    var queued = await audioAssetsRequest({ action: 'enqueue', section: story.section, slug: story.slug, language: language, block_index: nextBlock });
    if (!queued || !queued.job || !queued.job.id) throw new Error('لم يرجع الخادم رقم طلب التوليد.');
    var jobId = queued.job.id, state = queued.job.status;
    for (var attempt = 0; attempt < 24; attempt++) {
      if (state === 'completed' || state === 'failed') break;
      await new Promise(function (resolve) { setTimeout(resolve, 5000); });
      var status = await audioAssetsRequest({ action: 'queue_status', section: story.section, slug: story.slug, language: language });
      var current = (status.jobs || []).find(function (job) { return job.id === jobId; });
      if (!current) throw new Error('اختفى طلب المقطع من طابور التوليد.');
      state = current.status;
      if (state === 'failed') throw new Error(current.last_error || 'فشل توليد المقطع.');
      text(statusNode, state === 'processing' ? 'Colab يعمل الآن على المقطع ' + (nextBlock + 1) + '…' : 'المقطع محفوظ في الطابور وينتظر اتصال Colab…');
    }
    if (state === 'completed') {
      text(statusNode, 'اكتمل المقطع؛ جارٍ تحميله إلى مساحة الاستماع والمراجعة…');
      await loadManifests();
      generationMessage = 'المقطع ' + (nextBlock + 1) + ' جاهز للاستماع والمراجعة — لم يُنشر.';
      render();
    } else {
      generationMessage = 'تم حفظ المقطع في الطابور؛ سيكمل Colab تلقائيًا عند عودة تشغيله.';
      text(statusNode, generationMessage);
    }
  } catch (error) { text(statusNode, 'تعذر إرسال أو متابعة المقطع: ' + (error && error.message || error)); }
  finally { generationBusy = false; button.disabled = false; }
}
function renderGenerationControls(banner) {
  if (!story || !['ar', 'en'].includes(document.documentElement.lang)) return;
  var language = document.documentElement.lang;
  var panel = document.createElement('div'); panel.className = 'kh-audio-review-controls kh-audio-generation-controls';
  var title = document.createElement('strong'); title.className = 'kh-gen-title';
  text(title, language === 'ar' ? '🎙️ توليد الصوت — VoiceTut' : '🎙️ Generate audio — VoiceTut');
  var status = document.createElement('span'); status.className = 'kh-audio-review-state';
  text(status, generationMessage || (language === 'ar' ? 'يُجهّز مقطع واحد في كل مرة؛ العربية تتطلب اعتماد نص القراءة أولًا.' : 'يُرسل مقطع واحد في كل مرة إلى طابور التوليد.'));
  var button = iconButton('spark', language === 'ar' ? 'إرسال المقطع التالي للتوليد' : 'Queue next English clip', 'generate', function () {
    generateNextQueuedBlock(language, status, button);
  });
  button.disabled = generationBusy;
  var publishButton = document.createElement('button');
  publishButton.type = 'button';
  publishButton.className = 'kh-audio-publish-button';
  publishButton.textContent = 'نشر الصوت المعتمد على صفحة الحكاية';
  publishButton.disabled = !gate().ok || generationBusy;
  publishButton.addEventListener('click', async function () {
    if (!gate().ok || generationBusy) return;
    publishButton.disabled = true;
    text(status, 'جارٍ نشر المقاطع المعتمدة للعربية والإنجليزية…');
    try {
      var result = await audioAssetsRequest({ action: 'publish_audio', section: story.section, slug: story.slug });
      if (!result || result.success !== true || result.published !== true) throw new Error('لم يؤكد الخادم نشر حزمة الصوت.');
      generationMessage = 'تم نشر الصوت المعتمد للعربية والإنجليزية على صفحة الحكاية.';
      text(status, generationMessage);
    } catch (error) {
      text(status, 'تعذر نشر الصوت: ' + (error && error.message || error));
    } finally {
      publishButton.disabled = !gate().ok;
    }
  });
  publishButton.title = 'لا يتاح النشر إلا بعد الاستماع الكامل واعتماد كل المقاطع المطلوبة.';
  panel.append(title, button, publishButton, status); banner.appendChild(panel);
}
function nextArabicBlockIndex() {
  var byBlock = {};
  entries.filter(function (entry) { return entry.lang === 'ar'; }).forEach(function (entry) {
    (byBlock[entry.block_index] || (byBlock[entry.block_index] = [])).push(entry);
  });
  var karmaOrder = [], narratorOrder = [];
  var sourceBlocks = story && story.i18n && story.i18n.ar && story.i18n.ar.blocks || [];
  sourceBlocks.forEach(function (block, index) {
    if (block && block.speaker === 'karma') karmaOrder.push(index);
    else if (block && block.speaker === 'narrator') narratorOrder.push(index);
  });
  var orderedBlocks = karmaOrder.concat(narratorOrder);
  for (var i = 0; i < orderedBlocks.length; i++) {
    var blockIndex = orderedBlocks[i];
    var clips = byBlock[blockIndex] || [];
    if (!clips.length || !clips.every(function (entry) {
      var saved = review.clips[entry.key];
      return saved && saved.status === 'accepted';
    })) return blockIndex;
  }
  return -1;
}
function speechTextKey(index) { return 'ar:' + String(index); }
async function prepareSpeechText(index, statusNode, button) {
  var key = speechTextKey(index);
  if (speechTextBusy[key]) return;
  speechTextBusy[key] = true;
  if (button) button.disabled = true;
  text(statusNode, 'جارٍ تجهيز نص القراءة باستخدام Gemini…');
  try {
    var proposal = await audioAssetsRequest({
      action: 'prepare_speech_text', section: story.section, slug: story.slug,
      language: 'ar', block_index: index
    });
    if (!proposal || !proposal.speech_text || !proposal.source_text_hash) throw new Error('لم يرجع Gemini نصًا صالحًا للمقطع.');
    var saved = await audioAssetsRequest({
      action: 'speech_text_save', section: story.section, slug: story.slug, language: 'ar',
      block_index: index, decision: 'suggested', speech_text: proposal.speech_text,
      source_text_hash: proposal.source_text_hash, model: proposal.model,
      changes_summary: proposal.changes_summary,
      pronunciation_notes: proposal.pronunciation_notes, review_flags: proposal.review_flags
    });
    speechTexts[key] = saved.speech_text;
    speechTextDirty[index] = false;
    speechTextBusy[key] = false;
    text(statusNode, 'وصل اقتراح Gemini وتم حفظه كمسودة — لم يُعتمد ولم يُرسل إلى محرك الصوت.');
    render();
  } catch (error) {
    text(statusNode, 'تعذر تجهيز نص القراءة: ' + (error && error.message || error));
  } finally {
    speechTextBusy[key] = false;
    if (button) button.disabled = false;
  }
}
async function approveSpeechText(index, textarea, statusNode, button) {
  var key = speechTextKey(index);
  var record = speechTexts[key];
  if (!record || !record.source_text_hash) {
    text(statusNode, 'جهّز اقتراح Gemini أولًا قبل اعتماد نص القراءة.');
    return;
  }
  var value = String(textarea.value || '').trim();
  if (!value) { text(statusNode, 'نص القراءة لا يمكن أن يكون فارغًا.'); return; }
  if (speechTextBusy[key]) return;
  speechTextBusy[key] = true;
  if (button) button.disabled = true;
  text(statusNode, 'جارٍ حفظ اعتماد نص القراءة…');
  try {
    var saved = await audioAssetsRequest({
      action: 'speech_text_save', section: story.section, slug: story.slug, language: 'ar',
      block_index: index, decision: 'approved', speech_text: value,
      source_text_hash: record.source_text_hash
    });
    speechTexts[key] = saved.speech_text;
    speechTextDirty[index] = false;
    speechTextBusy[key] = false;
    text(statusNode, 'تم اعتماد نص القراءة لهذا المقطع. يمكن الآن توليد صوته عند وصول دوره.');
    render();
  } catch (error) {
    text(statusNode, 'تعذر اعتماد النص: ' + (error && error.message || error));
  } finally {
    speechTextBusy[key] = false;
    if (button) button.disabled = false;
  }
}
function speechBadgeText(statusKey) {
  return statusKey === 'approved' ? 'نص القراءة معتمد ✓'
    : statusKey === 'suggested' ? 'اقتراح بانتظار اعتمادك'
    : statusKey === 'dirty' ? 'تعديل غير معتمد'
    : 'لم يُجهز بعد';
}
function renderSpeechTextPanel(block, index, localizedBlock) {
  if (!block || !localizedBlock || !['karma', 'narrator'].includes(localizedBlock.speaker) ||
      typeof localizedBlock.text !== 'string' || !localizedBlock.text.trim()) return;
  var key = speechTextKey(index);
  var record = speechTexts[key] || {};
  var statusKey = record.status === 'approved' ? 'approved' : record.status === 'suggested' ? 'suggested' : 'empty';
  var panel = document.createElement('section');
  panel.className = 'kh-audio-review-controls kh-speech-text-controls';
  panel.dataset.status = statusKey;
  panel.dataset.speaker = localizedBlock.speaker;
  var head = document.createElement('div');
  head.className = 'kh-card-head';
  var who = document.createElement('div');
  who.className = 'kh-who';
  var heading = document.createElement('strong');
  heading.className = 'kh-audio-speaker';
  heading.textContent = 'نص القراءة الصوتية — ' + speakerLabel(localizedBlock.speaker) + ' · مقطع ' + (index + 1);
  who.append(speakerAvatar(localizedBlock.speaker), heading);
  var badge = document.createElement('span');
  badge.className = 'kh-audio-badge';
  badge.dataset.status = statusKey;
  badge.textContent = speechBadgeText(statusKey);
  head.append(who, badge);
  var flow = document.createElement('ol');
  flow.className = 'kh-flow';
  ['اقتراح Gemini', 'مراجعتك وتعديلك', 'الاعتماد'].forEach(function (label, i) {
    var li = document.createElement('li');
    li.dataset.n = String(i + 1);
    li.textContent = label;
    flow.appendChild(li);
  });
  var grid = document.createElement('div');
  grid.className = 'kh-speech-grid';
  var originalCol = document.createElement('div');
  originalCol.className = 'kh-speech-col';
  var sourceLabel = document.createElement('div');
  sourceLabel.className = 'kh-speech-label';
  sourceLabel.textContent = 'النص الأصلي المنشور';
  var source = document.createElement('p');
  source.className = 'kh-speech-source';
  source.textContent = localizedBlock.text;
  originalCol.append(sourceLabel, source);
  var proposalCol = document.createElement('div');
  proposalCol.className = 'kh-speech-col';
  var proposalLabel = document.createElement('label');
  proposalLabel.className = 'kh-speech-label';
  proposalLabel.textContent = 'صياغة القراءة المقترحة (يمكنك تعديلها قبل الاعتماد)';
  var textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.maxLength = 6000;
  textarea.value = record.status === 'approved' ? (record.approved_text || '') : (record.suggested_text || '');
  textarea.placeholder = 'اضغط «تجهيز النص بـ Gemini» لاقتراح صياغة صوتية منفصلة…';
  proposalCol.append(proposalLabel, textarea);
  grid.append(originalCol, proposalCol);
  var status = document.createElement('span');
  status.className = 'kh-audio-review-state';
  var currentBlockIndex = nextBlockIndexForLanguage('ar');
  var isCurrentBlock = currentBlockIndex === index;
  status.textContent = !isCurrentBlock
    ? (currentBlockIndex < 0 ? 'اكتملت مراجعة المقاطع السابقة.' : 'سيُفتح هذا المقطع بعد اعتماد المقطع السابق في ترتيب كارما ثم الراوي.')
    : speechTextDirty[index] ? 'يوجد تعديل غير معتمد.' :
      record.status === 'approved' ? 'نص القراءة معتمد ✓' :
      record.status === 'suggested' ? 'اقتراح محفوظ — بانتظار مراجعتك واعتمادك.' :
      'لم يُجهز نص القراءة بعد.';
  var notes = document.createElement('div');
  notes.className = 'kh-speech-notes';
  if (record.changes_summary) {
    var summary = document.createElement('p');
    summary.textContent = 'ملخص التغيير: ' + record.changes_summary;
    notes.appendChild(summary);
  }
  if (Array.isArray(record.pronunciation_notes) && record.pronunciation_notes.length) {
    var pronunciation = document.createElement('p');
    pronunciation.textContent = 'ملاحظات النطق: ' + record.pronunciation_notes.join('؛ ');
    notes.appendChild(pronunciation);
  }
  if (Array.isArray(record.review_flags) && record.review_flags.length) {
    var flags = document.createElement('p');
    flags.textContent = 'تنبيهات للمراجعة: ' + record.review_flags.join('؛ ');
    notes.appendChild(flags);
  }
  textarea.addEventListener('input', function () {
    speechTextDirty[index] = true;
    badge.dataset.status = 'dirty';
    badge.textContent = speechBadgeText('dirty');
    status.textContent = 'يوجد تعديل غير معتمد؛ لن يُستخدم في التوليد حتى تحفظ اعتماده.';
  });
  var suggest = iconButton('spark', record.suggested_text ? 'إعادة اقتراح من Gemini' : 'تجهيز النص بـ Gemini', 'generate', function () {
    prepareSpeechText(index, status, suggest);
  });
  var approve = iconButton('check', record.status === 'approved' ? 'حفظ واعتماد التعديل' : 'اعتماد نص القراءة', 'accept', function () {
    approveSpeechText(index, textarea, status, approve);
  });
  approve.disabled = !record.suggested_text || !canWrite || !!speechTextBusy[key] || !isCurrentBlock;
  suggest.disabled = !canWrite || !!speechTextBusy[key] || !isCurrentBlock;
  var actions = document.createElement('div');
  actions.className = 'kh-audio-actions';
  actions.append(suggest, approve);
  panel.append(head, flow, grid, notes, actions, status);
  block.appendChild(panel);
}
function renderBlocks() {
  if (!story) return;
  var banner = document.getElementById('kh-audio-review-gate');
  if (!banner) { banner = document.createElement('div'); banner.id = 'kh-audio-review-gate'; banner.className = 'kh-audio-review-gate'; var first = document.querySelector('#blocks'); if (first && first.parentNode) first.parentNode.insertBefore(banner, first); }
  banner.hidden = false;
  var lang = document.documentElement.lang;
  var host = $('blocks');
  if (!host) return;
  var importer = document.getElementById('kh-audio-asr-import');
  if (!importer) {
    importer = document.createElement('div'); importer.id = 'kh-audio-asr-import'; importer.className = 'kh-audio-review-gate kh-drop';
    importer.style.setProperty('--tone', 'var(--accent, #c9a45c)');
    var importLabel = document.createElement('label'); importLabel.htmlFor = 'kh-audio-asr-file'; importLabel.className = 'kh-drop-label';
    var importIcon = document.createElement('span'); importIcon.setAttribute('aria-hidden', 'true'); importIcon.textContent = '📄';
    var importText = document.createElement('span'); importText.className = 'kh-drop-text';
    importText.textContent = 'تحميل تقرير مدقق النطق (JSON) — ' + (pronunciationReportStatus || 'اختياري');
    importLabel.append(importIcon, importText);
    var input = document.createElement('input'); input.id = 'kh-audio-asr-file'; input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', function () { importPronunciationReport(input.files && input.files[0]); });
    importer.append(importLabel, input); host.parentNode.insertBefore(importer, host);
  } else {
    var importTextExisting = importer.querySelector('.kh-drop-text');
    if (importTextExisting) importTextExisting.textContent = 'تحميل تقرير مدقق النطق (JSON) — ' + (pronunciationReportStatus || 'اختياري');
  }
  var blocks = Array.prototype.slice.call(host.querySelectorAll(':scope > .block'));
  var blockByIndex = Object.create(null);
  blocks.forEach(function (block, position) {
    var index = Number.isInteger(Number(block.dataset.blockIndex)) ? Number(block.dataset.blockIndex) : position;
    blockByIndex[index] = block;
  });
  blocks.forEach(function (block) {
    Array.prototype.slice.call(block.querySelectorAll(':scope > .kh-audio-review-controls')).forEach(function (old) { old.remove(); });
  });
  if (lang === 'ar') {
    blocks.forEach(function (block, position) {
      var index = Number.isInteger(Number(block.dataset.blockIndex)) ? Number(block.dataset.blockIndex) : position;
      var localizedBlock = story.i18n && story.i18n.ar && story.i18n.ar.blocks && story.i18n.ar.blocks[index];
      renderSpeechTextPanel(block, index, localizedBlock);
    });
  }
  if (!manifests[lang]) {
    var missingManifest = /HTTP 404/.test(String(manifestErrors[lang] || ''));
    blocks.forEach(function (block, index) {
      var localizedBlock = story.i18n && story.i18n[lang] && story.i18n[lang].blocks && story.i18n[lang].blocks[index];
      if (!localizedBlock || !['narrator', 'karma'].includes(localizedBlock.speaker) || !String(localizedBlock.text || '').trim()) return;
      var panel = document.createElement('div');
      panel.className = 'kh-audio-review-controls kh-audio-card';
      panel.dataset.audioState = missingManifest ? 'not-started' : 'unavailable';
      panel.dataset.player = 'unavailable';
      panel.dataset.speaker = localizedBlock.speaker;
      var missingHead = document.createElement('div');
      missingHead.className = 'kh-card-head';
      var missingWho = document.createElement('div');
      missingWho.className = 'kh-who';
      var missingSpeaker = document.createElement('span');
      missingSpeaker.className = 'kh-audio-speaker';
      text(missingSpeaker, speakerLabel(localizedBlock.speaker) + ' · مقطع ' + (index + 1));
      missingWho.append(speakerAvatar(localizedBlock.speaker), missingSpeaker);
      missingHead.appendChild(missingWho);
      var playBtn = iconButton('play', 'الصوت غير جاهز', 'play', function () {});
      playBtn.disabled = true;
      var audioState = document.createElement('span');
      audioState.className = 'kh-audio-ready-state ' + (missingManifest ? 'not-started' : 'failed');
      text(audioState, missingManifest ? 'لم يبدأ إنتاج الصوت' : 'تعذر التحقق من تجهيز الصوت: ' + String(manifestErrors[lang] || 'خطأ غير محدد'));
      var missingTrack = document.createElement('div');
      missingTrack.className = 'kh-audio-track';
      missingTrack.appendChild(audioState);
      var missingRow = document.createElement('div');
      missingRow.className = 'kh-audio-player';
      missingRow.append(playBtn, missingTrack);
      panel.append(missingHead, missingRow);
      block.appendChild(panel);
    });
    return;
  }
  if (activeLang !== lang) activeLang = lang;
  (manifestStale[lang] || []).forEach(function (index) {
    var staleBlock = blockByIndex[index], staleLocal = story.i18n && story.i18n[lang] && story.i18n[lang].blocks && story.i18n[lang].blocks[index];
    if (!staleBlock || !staleLocal) return;
    var stalePanel = document.createElement('div');
    stalePanel.className = 'kh-audio-review-controls kh-audio-card';
    stalePanel.dataset.audioState = 'stale'; stalePanel.dataset.player = 'unavailable'; stalePanel.dataset.speaker = staleLocal.speaker;
    var staleNote = document.createElement('span');
    staleNote.className = 'kh-audio-ready-state failed';
    text(staleNote, speakerLabel(staleLocal.speaker) + ' · مقطع ' + (index + 1) + ': الصوت المسجّل قديم ولا يطابق نص القراءة المعتمد؛ يلزم إعادة توليد صوت هذا المقطع. لم يُقبل ولم يُعدَّل أي قرار سابق.');
    stalePanel.appendChild(staleNote);
    staleBlock.appendChild(stalePanel);
  });
  entries.filter(function (e) { return e.lang === lang; }).sort(function (a, b) {
    return a.block_index - b.block_index || a.chunk_index - b.chunk_index;
  }).forEach(function (entry) {
    var block = blockByIndex[entry.block_index];
    if (!block) return;
    var panel = document.createElement('div'); panel.className = 'kh-audio-review-controls kh-audio-card'; panel.dataset.clipKey = entry.key;
    var saved = review.clips[entry.key];
    var wasListened = played[entry.key] === true;
    var cacheHit = !!loadedAudio[entry.lang + '|' + entry.src];
    panel.dataset.player = wasListened ? 'ended' : 'idle';
    panel.dataset.listened = wasListened ? '1' : '0';
    panel.dataset.loaded = cacheHit ? '1' : '0';
    panel.dataset.indeterminate = '0';
    panel.dataset.review = saved ? saved.status : 'none';
    panel.dataset.speaker = entry.speaker;
    var cardHead = document.createElement('div'); cardHead.className = 'kh-card-head';
    var who = document.createElement('div'); who.className = 'kh-who';
    var speakerTag = document.createElement('span'); speakerTag.className = 'kh-audio-speaker';
    text(speakerTag, speakerLabel(entry.speaker) + ' · مقطع ' + (entry.block_index + 1) + (entry.chunk_index > 0 ? ' · جزء ' + (entry.chunk_index + 1) : ''));
    who.append(speakerAvatar(entry.speaker), speakerTag);
    var reviewBadge = document.createElement('span'); reviewBadge.className = 'kh-audio-badge';
    reviewBadge.dataset.status = saved ? saved.status : 'none';
    text(reviewBadge, saved ? (saved.status === 'accepted' ? 'تمت الموافقة ✓' : 'مرفوض ✕') : 'بانتظار المراجعة');
    cardHead.append(who, reviewBadge);
    var steps = buildSteps(['استمع للمقطع كاملًا', 'وافق أو سجّل ملاحظة']);
    var audioState = document.createElement('span');
    audioState.className = 'kh-audio-ready-state ' + (wasListened ? 'ended' : (cacheHit ? 'ready' : 'idle'));
    text(audioState, wasListened ? 'اكتمل الاستماع' : (cacheHit ? 'تم التحميل · جاهز للتشغيل' : 'لم يُحمَّل بعد — اضغط تشغيل'));
    var state = document.createElement('span'); state.className = 'kh-audio-review-state';
    text(state, saved ? '' : 'استمع إلى المقطع كاملًا لتفعيل زر الموافقة.');
    var playBtn = iconButton('play', 'تشغيل', 'play', function () { play(entry, playBtn); });
    playBtn.dataset.mode = 'play';
    var replayBtn = iconButton('replay', 'من البداية', 'replay', function () { play(entry, playBtn, true); });
    var acceptBtn = iconButton('check', 'موافقة على الصوت', 'accept', async function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل الموافقة عليه.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      state.textContent = 'جارٍ الحفظ…';
      try { await saveReview(entry, { status: 'accepted' }); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
    });
    setAcceptState(acceptBtn, !!played[entry.key], !!saved);
    acceptButtons[entry.key] = acceptBtn;
    var rejectBtn = iconButton('x', 'رفض / ملاحظة', 'reject', function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الملاحظة أو الرفض.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      editor.hidden = !editor.hidden;
      setButtonFace(rejectBtn, editor.hidden ? 'x' : 'x', editor.hidden ? 'رفض / ملاحظة' : 'إغلاق الملاحظة');
    });
    var editor = document.createElement('div'); editor.className = 'kh-audio-review-editor'; editor.hidden = true;
    var issue = document.createElement('select');
    [['text','مشكلة في النص أو النطق'],['audio_only','النص صحيح والمشكلة في الصوت فقط']].forEach(function (opt) {
      var o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1]; issue.appendChild(o);
    });
    var note = document.createElement('textarea'); note.maxLength = 1000; note.placeholder = 'ملاحظتك على هذا المقطع (مطلوبة عند الرفض)';
    var suggestion = document.createElement('textarea'); suggestion.maxLength = 1000; suggestion.placeholder = 'صياغة مقترحة بديلة (اختياري — لا تُطبّق تلقائيًا)';
    if (saved) { note.value = saved.note || ''; suggestion.value = saved.suggestion || ''; issue.value = saved.issue || 'text'; }
    var saveReject = iconButton('x', 'حفظ الرفض', 'reject-save', async function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الرفض.'; return; }
      if (!canWrite) { state.textContent = 'افتح المعاينة من لوحة الإدارة لتسجيل القرار.'; return; }
      if (!note.value.trim()) { note.focus(); state.textContent = 'اكتب ملاحظة قبل حفظ الرفض.'; return; }
      state.textContent = 'جارٍ حفظ الرفض…';
      try { await saveReview(entry, { status: 'rejected', note: note.value, suggestion: suggestion.value, issue: issue.value }); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
    });
    editor.append(issue, note, suggestion, saveReject);
    var track = document.createElement('div'); track.className = 'kh-audio-track';
    var progress = document.createElement('div'); progress.className = 'kh-audio-progress';
    var progressFill = document.createElement('span'); progressFill.className = 'kh-audio-progress-fill';
    progress.appendChild(progressFill);
    var meta = document.createElement('div'); meta.className = 'kh-audio-meta';
    var timeLabel = document.createElement('span'); timeLabel.className = 'kh-audio-time'; text(timeLabel, '0:00 / 0:00');
    meta.append(audioState, timeLabel);
    track.append(progress, meta);
    var player = document.createElement('div'); player.className = 'kh-audio-player';
    player.append(playBtn, track, replayBtn);
    var actions = document.createElement('div'); actions.className = 'kh-audio-actions';
    actions.append(acceptBtn, rejectBtn);
    panel.append(cardHead, steps, player, actions, state, editor);
    if (wasListened) markProgressDone(panel);
    syncSteps(panel);
    renderPronunciationResult(entry, panel);
    block.appendChild(panel);
  });
}
function render() {
  if (!story) return;
  renderBlocks();
  var banner = document.getElementById('kh-audio-review-gate');
  if (banner) {
    renderGateBanner(banner);
    renderGenerationControls(banner);
    banner.hidden = false;
  }
  try { document.dispatchEvent(new CustomEvent('kh-audio-review-updated')); } catch (e) {}
}
function injectStyles() {
  if ($('kh-audio-review-style')) return;
  var href = 'reader-audio-review.css?v=20261108-review-design-1';
  try { href = new URL('reader-audio-review.css?v=20261108-review-design-1', SCRIPT_SRC).href; } catch (e) {}
  var link = document.createElement('link');
  link.id = 'kh-audio-review-style';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
async function initialize(nextStory) {
  if (!nextStory || !nextStory.slug || initializing || initialized) return;
  initializing = true;
  story = nextStory;
  injectStyles();
  try {
    var connected = await loadRow();
    if (!connected) { initializing = false; return; }
    // Show the speech-text editor as soon as the authenticated review record loads.
    // Audio staging/manifests are independent and must never hide the text workflow.
    initialized = true;
    initializing = false;
    render();
    try {
      await loadManifests();
      render();
    } catch (audioError) {
      manifestLoadFailure = true;
      manifestErrors[document.documentElement.lang || 'ar'] =
        'تعذر تحميل معاينة الصوت: ' + (audioError && audioError.message || audioError);
      render();
    }
  } catch (e) {
    initializing = false;
    var host = $('blocks');
    if (host) {
      var note = document.createElement('p'); note.className = 'kh-audio-review-gate'; note.dataset.state = 'error';
      text(note, 'تعذر الاتصال بسجل مراجعة النص: ' + (e.message || e));
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
