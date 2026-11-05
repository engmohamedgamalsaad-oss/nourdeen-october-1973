/* أدوات مراجعة واعتماد الصوت داخل المعاينة (draft=1 فقط) — التجربة الأولى: science/magdi-yacoub.
   - لا تظهر للزائر: الملف لا يعمل إلا مع ?draft=1، ومخفية عند الطباعة.
   - القرارات تُحفظ في story_meta.audio_review (مفتاحها هاش المقطع، لا رقمه).
   - تقرأ الصوت المنشور فقط (assets/audio) لتحديد الجاهز؛ لا تولّد ولا تكتب أي ملفات. */
(function () {
'use strict';
var qs = new URLSearchParams(location.search);
if (qs.get('draft') !== '1') return;

var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
var PILOT = { section: 'science', slug: 'magdi-yacoub', story: '../stories/science/015/story.json', audio: '../assets/audio/science/magdi-yacoub/' };
var VOICES = { karma: '592625f68416462f8b6161ddf5fdbffb', narrator: 'a02a8220d6014812aa5ff73434c54cc0' };
var GEN = 'audio-review/v1';

function $(id) { return document.getElementById(id); }
function norm(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

var pkg = readJSON('kh-story-review-package');
if (!pkg || pkg.section !== PILOT.section || pkg.slug !== PILOT.slug || !pkg.i18n) return;
var storyId = pkg.section + '/' + pkg.slug;

var S = { ready: false, clips: {}, review: { clips: {}, regen: {} }, q: Promise.resolve(), ctx: null, open: {}, playing: null, error: '' };

function getCtx() {
  var c = readJSON('kh-story-review-context') || readJSON('kh-story-preview-context') || readJSON('kh-story-preview-draft');
  var id = qs.get('submission'), tb = qs.get('table');
  if (id && (!c || String(c.submission_id) !== String(id))) c = { submission_id: id, submission_table: tb };
  if (!c || !c.submission_id) return null;
  return { id: c.submission_id, table: c.submission_table === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions' };
}

async function adminToken() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('kh_adm_session') || sessionStorage.getItem('kh_adm_session') || 'null'); } catch (e) {}
  if (!s || !s.access_token) throw new Error('سجّل الدخول إلى لوحة الإدارة على هذا الجهاز ثم أعد فتح المعاينة منها.');
  if (s.expires_at && s.expires_at - Date.now() / 1000 < 60 && s.refresh_token) {
    var rr = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!rr.ok) throw new Error('انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.');
    var rd = await rr.json();
    s = { access_token: rd.access_token, refresh_token: rd.refresh_token, expires_at: Math.floor(Date.now() / 1000) + rd.expires_in };
    try { localStorage.setItem('kh_adm_session', JSON.stringify(s)); sessionStorage.setItem('kh_adm_session', JSON.stringify(s)); } catch (e) {}
  }
  return s.access_token;
}

function rowUrl() { return SUPA + '/rest/v1/' + S.ctx.table + '?id=eq.' + encodeURIComponent(S.ctx.id); }

async function loadReview() {
  var t = await adminToken();
  var r = await fetch(rowUrl() + '&select=story_meta', { headers: { apikey: KEY, Authorization: 'Bearer ' + t }, cache: 'no-store' });
  if (!r.ok) throw new Error('تعذرت قراءة قرارات الصوت (' + r.status + ').');
  var rows = await r.json();
  var ar = rows[0] && rows[0].story_meta && rows[0].story_meta.audio_review;
  S.review = { clips: Object.assign({}, ar && ar.clips), regen: Object.assign({}, ar && ar.regen) };
}

