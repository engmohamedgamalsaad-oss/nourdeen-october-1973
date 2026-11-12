/* خالدون — ترتيب صفحة معاينة الصوت وإظهار حالة التوليد.
   طبقة إضافية فوق reader-audio-review.js: لا تغيّر منطقه ولا أزراره ولا الحفظ، بل:
   1) ترتّب كل مقطع: النص ← نص القراءة (Gemini) ← التوليد ← المعاينة والاعتماد، مع شريط حالة بأربع خطوات؛
   2) تعرض حالة التوليد الحقيقية من الطابور (لم يُرسل / في الطابور / بيتم الآن / تم / فشل) وتحدّثها تلقائيًا؛
   3) تطوي المقاطع غير الحالية، وتنقل شريط الملخص والنشر إلى آخر الصفحة بعد النصوص. */
(function () {
  'use strict';
  if (window.__khAudioFlow) return;
  window.__khAudioFlow = true;

  var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn'; /* publishable key، نفس المستخدم في الصفحة */
  var SPEAKERS = { karma: 'كارما', narrator: 'الراوي' };
  var ICONS = { done: '✅', wait: '⏳', busy: '🔄', fail: '❌', warn: '✋', todo: '⬜', na: '—' };

  var st0 = document.createElement('style');
  st0.textContent = '.kh-flow-order{margin:14px 0;padding:13px 15px;border:1px solid rgba(194,157,93,.45);border-radius:14px;background:rgba(194,157,93,.08)}' +
    '.kh-order-title{display:block;margin-bottom:6px;color:#d8b878}.kh-order-line{margin:4px 0;line-height:1.7}.kh-order-hint{margin:8px 0 0;opacity:.85;font-size:.88rem;line-height:1.6}' +
    '.kh-order-go{margin-top:6px;padding:8px 14px;border:1px solid rgba(194,157,93,.7);border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer}' +
    '.kh-flow-box[data-locked="1"]>summary .kh-flow-title{opacity:.75}';
  document.head.appendChild(st0);

  var jobs = {}, previousJobs = {}, openMemo = {}, topOpen = false, timer = null, polling = false, queueError = '', queueKnown = false, currentIndex = -1, currentSpeaker = '';

  function $(id) { return document.getElementById(id); }
  function story() { return window.__KH_STORY_PACKAGE || null; }
  function lang() { return document.documentElement.lang || 'ar'; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function direct(parent, selector) { return Array.prototype.filter.call(parent.children, function (n) { return n.matches(selector); }); }
  function blockIndexOf(block, position) { var n = Number(block.dataset.blockIndex); return Number.isInteger(n) && block.dataset.blockIndex !== '' ? n : position; }

  /* ---------- حالة الطابور (من الخادم، لا من تخمين الواجهة) ---------- */
  function token() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem('kh_adm_session') || sessionStorage.getItem('kh_adm_session') || 'null'); } catch (e) {}
    if (!s || !s.access_token) return '';
    if (Number(s.expires_at || 0) - Date.now() / 1000 < 20) return ''; /* التجديد تتولاه الصفحة الأساسية في طلباتها */
    return s.access_token;
  }
  function fetchJobs() {
    var st = story(), t = token();
    if (!st || !t || (lang() !== 'ar' && lang() !== 'en')) return Promise.resolve(false);
    return fetch(SUPA + '/functions/v1/audio-review-assets', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'queue_status', section: st.section, slug: st.slug, language: lang() }),
      cache: 'no-store'
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; }, function () { return { ok: r.ok, d: null }; });
    }).then(function (x) {
      if (!x.ok || !x.d || !Array.isArray(x.d.jobs)) { queueError = (x.d && x.d.error) || 'تعذر قراءة حالة الطابور.'; return false; }
      var map = {};
      x.d.jobs.forEach(function (j) { /* الأحدث أولًا */
        if (!j || j.language !== lang()) return;
        var k = String(j.block_index);
        if (!map[k]) map[k] = j;
      });
      previousJobs = jobs; jobs = map; queueError = ''; queueKnown = true;
      return true;
    }).catch(function (e) { queueError = String(e && e.message || e); return false; });
  }
  function jobOf(index) { return jobs[String(index)] || null; }
  function ageText(job) {
    var t = Date.parse(job && (job.updated_at || job.created_at));
    if (!t) return '';
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? 'الآن' : (m < 60 ? 'من ' + m + ' دقيقة' : 'من ' + Math.round(m / 60) + ' ساعة');
  }
  function activeJobs() {
    return Object.keys(jobs).some(function (k) { return jobs[k].status === 'pending' || jobs[k].status === 'processing'; });
  }

  /* ---------- حالات الخطوات الأربع لمقطع ---------- */
  function isLocked(box) { return box.dataset.locked === '1'; }
  function chipStates(box) {
    var index = Number(box.dataset.index), L = lang();
    var speech = box.querySelector('.kh-speech-text-controls');
    var cards = box.querySelectorAll('.kh-audio-card[data-review]');
    var job = jobOf(index), hasCard = box.querySelectorAll('.kh-audio-card[data-clip-key]').length > 0;
    var s2;
    if (L !== 'ar') s2 = { s: 'na', t: 'لا يلزم' };
    else {
      var st = speech ? speech.dataset.status : '';
      s2 = st === 'approved' ? { s: 'done', t: 'معتمد' } : st === 'suggested' ? { s: 'warn', t: 'بانتظار اعتمادك' } : { s: 'todo', t: 'لم يُجهّز' };
    }
    var locked = isLocked(box) && !job && !hasCard && !(speech && speech.dataset.status === 'approved');
    if (locked && L === 'ar') s2 = { s: 'todo', t: 'مقفول — بعد اعتماد مقطع ' + (currentIndex + 1) };
    var s3;
    if (locked) s3 = { s: 'todo', t: 'مقفول' };
    else if (!job) s3 = hasCard ? { s: 'done', t: 'تم سابقًا' } : (queueKnown ? { s: 'todo', t: 'لم يُرسل' } : { s: 'todo', t: 'الحالة غير معروفة' });
    else if (job.status === 'pending') s3 = { s: 'wait', t: 'في الطابور' };
    else if (job.status === 'processing') s3 = { s: 'busy', t: 'بيتم الآن' };
    else if (job.status === 'completed') s3 = { s: 'done', t: hasCard ? 'تم' : 'تم — حدّث الصفحة' };
    else if (job.status === 'failed') s3 = { s: 'fail', t: 'فشل' };
    else s3 = { s: 'todo', t: String(job.status || '—') };
    var s4;
    if (!cards.length) s4 = { s: 'todo', t: 'لا يوجد صوت بعد' };
    else {
      var vals = Array.prototype.map.call(cards, function (c) { return c.dataset.review; });
      s4 = vals.indexOf('rejected') >= 0 ? { s: 'fail', t: 'مرفوض' } : vals.every(function (v) { return v === 'accepted'; }) ? { s: 'done', t: 'معتمد' } : { s: 'warn', t: 'استمع واعتمد' };
    }
    return [{ n: 1, label: 'النص', s: 'done', t: 'جاهز' }, { n: 2, label: 'نص القراءة', s: s2.s, t: s2.t }, { n: 3, label: 'التوليد', s: s3.s, t: s3.t }, { n: 4, label: 'المعاينة', s: s4.s, t: s4.t }];
  }
  function genNote(box) {
    var job = jobOf(Number(box.dataset.index));
    if (isLocked(box) && !job && !box.querySelector('.kh-audio-card[data-clip-key]')) {
      return 'مقفول حاليًا. الترتيب: كل مقاطع كارما أولًا ثم الراوي، والمقطع الحالي هو مقطع ' + (currentIndex + 1) + (currentSpeaker ? ' · ' + currentSpeaker : '') + '. يُفتح هذا المقطع بعد اعتماد صوت المقاطع التي قبله في هذا الترتيب.';
    }
    if (!job) return queueKnown ? 'لم يُرسل هذا المقطع للتوليد بعد.' : 'تعذر معرفة حالة التوليد الآن (سجّل الدخول من لوحة الإدارة أو حدّث الصفحة).';
    var age = ageText(job);
    if (job.status === 'pending') return 'المقطع في الطابور بانتظار اتصال Colab' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'processing') return 'Colab يولّد الصوت الآن' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'completed') return 'اكتمل التوليد' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'failed') return 'فشل التوليد: ' + String(job.last_error || 'سبب غير معروف').slice(0, 160);
    return 'الحالة: ' + job.status;
  }
  function paint(box) {
    var chips = chipStates(box), bar = box.querySelector(':scope > summary .kh-flowbar');
    if (bar) {
      bar.replaceChildren();
      chips.forEach(function (c) {
        var li = el('li', 'kh-chip'); li.dataset.state = c.s;
        li.appendChild(el('span', 'kh-chip-ico', ICONS[c.s] || '')); 
        var tx = el('span', 'kh-chip-txt'); tx.appendChild(el('b', '', c.n + '. ' + c.label)); tx.appendChild(el('small', '', c.t)); li.appendChild(tx);
        bar.appendChild(li);
      });
    }
    var any = chips.some(function (c) { return c.s === 'fail'; }), all = chips.every(function (c) { return c.s === 'done' || c.s === 'na'; });
    box.dataset.state = any ? 'fail' : (all ? 'done' : 'open');
    if (any && !box.open && openMemo[lang() + ':' + box.dataset.index] === undefined) box.open = true; /* الفشل يُفتح تلقائيًا ما لم تغلقه بنفسك */
    var note = box.querySelector('.kh-gen-note'); if (note) note.textContent = genNote(box);
    var reload = box.querySelector('.kh-gen-reload');
    var job = jobOf(Number(box.dataset.index));
    if (reload) reload.hidden = !(job && job.status === 'completed' && !box.querySelector('.kh-audio-card'));
  }
  function refresh() {
    Array.prototype.forEach.call(document.querySelectorAll('.kh-flow-box'), paint);
    var err = $('kh-flow-queue-error');
    if (err) { err.hidden = !queueError; err.textContent = queueError ? 'تعذر قراءة حالة الطابور: ' + queueError : ''; }
    updateTopSummary();
  }

  /* ---------- بناء الترتيب ---------- */
  function ensureTop(host) {
    var banner = $('kh-audio-review-gate'), importer = $('kh-audio-asr-import');
    if (!banner && !importer) return;
    var top = $('kh-flow-top');
    if (!top) {
      top = el('details', 'kh-top-box'); top.id = 'kh-flow-top';
      var sum = el('summary', 'kh-top-summary'); sum.appendChild(el('span', 'kh-top-title', '🎧 ملخص المراجعة والنشر'));
      sum.appendChild(el('span', 'kh-top-pill', '')); top.appendChild(sum);
      var body = el('div', 'kh-top-body'); top.appendChild(body);
      var err = el('p', 'kh-flow-error'); err.id = 'kh-flow-queue-error'; err.hidden = true; body.appendChild(err);
      sum.addEventListener('click', function () { setTimeout(function () { topOpen = top.open; }, 0); });
      host.insertAdjacentElement('afterend', top);
    }
    var tbody = top.querySelector('.kh-top-body');
    if (banner && banner.parentNode !== tbody) tbody.appendChild(banner);
    if (importer && importer.parentNode !== tbody) tbody.appendChild(importer);
    top.open = topOpen;
  }
  function goCurrent() {
    var box = document.querySelector('.kh-flow-box[data-index="' + currentIndex + '"]');
    if (!box) return;
    box.open = true; openMemo[lang() + ':' + currentIndex] = true;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderOrderNote(host, karma, narrator) {
    var L = lang(), note = $('kh-flow-order');
    if (L !== 'ar' && L !== 'en') { if (note) note.remove(); return; }
    if (!note) { note = el('section', 'kh-flow-order'); note.id = 'kh-flow-order'; host.insertAdjacentElement('beforebegin', note); }
    note.replaceChildren();
    note.appendChild(el('strong', 'kh-order-title', 'ترتيب العمل على الصوت'));
    function nums(list) { return list.map(function (i) { return i + 1; }).join('، ') || '—'; }
    note.appendChild(el('p', 'kh-order-line', 'كارما أولًا: مقاطع ' + nums(karma) + '. ثم الراوي: مقاطع ' + nums(narrator) + '.'));
    if (currentIndex < 0) {
      note.appendChild(el('p', 'kh-order-line', '✅ اكتمل اعتماد صوت كل المقاطع.'));
    } else {
      note.appendChild(el('p', 'kh-order-line', 'المقطع الحالي: مقطع ' + (currentIndex + 1) + (currentSpeaker ? ' · ' + currentSpeaker : '') + '.'));
      var go = el('button', 'kh-order-go', 'انتقل للمقطع الحالي'); go.type = 'button'; go.addEventListener('click', goCurrent); note.appendChild(go);
    }
    note.appendChild(el('p', 'kh-order-hint', 'المقطع يُحسب معتمدًا لما تعتمد صوته في الخطوة 4، وليس نص القراءة وحده. وبعدها يُفتح المقطع التالي في الترتيب.'));
  }
  function updateTopSummary() {
    var top = $('kh-flow-top'); if (!top) return;
    var pill = document.querySelector('#kh-audio-review-gate .kh-gate-pill');
    var sp = top.querySelector('.kh-top-pill'); if (sp) sp.textContent = pill ? pill.textContent : '';
    var banner = $('kh-audio-review-gate');
    top.dataset.state = banner ? (banner.dataset.state || '') : '';
  }
  function rebuild() {
    var host = $('blocks'); if (!host) return;
    var L = lang(), st = story();
    var blocks = direct(host, '.block');
    var gp = document.querySelector('.kh-audio-generation-controls');
    blocks.forEach(function (b) { var old = b.querySelector(':scope > .kh-flow-box'); if (old) old.remove(); });
    var info = blocks.map(function (b, pos) {
      var panels = direct(b, '.kh-audio-review-controls');
      var cards = panels.filter(function (p) { return p.classList.contains('kh-audio-card'); });
      var accepted = cards.length > 0 && cards.every(function (c) { return c.dataset.review === 'accepted'; });
      return { block: b, index: blockIndexOf(b, pos), panels: panels, accepted: accepted };
    });
    var byIndex = {}; info.forEach(function (i) { byIndex[i.index] = i; });
    var sb = st && st.i18n && st.i18n[L] && st.i18n[L].blocks || [], karma = [], narrator = [];
    sb.forEach(function (b, i) { if (b && b.speaker === 'karma') karma.push(i); else if (b && b.speaker === 'narrator') narrator.push(i); });
    var order = karma.concat(narrator), current = -1;
    for (var k = 0; k < order.length; k++) { var rec = byIndex[order[k]]; if (!rec || !rec.accepted) { current = order[k]; break; } }
    currentIndex = current;
    var curLocal = current >= 0 ? sb[current] : null;
    currentSpeaker = curLocal && SPEAKERS[curLocal.speaker] ? SPEAKERS[curLocal.speaker] : '';
    renderOrderNote(host, karma, narrator);
    var genButton = gp && gp.querySelector('button:not(.kh-audio-publish-button)');
    var genStatus = gp && gp.querySelector('.kh-audio-review-state');
    info.forEach(function (rec) {
      if (!rec.panels.length && (L !== 'ar' && L !== 'en')) return;
      var local = sb[rec.index], speaker = local && local.speaker;
      var box = el('details', 'kh-flow-box'); box.dataset.index = String(rec.index);
      if (current >= 0 && rec.index !== current && !rec.accepted) box.dataset.locked = '1';
      var sum = el('summary', 'kh-flow-summary');
      sum.appendChild(el('span', 'kh-flow-title', 'مقطع ' + (rec.index + 1) + (SPEAKERS[speaker] ? ' · ' + SPEAKERS[speaker] : '')));
      sum.appendChild(el('ol', 'kh-flowbar'));
      box.appendChild(sum);
      var body = el('div', 'kh-flow-body');
      var speech = rec.panels.filter(function (p) { return p.classList.contains('kh-speech-text-controls'); });
      var cards = rec.panels.filter(function (p) { return p.classList.contains('kh-audio-card'); });
      var other = rec.panels.filter(function (p) { return speech.indexOf(p) < 0 && cards.indexOf(p) < 0; });
      speech.forEach(function (p) { body.appendChild(p); });
      if (L === 'ar' || L === 'en') {
        var gen = el('section', 'kh-gen-step');
        gen.appendChild(el('strong', 'kh-gen-head', '③ التوليد'));
        gen.appendChild(el('p', 'kh-gen-note', ''));
        if (rec.index === current && genButton) {
          var row = el('div', 'kh-gen-row'); row.appendChild(genButton); if (genStatus) row.appendChild(genStatus); gen.appendChild(row);
        }
        var reload = el('button', 'kh-gen-reload', 'حدّث الصفحة لتسمع المقطع'); reload.type = 'button'; reload.hidden = true;
        reload.addEventListener('click', function () { location.reload(); });
        gen.appendChild(reload);
        body.appendChild(gen);
      }
      cards.forEach(function (p) { body.appendChild(p); });
      other.forEach(function (p) { body.appendChild(p); });
      box.appendChild(body);
      rec.block.appendChild(box);
      var memoKey = L + ':' + rec.index;
      paint(box);
      box.open = openMemo[memoKey] !== undefined ? openMemo[memoKey] : (rec.index === current || box.dataset.state === 'fail');
      sum.addEventListener('click', function () { setTimeout(function () { openMemo[memoKey] = box.open; }, 0); });
    });
    ensureTop(host);
    refresh();
  }

  /* ---------- متابعة الطابور ---------- */
  function schedule() {
    clearTimeout(timer);
    var delay = document.hidden ? 20000 : (activeJobs() ? 5000 : 30000);
    timer = setTimeout(poll, delay);
  }
  function poll() {
    if (polling) return;
    polling = true;
    fetchJobs().then(function () { refresh(); }).then(function () { polling = false; schedule(); }, function () { polling = false; schedule(); });
  }
  var rebuildQueued = false;
  function onUpdated() {
    if (rebuildQueued) return;
    rebuildQueued = true;
    Promise.resolve().then(function () {
      rebuildQueued = false;
      rebuild();
      fetchJobs().then(function () { refresh(); schedule(); });
    });
  }
  document.addEventListener('kh-audio-review-updated', onUpdated);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(timer); poll(); } });
  if ($('kh-audio-review-gate')) onUpdated();
})();
