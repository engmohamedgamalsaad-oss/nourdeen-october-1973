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
var initialArabicStageAttempted = false;
var speechTexts = {}, speechTextBusy = {}, speechTextDirty = {};
var PLAY_LABEL = '▶ تشغيل', PAUSE_LABEL = '⏸ إيقاف مؤقت';
var activeControl = null;

function $(id) { return document.getElementById(id); }
function text(el, value) { el.textContent = value == null ? '' : String(value); }
function speakerLabel(speaker) { return speaker === 'karma' ? 'كارما' : speaker === 'narrator' ? 'الراوي' : String(speaker || ''); }
function fmtTime(sec) {
  sec = Number(sec);
  if (!isFinite(sec) || sec < 0) sec = 0;
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
/* حالة المشغّل البصرية للبطاقة: idle | loading | playing | paused | ended | error | unavailable */
function setPlayerState(control, state) { if (control) control.dataset.player = state; }
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
  var timeout = controller ? setTimeout(function () { controller.abort(); }, payload && payload.action === 'prepare_speech_text' ? 90000 : 25000) : null;
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
    if (networkError && networkError.name === 'AbortError') throw new Error('انتهت مهلة الاتصال أثناء تجهيز النص. أعد المحاولة؛ لم يتم اعتماد أي نص.');
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
  manifests = {}; manifestErrors = {}; entries = []; readyByKey = {}; played = {}; acceptButtons = {}; manifestLoadFailure = false;
  var expectedTexts = {};
  LANGS.forEach(function (lang) {
    var localized = story.i18n && story.i18n[lang];
    expectedTexts[lang] = localized && Array.isArray(localized.blocks)
      ? localized.blocks.map(function (block) { return String(block && block.text || ''); }) : [];
  });
  expectedTexts.ar = await loadArabicExpectedTexts(expectedTexts.ar.map(function (text) { return { text: text }; }));
  var stagingError = '';
  try {
    await ensureArabicAudioStaged(expectedTexts.ar);
  } catch (error) {
    // A missing/failed audio artifact must not block speech-text editing.
    stagingError = String(error && error.message || error);
  }
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
        var expected = seg.speaker === 'karma' ? core.VOICES.karma : seg.speaker === 'narrator' ? core.VOICES.narrator : '';
        var engineOk = lang === 'ar'
          ? ((seg.provider === 'fish-audio' && seg.model === 's2.1-pro-free' && seg.voice === expected) ||
             (seg.provider === 'huggingface-space' && seg.model === 'NAMAA-Space/NAMAA-Egyptian-TTS' &&
              seg.voice === (seg.speaker === 'karma' ? 'magdi-yacoub-karma-reference' : 'magdi-yacoub-narrator-reference')))
          : seg.provider === 'edge-tts' && seg.model === 'edge-tts' && typeof seg.voice === 'string' && !!seg.voice.trim();
        if (!expected || !engineOk || typeof seg.src !== 'string' || !/^[A-Za-z0-9_-]+\.mp3$/.test(seg.src) || typeof seg.text !== 'string' || !seg.text.trim() || (seg.audio_sha256 != null && !/^[a-f0-9]{64}$/i.test(String(seg.audio_sha256)))) {
          throw new Error('مقطع صوتي لا يطابق المتحدث أو مزوّد/صوت اللغة المعتمد.');
        }
      });
      var localized = story.i18n && story.i18n[lang];
      var coverage = core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang], lang === 'ar' && data.provider === 'huggingface-space');
      if (!coverage.ok) throw new Error(coverage.error);
      manifests[lang] = data;
    } catch (e) {
      manifestErrors[lang] = String(e && e.message || e);
      if (lang === 'ar' && stagingError) manifestErrors[lang] += ' — تعذر تجهيز ملف الصوت الأول: ' + stagingError;
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
function renderGateBanner(banner) {
  var g = gate();
  banner.replaceChildren();
  var message = document.createElement('div');
  message.className = 'kh-gate-message';
  text(message, gateSummary());
  banner.appendChild(message);
  if (!entries.length) return;
  var total = entries.length;
  var ready = entries.filter(function (entry) { return readyByKey[entry.key] === 'ready'; }).length;
  var accepted = entries.filter(function (entry) {
    var clip = review.clips[entry.key];
    return clip && clip.status === 'accepted';
  }).length;
  function progressRow(label, value) {
    var row = document.createElement('div');
    row.className = 'kh-audio-progress-row';
    var caption = document.createElement('span');
    text(caption, label + ': ' + value + '/' + total);
    var bar = document.createElement('progress');
    bar.max = total;
    bar.value = value;
    bar.setAttribute('aria-label', label);
    row.append(caption, bar);
    banner.appendChild(row);
  }
  progressRow('المقاطع الجاهزة للاستماع', ready);
  progressRow('المقاطع المقبولة بعد الاستماع', accepted);
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
  var audioStateNode = control && control.querySelector('.kh-audio-ready-state');
  var acceptBtn = control && control.querySelector('.kh-audio-review-btn.accept');
  if (control && control.dataset.player === 'loading') return;
  if (activeEntryKey === entry.key && audio && audio.src) {
    if (forceRestart) {
      try {
        audio.currentTime = 0;
        await audio.play();
        button.classList.add('kh-audio-review-playing');
        button.textContent = PAUSE_LABEL;
        setPlayerState(control, 'playing');
        updateProgress(control);
        if (stateNode) stateNode.textContent = 'أُعيد تشغيل المقطع من البداية…';
      } catch (e) {
        if (stateNode) stateNode.textContent = 'تعذرت إعادة التشغيل: ' + (e.message || e);
      }
      return;
    }
    if (!audio.paused) {
      audio.pause();
      button.classList.remove('kh-audio-review-playing');
      button.textContent = PLAY_LABEL;
      setPlayerState(control, 'paused');
      if (stateNode) stateNode.textContent = 'تم إيقاف المقطع مؤقتًا.';
    } else {
      try {
        await audio.play();
        button.classList.add('kh-audio-review-playing');
        button.textContent = PAUSE_LABEL;
        setPlayerState(control, 'playing');
        if (stateNode) stateNode.textContent = 'المقطع يعمل الآن…';
      } catch (e) {
        if (stateNode) stateNode.textContent = 'تعذر استكمال التشغيل: ' + (e.message || e);
      }
    }
    return;
  }
  played[entry.key] = false;
  if (acceptBtn) acceptBtn.disabled = true;
  if (activeControl && activeControl !== control) setPlayerState(activeControl, 'idle');
  activeControl = control;
  setPlayerState(control, 'loading');
  resetProgress(control);
  if (stateNode) stateNode.textContent = 'جارٍ تحميل الملف والتحقق من بصمته…';
  if (audioStateNode) { audioStateNode.className = 'kh-audio-ready-state preparing'; audioStateNode.textContent = 'جارٍ تجهيز الصوت للتشغيل'; }
  if (!audio) audio = new Audio();
  try {
    if (activePlayButton && activePlayButton !== button) {
      activePlayButton.classList.remove('kh-audio-review-playing');
      activePlayButton.textContent = PLAY_LABEL;
    }
    try { audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null; audio.pause(); audio.currentTime = 0; } catch (e) {}
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    activeEntryKey = '';
    activePlayButton = null;
    var url = new URL(entry.signed_src || entry.src, manifestUrl(entry.lang));
    url.searchParams.set('v', String(entry.audio_sha256 || entry.segment.audio_sha256 || entry.segment.hash || entry.manifest.generated_at || entry.manifest.version));
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
    if (audioStateNode) { audioStateNode.className = 'kh-audio-ready-state ready'; audioStateNode.textContent = 'جاهز للاستماع'; }
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
    activeObjectUrl = URL.createObjectURL(blob);
    activeEntryKey = entry.key;
    activePlayButton = button;
    audio.src = activeObjectUrl;
    audio.onloadedmetadata = function () { updateProgress(control); };
    audio.ontimeupdate = function () { updateProgress(control); };
    audio.load();
    button.classList.add('kh-audio-review-playing');
    button.textContent = PAUSE_LABEL;
    setPlayerState(control, 'playing');
    audio.onended = function () {
      button.classList.remove('kh-audio-review-playing');
      button.textContent = PLAY_LABEL;
      setPlayerState(control, 'ended');
      updateProgress(control);
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = true;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = false;
      if (stateNode) stateNode.textContent = 'اكتمل الاستماع — يمكنك الموافقة على المقطع أو رفضه.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    audio.onerror = function () {
      button.classList.remove('kh-audio-review-playing');
      button.textContent = PLAY_LABEL;
      setPlayerState(control, 'error');
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = false;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true;
      if (audioStateNode) { audioStateNode.className = 'kh-audio-ready-state failed'; audioStateNode.textContent = 'فشل تجهيز الصوت للتشغيل'; }
      if (stateNode) stateNode.textContent = 'تعذر تشغيل المقطع؛ لم يتم تسجيل الاستماع.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    };
    var playback = audio.play();
    if (playback && playback.catch) playback.catch(function () {
      button.classList.remove('kh-audio-review-playing');
      button.textContent = PLAY_LABEL;
      setPlayerState(control, 'error');
      activeEntryKey = '';
      activePlayButton = null;
      played[entry.key] = false;
      if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true;
      if (stateNode) stateNode.textContent = 'تعذر بدء تشغيل المقطع؛ حاول مرة أخرى.';
      if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    });
  } catch (e) {
    button.classList.remove('kh-audio-review-playing');
    button.textContent = PLAY_LABEL;
    setPlayerState(control, 'error');
    activeEntryKey = '';
    activePlayButton = null;
    if (acceptBtn) acceptBtn.disabled = true;
    if (audioStateNode) { audioStateNode.className = 'kh-audio-ready-state failed'; audioStateNode.textContent = 'فشل تجهيز الصوت للتشغيل'; }
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
async function generateNextArabicBlock(statusNode, button) {
  if (generationBusy) return;
  var nextBlock = nextArabicBlockIndex();
  if (nextBlock < 0) {
    text(statusNode, 'كل المقاطع العربية من 1 إلى 17 مقبولة بالفعل.');
    return;
  }
  if (Object.keys(speechTextBusy).some(function (key) { return speechTextBusy[key]; })) {
    text(statusNode, 'انتظر حتى ينتهي تجهيز أو اعتماد نص القراءة الحالي.');
    return;
  }
  var speechRecord = speechTexts[speechTextKey(nextBlock)];
  if (!speechRecord || speechRecord.status !== 'approved' || !speechRecord.approved_text || speechTextDirty[nextBlock]) {
    text(statusNode, 'المقطع ' + (nextBlock + 1) + ' متوقف: جهّز نص القراءة في بطاقة المقطع ثم راجعه واعتمده قبل توليد الصوت.');
    return;
  }
  if (!window.confirm('سيتم الآن توليد المقطع العربي رقم ' + (nextBlock + 1) + ' فقط باستخدام NAMAA، من نص القراءة الذي اعتمدته. هل توافق على استهلاك رصيد التوليد؟')) return;
  generationBusy = true;
  button.disabled = true;
  text(statusNode, 'جارٍ إرسال طلب توليد المقطع ' + (nextBlock + 1) + '…');
  try {
    var started = await audioAssetsRequest({
      action: 'generate',
      section: 'history', slug: 'ibn-sina', language: 'ar',
      block_index: nextBlock
    });
    if (!started || !started.request_id) throw new Error('لم يرجع الخادم رقم طلب التوليد.');
    var result = null;
    for (var attempt = 0; attempt < 120; attempt++) {
      await new Promise(function (resolve) { setTimeout(resolve, 5000); });
      result = await audioAssetsRequest({
        action: 'generation_status', section: 'history', slug: 'ibn-sina', language: 'ar',
        request_id: started.request_id, block_index: nextBlock
      });
      if (result.status === 'completed' && result.conclusion === 'success' && result.artifact_id) break;
      if (result.status === 'completed' || result.error) throw new Error(result.error || ('انتهى Workflow بنتيجة: ' + (result.conclusion || 'غير معروفة')));
      text(statusNode, result.status === 'queued' ? 'طلب التوليد في قائمة الانتظار…' : 'جارٍ توليد المقطع ' + (nextBlock + 1) + '…');
    }
    if (!result || result.status !== 'completed' || result.conclusion !== 'success' || !result.artifact_id) {
      throw new Error('لم يكتمل التوليد خلال المهلة المحددة. لم يتم اعتماد أو نشر أي صوت.');
    }
    text(statusNode, 'اكتمل التوليد؛ جارٍ نقل الصوت إلى مساحة المراجعة الخاصة…');
    await audioAssetsRequest({
      action: 'stage', section: 'history', slug: 'ibn-sina', language: 'ar',
      artifact_id: result.artifact_id, run_id: result.run_id,
      artifact_name: 'ibn-sina-arabic-audio-staging',
      request_id: started.request_id, block_index: nextBlock
    });
    text(statusNode, 'الصوت الجديد جاهز. جارٍ تحديث المقاطع للاستماع…');
    await loadManifests();
    generationMessage = 'تم تجهيز المقطع ' + (nextBlock + 1) + ' للمراجعة فقط؛ لم يُنشر.';
    render();
  } catch (error) {
    text(statusNode, 'تعذر تجهيز المقطع: ' + (error && error.message || error));
  } finally {
    generationBusy = false;
    button.disabled = false;
  }
}
function renderGenerationControls(banner) {
  if (!story || story.section !== 'history' || story.slug !== 'ibn-sina' || document.documentElement.lang !== 'ar') return;
  var panel = document.createElement('div');
  panel.className = 'kh-audio-review-controls kh-audio-generation-controls';
  var title = document.createElement('strong');
  title.className = 'kh-gen-title';
  text(title, '🎙️ توليد الصوت بـ NAMAA');
  var status = document.createElement('span');
  status.className = 'kh-audio-review-state';
  text(status, generationMessage || 'الترتيب: جميع مقاطع كارما أولًا، ثم مقاطع الراوي؛ ولا يُولد المقطع إلا بعد اعتماد نص قراءته.');
  var button = makeButton('توليد المقطع العربي التالي', 'generate', function () {
    generateNextArabicBlock(status, button);
  });
  button.disabled = generationBusy;
  panel.append(title, button, status);
  banner.appendChild(panel);
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
      action: 'prepare_speech_text', section: 'history', slug: 'ibn-sina',
      language: 'ar', block_index: index
    });
    if (!proposal || !proposal.speech_text || !proposal.source_text_hash) throw new Error('لم يرجع Gemini نصًا صالحًا للمقطع.');
    var saved = await audioAssetsRequest({
      action: 'speech_text_save', section: 'history', slug: 'ibn-sina', language: 'ar',
      block_index: index, decision: 'suggested', speech_text: proposal.speech_text,
      source_text_hash: proposal.source_text_hash, model: proposal.model,
      changes_summary: proposal.changes_summary,
      pronunciation_notes: proposal.pronunciation_notes, review_flags: proposal.review_flags
    });
    speechTexts[key] = saved.speech_text;
    speechTextDirty[index] = false;
    text(statusNode, 'وصل اقتراح Gemini وتم حفظه كمسودة — لم يُعتمد ولم يُرسل إلى NAMAA.');
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
      action: 'speech_text_save', section: 'history', slug: 'ibn-sina', language: 'ar',
      block_index: index, decision: 'approved', speech_text: value,
      source_text_hash: record.source_text_hash
    });
    speechTexts[key] = saved.speech_text;
    speechTextDirty[index] = false;
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
  head.className = 'kh-speech-head';
  var heading = document.createElement('strong');
  heading.className = 'kh-audio-speaker';
  heading.textContent = 'نص القراءة الصوتية — ' + speakerLabel(localizedBlock.speaker);
  var badge = document.createElement('span');
  badge.className = 'kh-audio-badge';
  badge.dataset.status = statusKey;
  badge.textContent = speechBadgeText(statusKey);
  head.append(heading, badge);
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
  var currentBlockIndex = nextArabicBlockIndex();
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
  var suggest = makeButton(record.suggested_text ? '↻ إعادة اقتراح من Gemini' : '✨ تجهيز النص بـ Gemini', 'generate', function () {
    prepareSpeechText(index, status, suggest);
  });
  var approve = makeButton(record.status === 'approved' ? '✓ حفظ واعتماد التعديل' : '✓ اعتماد نص القراءة', 'accept', function () {
    approveSpeechText(index, textarea, status, approve);
  });
  approve.disabled = !record.suggested_text || !canWrite || !!speechTextBusy[key] || !isCurrentBlock;
  suggest.disabled = !canWrite || !!speechTextBusy[key] || !isCurrentBlock;
  var actions = document.createElement('div');
  actions.className = 'kh-audio-actions';
  actions.append(suggest, approve);
  panel.append(head, grid, notes, actions, status);
  block.appendChild(panel);
}
function render() {
  if (!story) return;
  var banner = document.getElementById('kh-audio-review-gate');
  if (!banner) { banner = document.createElement('div'); banner.id = 'kh-audio-review-gate'; banner.className = 'kh-audio-review-gate'; var first = document.querySelector('#blocks'); if (first && first.parentNode) first.parentNode.insertBefore(banner, first); }
  renderGateBanner(banner);
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
  var blockByIndex = Object.create(null);
  blocks.forEach(function (block, position) {
    var index = Number.isInteger(Number(block.dataset.blockIndex)) ? Number(block.dataset.blockIndex) : position;
    blockByIndex[index] = block;
  });
  blocks.forEach(function (block) {
    Array.prototype.slice.call(block.querySelectorAll(':scope > .kh-audio-review-controls')).forEach(function (old) { old.remove(); });
  });
  if (story.section === 'history' && story.slug === 'ibn-sina' && lang === 'ar') {
    blocks.forEach(function (block, position) {
      var index = Number.isInteger(Number(block.dataset.blockIndex)) ? Number(block.dataset.blockIndex) : position;
      var localizedBlock = story.i18n && story.i18n.ar && story.i18n.ar.blocks && story.i18n.ar.blocks[index];
      renderSpeechTextPanel(block, index, localizedBlock);
    });
  }
  renderGenerationControls(banner);
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
      missingHead.className = 'kh-audio-card-head';
      var missingSpeaker = document.createElement('span');
      missingSpeaker.className = 'kh-audio-speaker';
      text(missingSpeaker, speakerLabel(localizedBlock.speaker) + ' · مقطع ' + (index + 1));
      missingHead.appendChild(missingSpeaker);
      var playBtn = makeButton('▶ الصوت غير جاهز', 'play', function () {});
      playBtn.disabled = true;
      var audioState = document.createElement('span');
      audioState.className = 'kh-audio-ready-state ' + (missingManifest ? 'not-started' : 'failed');
      text(audioState, missingManifest ? 'لم يبدأ إنتاج الصوت' : 'تعذر التحقق من تجهيز الصوت: ' + String(manifestErrors[lang] || 'خطأ غير محدد'));
      var missingRow = document.createElement('div');
      missingRow.className = 'kh-audio-player';
      missingRow.append(playBtn, audioState);
      panel.append(missingHead, missingRow);
      block.appendChild(panel);
    });
    return;
  }
  if (activeLang !== lang) activeLang = lang;
  var manifest = manifests[lang];
  entries.filter(function (e) { return e.lang === lang; }).sort(function (a, b) {
    return a.block_index - b.block_index || a.chunk_index - b.chunk_index;
  }).forEach(function (entry) {
    var block = blockByIndex[entry.block_index];
    if (!block) return;
    var panel = document.createElement('div'); panel.className = 'kh-audio-review-controls kh-audio-card'; panel.dataset.clipKey = entry.key;
    panel.dataset.player = 'idle';
    panel.dataset.speaker = entry.speaker;
    var saved = review.clips[entry.key];
    var cardHead = document.createElement('div'); cardHead.className = 'kh-audio-card-head';
    var speakerTag = document.createElement('span'); speakerTag.className = 'kh-audio-speaker';
    text(speakerTag, speakerLabel(entry.speaker) + ' · مقطع ' + (entry.block_index + 1));
    var reviewBadge = document.createElement('span'); reviewBadge.className = 'kh-audio-badge';
    reviewBadge.dataset.status = saved ? saved.status : 'none';
    text(reviewBadge, saved ? (saved.status === 'accepted' ? 'تمت الموافقة ✓' : 'مرفوض ✕') : 'بانتظار المراجعة');
    cardHead.append(speakerTag, reviewBadge);
    var audioState = document.createElement('span'); audioState.className = 'kh-audio-ready-state ready'; text(audioState, 'جاهز للاستماع');
    var state = document.createElement('span'); state.className = 'kh-audio-review-state';
    text(state, saved ? '' : 'استمع إلى المقطع كاملًا لتفعيل زر الموافقة.');
    var playBtn = makeButton(PLAY_LABEL, 'play', function () { play(entry, playBtn); });
    var replayBtn = makeButton('↻ من البداية', 'replay', function () { play(entry, playBtn, true); });
    var acceptBtn = makeButton('✓ موافقة على الصوت', 'accept', async function () {
      if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل الموافقة عليه.'; return; }
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
      rejectBtn.textContent = editor.hidden ? '✕ رفض / ملاحظة' : 'إغلاق الملاحظة';
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
    var track = document.createElement('div'); track.className = 'kh-audio-track';
    var progress = document.createElement('div'); progress.className = 'kh-audio-progress';
    var progressFill = document.createElement('span'); progressFill.className = 'kh-audio-progress-fill';
    progress.appendChild(progressFill);
    var meta = document.createElement('div'); meta.className = 'kh-audio-meta';
    var timeLabel = document.createElement('span'); timeLabel.className = 'kh-audio-time'; text(timeLabel, '0:00 / 0:00');
    meta.append(audioState, timeLabel);
    track.append(progress, meta);
    var player = document.createElement('div'); player.className = 'kh-audio-player';
    player.append(playBtn, track);
    var actions = document.createElement('div'); actions.className = 'kh-audio-actions';
    actions.append(replayBtn, acceptBtn, rejectBtn);
    panel.append(cardHead, player, actions, state, editor);
    renderPronunciationResult(entry, panel);
    block.appendChild(panel);
  });
  renderGateBanner(banner);
  banner.hidden = false;
}
function injectStyles() {
  if ($('kh-audio-review-style')) return;
  var style = document.createElement('style'); style.id = 'kh-audio-review-style';
  style.textContent = [
    '.kh-audio-review-controls{--kh-ok:#2fa36b;--kh-warn:#d28a2d;--kh-bad:#d0605e;--kh-edge:color-mix(in srgb,var(--accent,#c9a45c) 38%,var(--line,#3a4654));display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0;padding:14px;border:1px solid var(--kh-edge);border-radius:18px;background:color-mix(in srgb,var(--panel,#16202b) 94%,transparent);box-shadow:0 8px 22px rgba(0,0,0,.16);font:600 13px/1.6 Cairo,Arial,sans-serif;color:var(--text,inherit)}',
    '.kh-audio-card,.kh-speech-text-controls{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}',
    '.kh-audio-card-head,.kh-speech-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}',
    '.kh-audio-speaker{display:inline-flex;align-items:center;gap:8px;font:800 14px Cairo,Arial,sans-serif;color:var(--text,inherit)}',
    '.kh-audio-speaker::before{content:"";width:11px;height:11px;border-radius:50%;background:var(--accent,#c9a45c);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#c9a45c) 25%,transparent)}',
    '.kh-audio-review-controls[data-speaker="karma"] .kh-audio-speaker::before{background:#e07aa0;box-shadow:0 0 0 3px rgba(224,122,160,.25)}',
    '.kh-audio-review-controls[data-speaker="narrator"] .kh-audio-speaker::before{background:#5aa0e0;box-shadow:0 0 0 3px rgba(90,160,224,.25)}',
    '.kh-audio-badge{display:inline-flex;align-items:center;padding:3px 12px;border-radius:999px;border:1px solid currentColor;font:800 12px Cairo,Arial,sans-serif;color:var(--muted,#9aa7b4)}',
    '.kh-audio-badge[data-status="accepted"],.kh-audio-badge[data-status="approved"]{color:var(--kh-ok);background:color-mix(in srgb,var(--kh-ok) 14%,transparent)}',
    '.kh-audio-badge[data-status="rejected"]{color:var(--kh-bad);background:color-mix(in srgb,var(--kh-bad) 14%,transparent)}',
    '.kh-audio-badge[data-status="suggested"],.kh-audio-badge[data-status="dirty"]{color:var(--kh-warn);background:color-mix(in srgb,var(--kh-warn) 14%,transparent)}',
    '.kh-audio-player{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:14px;padding:12px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent,#c9a45c) 22%,transparent);background:color-mix(in srgb,var(--accent,#c9a45c) 7%,transparent)}',
    '.kh-audio-review-btn{border:1.5px solid var(--accent,#c9a45c);border-radius:12px;padding:8px 14px;background:transparent;color:inherit;font:800 13px Cairo,Arial,sans-serif;cursor:pointer;min-height:42px;transition:transform .12s ease,box-shadow .2s ease,background .2s ease,opacity .2s ease}',
    '.kh-audio-review-btn:hover:not(:disabled){transform:translateY(-1px)}',
    '.kh-audio-review-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.kh-audio-review-btn.play{min-width:130px;min-height:50px;padding:10px 22px;border-radius:999px;border-color:var(--kh-ok);background:linear-gradient(135deg,#2fa36b,#238a58);color:#fff;font-size:14px;box-shadow:0 6px 16px rgba(47,163,107,.35)}',
    '.kh-audio-review-btn.play:disabled{background:transparent;color:var(--muted,#9aa7b4);border-color:var(--line,#3a4654);box-shadow:none}',
    '.kh-audio-card[data-player="playing"] .kh-audio-review-btn.play{border-color:var(--kh-warn);background:linear-gradient(135deg,#d28a2d,#b8731f);box-shadow:0 6px 16px rgba(210,138,45,.4);animation:khpulse 1.6s ease-in-out infinite}',
    '.kh-audio-card[data-player="loading"] .kh-audio-review-btn.play{opacity:.85;cursor:progress}',
    '.kh-audio-card[data-player="loading"] .kh-audio-review-btn.play::before{content:"";display:inline-block;width:13px;height:13px;margin-inline-end:8px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;vertical-align:-2px;animation:khspin .8s linear infinite}',
    '.kh-audio-card[data-player="error"] .kh-audio-review-btn.play{background:transparent;color:var(--kh-bad);border-color:var(--kh-bad);box-shadow:none}',
    '.kh-audio-review-btn.replay{border-color:var(--kh-edge)}',
    '.kh-audio-review-btn.accept{flex:1 1 170px;min-height:46px;border-color:var(--kh-ok);background:linear-gradient(135deg,#2fa36b,#238a58);color:#fff;font-size:14px}',
    '.kh-audio-review-btn.accept:disabled{background:transparent;color:var(--muted,#9aa7b4);border-color:var(--line,#3a4654)}',
    '.kh-audio-review-btn.reject,.kh-audio-review-btn.reject-save{border-color:var(--kh-bad);color:#e58a88}',
    '.kh-audio-review-btn.generate{border-color:var(--kh-warn);background:linear-gradient(135deg,#d28a2d,#b8731f);color:#fff}',
    '.kh-speech-text-controls .kh-audio-review-btn.generate{background:transparent;color:var(--kh-warn)}',
    '.kh-audio-review-btn.kh-audio-review-playing{color:#fff}',
    '.kh-audio-track{display:grid;gap:8px;min-width:0}',
    '.kh-audio-progress{position:relative;direction:ltr;height:10px;border-radius:999px;background:color-mix(in srgb,var(--text,#fff) 14%,transparent);overflow:hidden}',
    '.kh-audio-progress-fill{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#2fa36b,#6fd3a1);transition:width .2s linear}',
    '.kh-audio-card[data-player="loading"] .kh-audio-progress::after{content:"";position:absolute;top:0;bottom:0;left:0;width:35%;border-radius:999px;background:linear-gradient(90deg,transparent,var(--accent,#c9a45c),transparent);animation:khslide 1.1s ease-in-out infinite}',
    '.kh-audio-card[data-player="ended"] .kh-audio-progress-fill{background:linear-gradient(90deg,#2fa36b,#2fa36b)}',
    '.kh-audio-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}',
    '.kh-audio-time{direction:ltr;font-variant-numeric:tabular-nums;color:var(--muted,#9aa7b4)}',
    '.kh-audio-ready-state{font-size:12px;font-weight:800;margin:0}',
    '.kh-audio-ready-state.ready{color:var(--kh-ok)}.kh-audio-ready-state.ready::before{content:"✓ "}',
    '.kh-audio-ready-state.not-started,.kh-audio-ready-state.preparing{color:var(--kh-warn)}.kh-audio-ready-state.failed{color:var(--kh-bad)}',
    '.kh-audio-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
    '.kh-audio-review-state{flex-basis:100%;margin:0;font-size:12px;color:var(--muted,#9aa7b4)}',
    '.kh-audio-review-editor{display:grid;grid-template-columns:1fr;gap:8px;flex:1 1 100%;min-width:0;padding-top:8px}',
    '.kh-audio-review-editor[hidden]{display:none!important}.kh-audio-review-editor textarea,.kh-audio-review-editor select{box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid var(--line,#3a4654);border-radius:10px;background:var(--panel,#16202b);color:var(--text,inherit);font:13px/1.6 Cairo,Arial,sans-serif}',
    '.kh-speech-text-controls[data-status="approved"]{border-color:var(--kh-ok)}',
    '.kh-speech-text-controls[data-status="suggested"]{border-color:var(--kh-warn)}',
    '.kh-speech-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
    '.kh-speech-col{display:grid;gap:6px;align-content:start;min-width:0}',
    '.kh-speech-label{font:800 12px Cairo,Arial,sans-serif;color:var(--muted,#9aa7b4)}',
    '.kh-speech-source{margin:0;padding:10px 12px;border:1px dashed var(--line,#3a4654);border-radius:12px;background:color-mix(in srgb,var(--text,#fff) 4%,transparent);line-height:1.9;white-space:pre-wrap}',
    '.kh-speech-text-controls textarea{box-sizing:border-box;width:100%;min-width:0;resize:vertical;padding:10px 12px;border:1.5px solid var(--kh-edge);border-radius:12px;background:var(--panel,#16202b);color:var(--text,inherit);font:14px/1.9 Cairo,Arial,sans-serif}',
    '.kh-speech-text-controls textarea:focus{outline:none;border-color:var(--accent,#c9a45c);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#c9a45c) 25%,transparent)}',
    '.kh-speech-notes{display:grid;gap:6px}',
    '.kh-speech-notes:empty{display:none}',
    '.kh-speech-notes p{margin:0;padding:7px 11px;border-radius:10px;background:color-mix(in srgb,var(--accent,#c9a45c) 10%,transparent);font-size:12px;line-height:1.7;white-space:pre-wrap}',
    '.kh-audio-review-gate{max-width:1100px;margin:10px auto;padding:12px 16px;border:1px solid color-mix(in srgb,var(--accent,#c9a45c) 45%,transparent);border-radius:16px;background:color-mix(in srgb,var(--panel,#16202b) 94%,transparent);box-shadow:0 6px 18px rgba(0,0,0,.14);color:var(--text,inherit);font:600 13px/1.7 Cairo,Arial,sans-serif}',
    '.kh-audio-review-gate[hidden]{display:none!important}',
    '.kh-gate-message{font-weight:800}',
    '.kh-audio-generation-controls{margin:10px 0 0;border-style:dashed;background:color-mix(in srgb,var(--kh-warn,#d28a2d) 8%,var(--panel,#16202b))}',
    '.kh-gen-title{flex-basis:100%;font:800 14px Cairo,Arial,sans-serif}',
    '.kh-audio-progress-row{display:grid;grid-template-columns:minmax(170px,auto) minmax(100px,1fr);align-items:center;gap:10px;margin-top:8px;font-size:12px}.kh-audio-progress-row progress{width:100%;height:10px;accent-color:#2fa36b}',
    '.kh-audio-asr-result{display:grid;gap:6px;padding:8px;margin-top:2px;border-top:1px dashed var(--line,#3a4654);font-size:12px}',
    '.kh-audio-asr-word{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 0}',
    '@keyframes khspin{to{transform:rotate(360deg)}}',
    '@keyframes khslide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}',
    '@keyframes khpulse{0%,100%{box-shadow:0 6px 16px rgba(210,138,45,.4)}50%{box-shadow:0 6px 26px rgba(210,138,45,.75)}}',
    '@media (prefers-reduced-motion:reduce){.kh-audio-card *,.kh-audio-card *::before,.kh-audio-card *::after{animation:none!important;transition:none!important}}',
    '@media print{.kh-audio-review-controls,.kh-audio-review-gate{display:none!important}}',
    '@media(max-width:720px){.kh-speech-grid{grid-template-columns:minmax(0,1fr)}}',
    '@media(max-width:600px){.kh-audio-review-controls{padding:12px;border-radius:16px}.kh-audio-player{grid-template-columns:minmax(0,1fr)}.kh-audio-review-btn.play{width:100%}.kh-audio-actions .kh-audio-review-btn{flex:1 1 100%}.kh-audio-progress-row{grid-template-columns:minmax(0,1fr)}}'
  ].join('');
  document.head.appendChild(style);
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
      var note = document.createElement('p'); note.className = 'kh-audio-review-gate';
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