/* كتابة متسلسلة: قراءة جديدة ثم تعديل audio_review فقط ثم تحقق بعد الحفظ. */
function persist(mutator, check) {
  var run = function () { return doPersist(mutator, check); };
  S.q = S.q.then(run, run);
  return S.q;
}
async function doPersist(mutator, check) {
  var t = await adminToken(), h = { apikey: KEY, Authorization: 'Bearer ' + t }, u = rowUrl();
  var r = await fetch(u + '&select=id,story_meta', { headers: h, cache: 'no-store' });
  if (!r.ok) throw new Error('تعذرت قراءة السجل (' + r.status + ').');
  var rows = await r.json();
  if (!rows.length) throw new Error('لم يُعثر على سجل الحكاية.');
  var meta = Object.assign({}, rows[0].story_meta || {});
  var ar = Object.assign({ version: 1 }, meta.audio_review || {});
  ar.clips = Object.assign({}, ar.clips);
  ar.regen = Object.assign({}, ar.regen);
  mutator(ar);
  meta.audio_review = ar;
  var w = await fetch(u, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, h), body: JSON.stringify({ story_meta: meta }) });
  if (!w.ok) throw new Error('تعذر حفظ القرار (' + w.status + ').');
  var saved = await w.json();
  if (!saved.length) throw new Error('لم يؤكد الخادم حفظ القرار.');
  var v = await fetch(u + '&select=story_meta', { headers: h, cache: 'no-store' });
  if (!v.ok) throw new Error('تم الحفظ لكن تعذر التحقق (' + v.status + ').');
  var back = ((await v.json())[0] || {}).story_meta;
  var got = back && back.audio_review;
  if (!got || !check(got)) throw new Error('فشل التحقق من حفظ القرار.');
  S.review = { clips: Object.assign({}, got.clips), regen: Object.assign({}, got.regen) };
}

async function sha(str) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

function spokenText(b) { return norm((b.heading ? b.heading + '. ' : '') + (b.text || '')); }

