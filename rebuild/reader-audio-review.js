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
  var token = await adminToken();
  canWrite = true;
  var res = await fetch(rowUrl() + '&select=*', { headers: { apikey: KEY, Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!res.ok) throw new Error('تعذرت قراءة سجل المراجعة (' + res.status + ').');
  var rows = await res.json();
  if (!rows.length) throw new Error('لم يتم العثور على سجل الحكاية.');
  row = rows[0];
  var meta = row.story_meta || {};
  review = core.cloneReview(meta.audio_review || (meta.pending_draft && meta.pending_draft.story_meta && meta.pending_draft.story_meta.audio_review) || null);
  return true;
}
async function saveReview(next, key) {
  if (busy) return;
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
    if (!verified || !verified.clips || !verified.clips[key] || verified.clips[key].status !== next.clips[key].status) {
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
async function loadManifests() {
  manifests = {}; manifestErrors = {}; entries = []; readyByKey = {}; played = {}; acceptButtons = {}; manifestLoadFailure = false;
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
        if (!expected || !engineOk || typeof seg.src !== 'string' || !/^[A-Za-z0-9_-]+\\.mp3$/.test(seg.src) || typeof seg.text !== 'string' || !seg.text.trim()) {
          throw new Error('مقطع صوتي لا يطابق المتحدث أو مزوّد/صوت اللغة المعتمد.');
        }
      });
      var localized = story.i18n && story.i18n[lang];
      var coverage = core.validateManifestCoverage(localized && localized.blocks, data.segments);
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
        var base = await core.baseKey(storyKey, lang, seg.speaker, seg.text, { voice: seg.voice, provider: seg.provider, model: seg.model });
        var entry = { story_id: story.section + '/' + story.slug, lang: lang, block_index: blockIndex, chunk_index: chunkIndex,
          speaker: seg.speaker, base: base, text: seg.text, src: seg.src, manifest: manifest, segment: seg };
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
  return core.evaluateFiveLanguageGate(manifests, entries, review, readyByKey);
}
function gateSummary() {
  var g = gate();
  if (g.loading) return 'جارٍ تحميل وفحص ملفات الصوت؛ لن يتاح اعتماد المعاينة قبل اكتمال الفحص.';
  if (g.loadError) return 'تعذر التحقق من ملفات الصوت بسبب خطأ تحميل أو بيانات غير صالحة. لا يمكن اعتماد المعاينة قبل إعادة المحاولة والتحقق.';
  if (g.missingLanguages) return 'مراجعة الصوت غير مكتملة: ملفات الصوت غير جاهزة للغات ' + g.missingLanguages.map(function (l) { return LANG_NAMES[l]; }).join('، ') + '.';
  if (g.ok) return 'تم قبول كل المقاطع الصوتية (' + g.accepted + '/' + g.total + ').';
  return core.gateMessage(g) + ' المقبول: ' + g.accepted + '/' + g.total + '.';
}
function canApprove() { return gate().ok; }
window.KHStoryAudioReview = { canApprove: canApprove, gateSummary: gateSummary, gate: gate };
function play(entry, button) {
  if (!entry || !entry.src) return;
  played[entry.key] = false;
  if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true;
  var control = button.closest('.kh-audio-review-controls');
  var stateNode = control && control.querySelector('.kh-audio-review-state');
  if (stateNode) stateNode.textContent = 'جارٍ الاستماع إلى المقطع…';
  if (!audio) audio = new Audio();
  try { audio.pause(); audio.currentTime = 0; } catch (e) {}
  var url = new URL(entry.src + '?v=' + encodeURIComponent(String(entry.segment.hash || entry.manifest.generated_at || entry.manifest.version)), manifestUrl(entry.lang));
  audio.src = url.href;
  var old = document.querySelector('.kh-audio-review-playing');
  if (old) old.classList.remove('kh-audio-review-playing');
  button.classList.add('kh-audio-review-playing');
  var p = audio.play();
  if (p && p.catch) p.catch(function () { button.classList.remove('kh-audio-review-playing'); });
  audio.onended = function () { button.classList.remove('kh-audio-review-playing'); played[entry.key] = true; if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = false; if (stateNode) stateNode.textContent = 'اكتمل الاستماع — يمكنك قبول المقطع أو رفضه.'; };
  audio.onerror = function () { button.classList.remove('kh-audio-review-playing'); played[entry.key] = false; if (acceptButtons[entry.key]) acceptButtons[entry.key].disabled = true; if (stateNode) stateNode.textContent = 'تعذر تشغيل المقطع؛ لم يتم تسجيل الاستماع.'; };
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
  if (!manifests[lang]) return;
  if (activeLang !== lang) activeLang = lang;
  var manifest = manifests[lang], host = $('blocks');
  if (!host) return;
  var blocks = Array.prototype.slice.call(host.querySelectorAll(':scope > .block'));
  blocks.forEach(function (block) { var old = block.querySelector(':scope > .kh-audio-review-controls'); if (old) old.remove(); });
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
      var next = core.applyDecision(review, entry, { status: 'accepted' });
      state.textContent = 'جارٍ الحفظ…';
      try { await saveReview(next, entry.key); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
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
      var next = core.applyDecision(review, entry, { status: 'rejected', note: note.value, suggestion: suggestion.value, issue: issue.value });
      state.textContent = 'جارٍ حفظ الرفض…';
      try { await saveReview(next, entry.key); } catch (e) { state.textContent = 'تعذر الحفظ: ' + (e.message || e); }
    });
    editor.append(issue, note, suggestion, saveReject);
    panel.append(playBtn, acceptBtn, rejectBtn, state, editor);
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
    '@media print{.kh-audio-review-controls,.kh-audio-review-gate{display:none!important}}',
    '@media(max-width:600px){.kh-audio-review-controls{gap:5px;padding:7px}.kh-audio-review-btn{padding:5px 7px}.kh-audio-review-state{flex-basis:100%;margin:0}}'
  ].join('');
  document.head.appendChild(style);
}
async function initialize(nextStory) {
  if (!nextStory || !nextStory.slug || initializing || initialized) return;
  initializing = true;
  story = nextStory;
  injectStyles();
  try {
    await loadRow();
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