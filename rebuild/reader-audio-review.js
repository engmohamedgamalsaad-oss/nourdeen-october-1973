/* rebuild/reader-audio-review.js
   أدوات مراجعة الصوت الصغيرة بجوار كل مقطع داخل المعاينة (draft=1 فقط، حكاية التجربة الأولى فقط).
   لا تغيّر تصميم الحكاية: تضيف سطر أدوات صغيرًا داخل بطاقة المقطع نفسها. لا تظهر للزائر لأن الملف لا يعمل إلا مع draft=1.
   الحفظ: story_meta.audio_review في نفس سجل الحكاية (نفس جلسة الأدمن ونفس مسار preview_review). */
(function () {
'use strict';
var params = new URLSearchParams(location.search);
if (params.get('draft') !== '1') return;
var Core = window.KHAudioReviewCore;
if (!Core) return;
var pkg = null;
try { pkg = JSON.parse(localStorage.getItem('kh-story-review-package') || 'null'); } catch (e) {}
var info = Core.pilotInfo(pkg);
if (!info) return;

var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var ROOT = new URL('../', document.currentScript ? document.currentScript.src : location.href);
var STORY_ID = Core.pilotKey(pkg);
var ctx = null, review = Core.emptyReview(), loaded = null, queue = Promise.resolve();
var published = null;           // { story, pron }
var manifests = {};             // lang -> Promise<manifest|null>
var entriesCache = {};          // lang -> Promise<entries>
var readyCache = {};            // key -> Promise<'ready'|'pending'|'error'>

function getCtx() {
  try { ctx = JSON.parse(localStorage.getItem('kh-story-review-context') || 'null'); } catch (e) { ctx = null; }
  var id = params.get('submission'), tb = params.get('table');
  if (id && (!ctx || String(ctx.submission_id) !== String(id))) ctx = { submission_id: id, submission_table: tb === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions' };
  return ctx && ctx.submission_id ? ctx : null;
}
async function token() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('kh_adm_session') || sessionStorage.getItem('kh_adm_session') || 'null'); } catch (e) {}
  if (!s || !s.access_token) throw new Error('سجّل الدخول إلى لوحة الإدارة على هذا الجهاز ثم أعد فتح المعاينة.');
  if (s.expires_at && s.expires_at - Date.now() / 1000 < 60 && s.refresh_token) {
    var rr = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!rr.ok) throw new Error('انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.');
    var rd = await rr.json();
    s = { access_token: rd.access_token, refresh_token: rd.refresh_token, expires_at: Math.floor(Date.now() / 1000) + rd.expires_in };
    try { localStorage.setItem('kh_adm_session', JSON.stringify(s)); sessionStorage.setItem('kh_adm_session', JSON.stringify(s)); } catch (e) {}
  }
  return s.access_token;
}
function rowUrl() { var c = getCtx(); if (!c) throw new Error('لا يوجد سجل مرتبط بهذه المعاينة. افتحها من لوحة الإدارة.'); return SUPA + '/rest/v1/' + (c.submission_table === 'submitted_stories' ? 'submitted_stories' : 'khaledoon_submissions') + '?id=eq.' + encodeURIComponent(c.submission_id); }
async function readRow() {
  var t = await token(), r = await fetch(rowUrl() + '&select=id,status,story_meta', { headers: { apikey: KEY, Authorization: 'Bearer ' + t }, cache: 'no-store' });
  if (!r.ok) throw new Error('تعذرت قراءة سجل الحكاية (' + r.status + ').');
  var rows = await r.json();
  if (!rows.length) throw new Error('لم يُعثر على سجل الحكاية.');
  return rows[0];
}
function load() {
  if (!loaded) loaded = readRow().then(function (row) { review = Core.cloneReview(row.story_meta && row.story_meta.audio_review); return review; });
  return loaded;
}
/* كتابة مسلسلة: قراءة طازجة ← تعديل مقطع واحد ← PATCH ← تحقق بعد الحفظ */
function persist(mutator, check) {
  var run = queue.then(async function () {
    var t = await token(), row = await readRow(), meta = Object.assign({}, row.story_meta || {});
    meta.audio_review = mutator(Core.cloneReview(meta.audio_review));
    var h = { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    var save = await fetch(rowUrl(), { method: 'PATCH', headers: h, body: JSON.stringify({ story_meta: meta }) });
    if (!save.ok) throw new Error('تعذر حفظ المراجعة (' + save.status + ').');
    var saved = await save.json();
    if (!saved.length || !check(saved[0].story_meta && saved[0].story_meta.audio_review)) throw new Error('لم يؤكد الخادم حفظ المراجعة.');
    var v = await readRow();
    if (!check(v.story_meta && v.story_meta.audio_review)) throw new Error('فشل التحقق النهائي من حفظ المراجعة.');
    review = Core.cloneReview(v.story_meta.audio_review);
    return review;
  });
  queue = run.catch(function () {});
  return run;
}

/* ---------- الصوت المنشور (مرجع القاعدة): مطابقة نص المقطع بنص الحكاية المنشورة ---------- */
function getPublished() {
  if (!published) published = Promise.all([
    fetch(new URL(info.story_json, ROOT), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch(new URL(info.pronunciation, ROOT), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (a) { return { story: a[0], pron: a[1] }; });
  return published;
}
function getManifest(lang) {
  if (!manifests[lang]) manifests[lang] = fetch(new URL('assets/audio/' + pkg.section + '/' + pkg.slug + '/' + lang + '/manifest.json', ROOT), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  return manifests[lang];
}
/* يعيد { spoken, urls[] } للمقطع إن وُجد منشورًا بنفس النص، وإلا spoken=النص المعروض و urls=[] */
async function publishedMatch(lang, block) {
  var p = await getPublished(), m = await getManifest(lang), out = { spoken: block.text, urls: [] };
  var pb = p.story && p.story.i18n && p.story.i18n[lang] && p.story.i18n[lang].blocks;
  if (!pb) return out;
  var want = Core.strip(block.text), idx = -1;
  for (var i = 0; i < pb.length; i++) { if (Core.strip(pb[i].text) === want && pb[i].speaker === block.speaker) { idx = i; break; } }
  if (idx < 0) return out;
  if (lang === 'ar' && p.pron && p.pron.blocks && p.pron.blocks[String(idx)]) out.spoken = p.pron.blocks[String(idx)];
  if (m && Array.isArray(m.segments)) {
    var segs = m.segments.filter(function (s) { return s.block_index === idx; }).sort(function (a, b) { return (a.chunk_index || 0) - (b.chunk_index || 0); });
    var base = new URL('assets/audio/' + pkg.section + '/' + pkg.slug + '/' + lang + '/', ROOT);
    out.urls = segs.map(function (s) { return new URL(s.src + '?v=' + encodeURIComponent(String(s.hash || '')), base).href; });
  }
  return out;
}
function probe(url) {
  return new Promise(function (res) {
    var a = new Audio(), done = false;
    function end(v) { if (!done) { done = true; a.removeAttribute('src'); res(v); } }
    a.preload = 'metadata';
    a.onloadedmetadata = function () { end(isFinite(a.duration) && a.duration > 0); };
    a.onerror = function () { end(false); };
    setTimeout(function () { end(false); }, 10000);
    a.src = url;
  });
}
async function entriesFor(lang) {
  if (!entriesCache[lang]) entriesCache[lang] = (async function () {
    await load();
    var blocks = (pkg.i18n && pkg.i18n[lang] && pkg.i18n[lang].blocks) || [], out = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], speaker = b.speaker === 'karma' ? 'karma' : 'narrator', pm = await publishedMatch(lang, b);
      var base = await Core.baseKey(STORY_ID, lang, speaker, pm.spoken), key = await Core.clipKey(base, review.regen[base] || 0);
      var state = 'pending';
      if (pm.urls.length && !review.regen[base]) {
        var oks = await Promise.all(pm.urls.map(probe));
        state = oks.every(Boolean) ? 'ready' : 'error';
      }
      out.push({ story_id: STORY_ID, lang: lang, block_index: i, speaker: speaker, text: b.text, base: base, key: key, state: state, urls: pm.urls });
    }
    return out;
  })();
  return entriesCache[lang];
}

/* ---------- شرط اعتماد المعاينة (كل اللغات) ---------- */
async function gate() {
  try {
    await load();
    loaded = null; await load();           // قراءة طازجة من الخادم قبل الحكم
    var all = [], ready = {};
    for (var i = 0; i < Core.LANGS.length; i++) { var es = await entriesFor(Core.LANGS[i]); es.forEach(function (e) { all.push(e); ready[e.key] = e.state; }); }
    var g = Core.evaluateGate(all, review, ready);
    g.message = Core.gateMessage(g);
    return g;
  } catch (e) { return { ok: false, message: 'تعذر التحقق من مراجعة الصوت: ' + (e && e.message || e) + ' — لم يُعتمد.' }; }
}
window.KHAudioReview = { gate: gate };

/* ---------- الواجهة ---------- */
var css = document.createElement('style');
css.textContent = '.kh-ar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(128,128,128,.35);font:600 12px/1.4 Cairo,Arial,sans-serif;direction:rtl}'
 + '.kh-ar button{font:700 12px Cairo,Arial,sans-serif;padding:5px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer}'
 + '.kh-ar button:disabled{opacity:.45;cursor:not-allowed}'
 + '.kh-ar .kh-ar-st{padding:3px 8px;border-radius:999px;border:1px solid currentColor}'
 + '.kh-ar[data-st=ready] .kh-ar-st{color:#1f9d55}.kh-ar[data-st=pending] .kh-ar-st{color:#d98a00}.kh-ar[data-st=error] .kh-ar-st{color:#d63a3a}'
 + '.kh-ar .kh-ar-ok.on{background:#1f9d55;border-color:#1f9d55;color:#fff}.kh-ar .kh-ar-no.on{background:#d63a3a;border-color:#d63a3a;color:#fff}'
 + '.kh-ar-form{flex:1 1 100%;display:flex;flex-direction:column;gap:6px}.kh-ar-form[hidden]{display:none}.kh-ar-form select,.kh-ar-form textarea{font:600 13px Cairo,Arial,sans-serif;padding:6px;border-radius:8px;border:1px solid rgba(128,128,128,.5);background:rgba(0,0,0,.15);color:inherit}.kh-ar-form textarea{min-height:56px}'
 + '.kh-ar-msg{flex:1 1 100%;font-weight:600}@media print{.kh-ar{display:none!important}}';
document.head.appendChild(css);

var player = null;
function playUrls(urls, btn) {
  if (player) { try { player.pause(); } catch (e) {} player = null; }
  var i = 0;
  (function next() { if (i >= urls.length) { btn.textContent = '▶ استماع'; return; } player = new Audio(urls[i++]); player.onended = next; player.onerror = function () { btn.textContent = '▶ استماع'; }; btn.textContent = '■ إيقاف'; player.play().catch(function () { btn.textContent = '▶ استماع'; }); })();
}
function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function buildTools(entry) {
  var box = mk('div', 'kh-ar'); box.dataset.st = entry.state;
  var st = mk('span', 'kh-ar-st', entry.state === 'ready' ? '✓ تم تحميل الصوت' : entry.state === 'error' ? '✗ خطأ في الصوت' : '⏳ قيد التجهيز');
  var play = mk('button', '', '▶ استماع'); play.type = 'button'; play.disabled = entry.state !== 'ready';
  var ok = mk('button', 'kh-ar-ok', 'قبول صوت المقطع'); ok.type = 'button';
  var no = mk('button', 'kh-ar-no', 'رفض المقطع'); no.type = 'button';
  var form = mk('div', 'kh-ar-form'); form.hidden = true;
  var sel = mk('select'); [['text', '(أ) المشكلة في النص أو النطق'], ['audio_only', '(ب) النص صحيح والمشكلة في الصوت فقط']].forEach(function (o) { var x = mk('option', '', o[1]); x.value = o[0]; sel.appendChild(x); });
  var note = mk('textarea'); note.placeholder = 'اكتب المشكلة التي سمعتها في هذا المقطع'; note.maxLength = 1000;
  var row = mk('div'), save = mk('button', 'kh-ar-no on', 'حفظ الرفض'), cancel = mk('button', '', 'إلغاء'); save.type = 'button'; cancel.type = 'button'; row.append(save, cancel); form.append(sel, note, row);
  var msg = mk('span', 'kh-ar-msg'); msg.setAttribute('role', 'status');
  box.append(st, play, ok, no, form, msg);
  function paint() {
    var c = review.clips[entry.key];
    ok.classList.toggle('on', !!c && c.status === 'accepted');
    no.classList.toggle('on', !!c && c.status === 'rejected');
    ok.disabled = entry.state !== 'ready';
    if (c && c.status === 'rejected') { sel.value = c.issue || 'text'; note.value = c.note || ''; }
  }
  function busy(on) { [ok, no, save, cancel].forEach(function (b) { b.disabled = on || (b === ok && entry.state !== 'ready'); }); }
  function say(t, bad) { msg.textContent = t; msg.style.color = bad ? '#d63a3a' : '#1f9d55'; }
  async function decide(decision) {
    busy(true); say('جارٍ الحفظ والتحقق…');
    try {
      await persist(function (r) { return Core.applyDecision(r, entry, decision); }, function (r) { var c = r && r.clips && r.clips[entry.key]; return !!c && c.status === decision.status; });
      say(decision.status === 'accepted' ? 'تم تسجيل قبول صوت المقطع.' : 'تم تسجيل الاعتراض مع الملاحظة.'); form.hidden = true;
    } catch (e) { say(e && e.message || 'تعذر الحفظ', true); }
    busy(false); paint();
  }
  play.addEventListener('click', function () { if (player && !player.paused) { player.pause(); player = null; play.textContent = '▶ استماع'; } else playUrls(entry.urls, play); });
  ok.addEventListener('click', function () { if (entry.state === 'ready') decide({ status: 'accepted' }); });
  no.addEventListener('click', function () { form.hidden = !form.hidden; if (!form.hidden) note.focus(); });
  cancel.addEventListener('click', function () { form.hidden = true; });
  save.addEventListener('click', function () { if (!note.value.trim()) { say('اكتب ملاحظة تصف المشكلة قبل تسجيل الرفض.', true); note.focus(); return; } decide({ status: 'rejected', note: note.value.trim(), issue: sel.value }); });
  paint();
  return box;
}

var rendering = 0;
async function render() {
  var run = ++rendering, lang = document.documentElement.lang || 'ar';
  var cards = document.querySelectorAll('#blocks > .block');
  if (!cards.length) return;
  try {
    var es = await entriesFor(lang);
    if (run !== rendering) return;
    cards.forEach(function (card, i) {
      var old = card.querySelector(':scope > .kh-ar'); if (old) old.remove();
      if (es[i]) card.appendChild(buildTools(es[i]));
    });
  } catch (e) {
    cards.forEach(function (card) { if (card.querySelector(':scope > .kh-ar')) return; var b = mk('div', 'kh-ar'); b.dataset.st = 'error'; b.appendChild(mk('span', 'kh-ar-st', 'تعذر تحميل أدوات مراجعة الصوت: ' + (e && e.message || e))); card.appendChild(b); });
  }
}
var timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(render, 60); }
var host = document.getElementById('blocks');
if (host) { new MutationObserver(schedule).observe(host, { childList: true }); schedule(); }
document.addEventListener('site-language-change', schedule);
})();