async function head(url) {
  try { var r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch (e) { return false; }
}

async function build() {
  var pub = null;
  try { var pr = await fetch(new URL(PILOT.story, location.href).href, { cache: 'no-store' }); if (pr.ok) pub = await pr.json(); } catch (e) {}
  for (var li = 0; li < LANGS.length; li++) {
    var lang = LANGS[li], t = pkg.i18n[lang];
    if (!t || !Array.isArray(t.blocks)) { S.clips[lang] = []; continue; }
    var manifest = null;
    try { var mr = await fetch(new URL(PILOT.audio + lang + '/manifest.json', location.href).href, { cache: 'no-store' }); if (mr.ok) manifest = await mr.json(); } catch (e) {}
    var segsByBlock = {};
    ((manifest && manifest.segments) || []).forEach(function (s) { (segsByBlock[s.block_index] = segsByBlock[s.block_index] || []).push(s); });
    var pubBlocks = (pub && pub.i18n && pub.i18n[lang] && pub.i18n[lang].blocks) || [];
    var used = {};
    var list = [];
    for (var i = 0; i < t.blocks.length; i++) {
      var b = t.blocks[i], speaker = b.speaker === 'karma' ? 'karma' : 'narrator', text = spokenText(b);
      var match = -1;
      for (var j = 0; j < pubBlocks.length; j++) {
        if (!used[j] && (pubBlocks[j].speaker === 'karma' ? 'karma' : 'narrator') === speaker && spokenText(pubBlocks[j]) === text) { match = j; break; }
      }
      var segs = match >= 0 ? (segsByBlock[match] || []).slice().sort(function (a, c) { return (a.chunk_index || 0) - (c.chunk_index || 0); }) : [];
      if (match >= 0 && segs.length) used[match] = true;
      var voice = lang === 'ar' ? VOICES[speaker] : 'edge-tts', provider = lang === 'ar' ? 'fish-audio:s2.1-pro-free' : 'edge-tts';
      var base = await sha(JSON.stringify([storyId, lang, speaker, voice, provider, text, GEN]));
      var regen = S.review.regen && S.review.regen[base] || 0;
      var key = await sha(base + '|' + regen);
      var status = 'pending', srcs = [];
      if (segs.length) {
        var okVoice = lang !== 'ar' || segs.every(function (s) { return s.voice === VOICES[speaker]; });
        srcs = segs.map(function (s) { return new URL(PILOT.audio + lang + '/' + s.src + '?v=' + encodeURIComponent(String(s.hash || '1')), location.href).href; });
        var oks = await Promise.all(srcs.map(head));
        status = okVoice && oks.every(Boolean) ? 'ready' : 'error';
      }
      list.push({ lang: lang, index: i, speaker: speaker, text: text, key: key, srcs: srcs, status: status });
    }
    S.clips[lang] = list;
  }
}

/* ---------- واجهة ---------- */
var style = document.createElement('style');
style.textContent = '.kh-ar-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(128,128,128,.4);font:600 12px Cairo,Arial,sans-serif}' +
  '.kh-ar-tools button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit;min-height:30px}' +
  '.kh-ar-tools button:disabled{opacity:.45;cursor:not-allowed}' +
  '.kh-ar-tools .kh-ar-ok.on{background:#1f9d55;border-color:#1f9d55;color:#fff}' +
  '.kh-ar-tools .kh-ar-bad.on{background:#d23b3b;border-color:#d23b3b;color:#fff}' +
  '.kh-ar-st{padding:3px 8px;border-radius:999px;border:1px solid currentColor}' +
  '.kh-ar-st.ready{color:#1f9d55}.kh-ar-st.pending{color:#d99a1b}.kh-ar-st.error{color:#d23b3b}' +
  '.kh-ar-form{flex:1 1 100%;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid rgba(210,59,59,.6);border-radius:10px}' +
  '.kh-ar-form label{display:flex;gap:6px;align-items:center;font-weight:600}' +
  '.kh-ar-form textarea{width:100%;min-height:56px;box-sizing:border-box;padding:6px;border-radius:8px;border:1px solid rgba(128,128,128,.6);background:transparent;color:inherit;font:13px Cairo,Arial,sans-serif}' +
  '.kh-ar-msg{flex:1 1 100%;color:#d23b3b}' +
  '@media print{.kh-ar-tools{display:none!important}}';
document.head.appendChild(style);

function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function curLang() { var l = document.documentElement.lang || 'ar'; return LANGS.indexOf(l) >= 0 ? l : 'ar'; }
function decision(c) { var d = S.review.clips[c.key]; return d && d.status; }

function renderTools(card, c) {
  var box = card.querySelector(':scope > .kh-ar-tools');
  if (box) box.remove();
  box = el('div', 'kh-ar-tools');
  box.dir = 'rtl';
  var label = { ready: '✓ تم تحميل الصوت', pending: '⏳ قيد التجهيز', error: '⚠ خطأ في الصوت' }[c.status];
  box.appendChild(el('span', 'kh-ar-st ' + c.status, S.ready ? label : '… جارٍ فحص الصوت'));
  if (c.status === 'ready') {
    var pl = el('button', '', S.playing === c.key ? '■ إيقاف' : '▶ استماع');
    pl.type = 'button';
    pl.addEventListener('click', function () { play(c); });
    box.appendChild(pl);
  }
  var d = decision(c);
  var ok = el('button', 'kh-ar-ok' + (d === 'accepted' ? ' on' : ''), 'قبول صوت المقطع');
  ok.type = 'button';
  ok.disabled = !S.ready || c.status !== 'ready';
  ok.addEventListener('click', function () { save(c, 'accepted', '', ''); });
  var bad = el('button', 'kh-ar-bad' + (d === 'rejected' ? ' on' : ''), 'رفض المقطع');
  bad.type = 'button';
  bad.disabled = !S.ready;
  bad.addEventListener('click', function () { S.open[c.key] = !S.open[c.key]; refresh(); });
  box.append(ok, bad);
  if (S.open[c.key]) {
    var prev = S.review.clips[c.key] || {};
    var form = el('div', 'kh-ar-form');
    var r1 = el('label'), a = document.createElement('input'); a.type = 'radio'; a.name = 'kh-iss-' + c.key; a.value = 'text'; a.checked = prev.issue_type !== 'audio_only';
    r1.append(a, el('span', '', 'أ) المشكلة في النص أو النطق — يُعاد صياغة المقطع'));
    var r2 = el('label'), b = document.createElement('input'); b.type = 'radio'; b.name = 'kh-iss-' + c.key; b.value = 'audio_only'; b.checked = prev.issue_type === 'audio_only';
    r2.append(b, el('span', '', 'ب) النص صحيح والمشكلة في الصوت فقط — يُعاد توليد الصوت'));
    var ta = document.createElement('textarea'); ta.maxLength = 1000; ta.placeholder = 'ملاحظتك على المشكلة (الكلمة أو الجملة وما الخطأ)'; ta.value = prev.note || '';
    var go = el('button', '', 'حفظ الرفض'); go.type = 'button';
    go.addEventListener('click', function () { save(c, 'rejected', a.checked ? 'text' : 'audio_only', ta.value.trim()); });
    form.append(r1, r2, ta, go);
    box.appendChild(form);
  }
  if (S.error && S.errorKey === c.key) box.appendChild(el('div', 'kh-ar-msg', S.error));
  card.appendChild(box);
}

function refresh() {
  var cards = document.querySelectorAll('#blocks > .block'), list = S.clips[curLang()] || [];
  for (var i = 0; i < cards.length; i++) if (list[i]) renderTools(cards[i], list[i]);
}

var player = new Audio();
function play(c) {
  if (S.playing === c.key) { player.pause(); S.playing = null; refresh(); return; }
  S.playing = c.key;
  var i = 0;
  function next() {
    if (S.playing !== c.key) return;
    if (i >= c.srcs.length) { S.playing = null; refresh(); return; }
    player.src = c.srcs[i++];
    player.onended = next;
    player.onerror = function () { S.playing = null; c.status = 'error'; refresh(); };
    var p = player.play();
    if (p && p.catch) p.catch(function () { S.playing = null; c.status = 'error'; refresh(); });
  }
  next();
  refresh();
}

function save(c, status, issue, note) {
  if (status === 'rejected' && !note && issue !== 'audio_only') { S.error = 'اكتب ملاحظتك على المشكلة قبل حفظ الرفض.'; S.errorKey = c.key; refresh(); return; }
  S.error = ''; S.errorKey = null;
  var entry = { key: c.key, story_id: storyId, lang: c.lang, block_index: c.index, speaker: c.speaker, text: c.text, status: status, issue_type: status === 'rejected' ? issue : '', note: status === 'rejected' ? note : '', reviewed_at: new Date().toISOString() };
  persist(function (ar) { ar.clips[c.key] = entry; }, function (ar) { var d = ar.clips[c.key]; return d && d.status === status; })
    .then(function () { S.open[c.key] = false; refresh(); })
    .catch(function (e) { S.error = 'لم يُحفظ القرار: ' + (e && e.message || 'خطأ'); S.errorKey = c.key; refresh(); });
}

function inject() { refresh(); }

var blocksHost = $('blocks');
if (blocksHost) new MutationObserver(function () { inject(); }).observe(blocksHost, { childList: true });

/* ---------- شرط اعتماد المعاينة ---------- */
function summary() {
  var s = { total: 0, notReady: 0, unreviewed: 0, rejected: 0 };
  LANGS.forEach(function (l) {
    (S.clips[l] || []).forEach(function (c) {
      s.total++;
      if (c.status !== 'ready') s.notReady++;
      var d = decision(c);
      if (d === 'rejected') s.rejected++; else if (d !== 'accepted') s.unreviewed++;
    });
  });
  return s;
}
document.addEventListener('click', function (ev) {
  var t = ev.target && ev.target.closest && ev.target.closest('#kh-preview-approve');
  if (!t) return;
  var msg = '', s = summary();
  if (!S.ready) msg = 'جارٍ فحص حالة الصوت. انتظر قليلًا ثم أعد المحاولة.';
  else if (!S.ctx) msg = '';
  else if (!s.total || s.notReady || s.rejected || s.unreviewed) msg = 'لا يمكن اعتماد المعاينة: ' + s.notReady + ' مقطع صوته غير مكتمل، ' + s.rejected + ' مرفوض، ' + s.unreviewed + ' لم تتم مراجعته (من ' + s.total + ' في اللغات الخمس).';
  if (!msg) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  var st = $('kh-preview-decision-status');
  if (st) { st.textContent = msg; st.style.color = '#ffb8b8'; }
}, true);

/* ---------- تشغيل ---------- */
S.ctx = getCtx();
(async function () {
  try {
    if (S.ctx) await loadReview();
    await build();
    S.ready = true;
  } catch (e) {
    S.error = 'تعذر تجهيز مراجعة الصوت: ' + (e && e.message || 'خطأ');
    S.errorKey = null;
    S.ready = false;
    var st = $('kh-preview-decision-status');
    if (st) { st.textContent = S.error; st.style.color = '#ffb8b8'; }
  }
  refresh();
})();
})();
