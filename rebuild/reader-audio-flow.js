/* خالدون — ترتيب صفحة معاينة الصوت وإظهار حالة التوليد.
   طبقة إضافية فوق reader-audio-review.js: لا تغيّر منطقه ولا أزراره ولا الحفظ، بل:
   1) ترتّب كل مقطع في أربع خطوات منفصلة قابلة للطي، لكل خطوة بياناتها: النص ← نص القراءة (Gemini) ← التوليد ← المعاينة والاعتماد؛
   2) تجعل شرائح الحالة الأربع أزرارًا تفتح الخطوة المقابلة، وتضع التفاصيل الثانوية (ملاحظات Gemini، تفاصيل الطلب، نتيجة مدقق النطق) في طبقات مطوية؛
   3) تعرض حالة التوليد الحقيقية من الطابور (لم يُرسل / في الطابور / بيتم الآن / تم / فشل) وتحدّثها تلقائيًا؛
   4) تطوي المقاطع غير الحالية، وتنقل شريط الملخص والنشر إلى آخر الصفحة بعد النصوص. */
(function () {
  'use strict';
  if (window.__khAudioFlow) return;
  window.__khAudioFlow = true;

  var SCRIPT_SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  var STEPS_CSS = 'reader-audio-steps.css?v=20261114-steps-1';
  var SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn'; /* publishable key، نفس المستخدم في الصفحة */
  var SPEAKERS = { karma: 'كارما', narrator: 'الراوي' };
  var ICONS = { done: '✅', wait: '⏳', busy: '🔄', fail: '❌', warn: '✋', todo: '⬜', na: '—' };
  var JOB_STATUS = { pending: 'في الطابور', processing: 'قيد التوليد', completed: 'مكتمل', failed: 'فشل' };

  var jobs = {}, previousJobs = {}, openMemo = {}, stepMemo = {}, subMemo = {}, topOpen = false, timer = null, polling = false, queueError = '', queueKnown = false;

  function $(id) { return document.getElementById(id); }
  function story() { return window.__KH_STORY_PACKAGE || null; }
  function lang() { return document.documentElement.lang || 'ar'; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function direct(parent, selector) { return Array.prototype.filter.call(parent.children, function (n) { return n.matches(selector); }); }
  function blockIndexOf(block, position) { var n = Number(block.dataset.blockIndex); return Number.isInteger(n) && block.dataset.blockIndex !== '' ? n : position; }
  function translationGate(st, language) {
    var core = window.KHAudioReviewCore;
    if (!core || typeof core.validateTranslationAlignment !== 'function') return { ok: false, reason: 'تعذر تحميل مدقق ارتباط الترجمة بالمصدر العربي.' };
    return core.validateTranslationAlignment(st, language);
  }
  function boxKey(box) { return lang() + ':' + box.dataset.index; }
  function stepKey(box, n) { return boxKey(box) + ':' + n; }

  /* تنسيقات الخطوات في ملف مستقل بوسم إصدار خاص به، فلا تتأثر بذاكرة المتصفح لملف التنسيق القديم. */
  function loadStepStyles() {
    if ($('kh-audio-steps-css')) return;
    var link = document.createElement('link');
    link.id = 'kh-audio-steps-css'; link.rel = 'stylesheet';
    try { link.href = new URL(STEPS_CSS, SCRIPT_SRC).href; } catch (e) { link.href = STEPS_CSS; }
    document.head.appendChild(link);
  }

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
    var s3;
    if (!job) s3 = hasCard ? { s: 'done', t: 'تم سابقًا' } : (queueKnown ? { s: 'todo', t: 'لم يُرسل' } : { s: 'todo', t: 'الحالة غير معروفة' });
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
    if (!job) return queueKnown ? 'لم يُرسل هذا المقطع للتوليد بعد.' : 'تعذر معرفة حالة التوليد الآن (سجّل الدخول من لوحة الإدارة أو حدّث الصفحة).';
    var age = ageText(job);
    if (job.status === 'pending') return 'المقطع في الطابور بانتظار اتصال Colab' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'processing') return 'Colab يولّد الصوت الآن' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'completed') return 'اكتمل التوليد' + (age ? ' (' + age + ')' : '') + '.';
    if (job.status === 'failed') return 'فشل التوليد: ' + String(job.last_error || 'سبب غير معروف').slice(0, 160);
    return 'الحالة: ' + job.status;
  }
  function kv(k, v) {
    var row = el('div', 'kh-kv');
    row.appendChild(el('span', 'kh-kv-k', k));
    row.appendChild(el('span', 'kh-kv-v', v));
    return row;
  }
  /* بيانات طلب التوليد الخاصة بالخطوة ٣ (تُملأ من الطابور وتتحدث مع كل متابعة) */
  function fillJobData(box) {
    var node = box.querySelector('.kh-job-data');
    if (!node) return;
    var job = jobOf(Number(box.dataset.index));
    node.replaceChildren();
    if (!job) { node.appendChild(el('p', 'kh-muted', 'لا يوجد طلب توليد لهذا المقطع في الطابور.')); return; }
    node.appendChild(kv('الحالة', JOB_STATUS[job.status] || String(job.status || '—')));
    node.appendChild(kv('المحاولات', String(job.attempts == null ? 0 : job.attempts)));
    node.appendChild(kv('آخر تحديث', ageText(job) || '—'));
    node.appendChild(kv('آخر خطأ', job.last_error ? String(job.last_error).slice(0, 300) : '—'));
    node.appendChild(kv('رقم الطلب', job.id ? String(job.id).slice(0, 8) : '—'));
  }
  function openStep(box, n) {
    box.open = true; openMemo[boxKey(box)] = true;
    var step = box.querySelector(':scope > .kh-flow-body > .kh-step[data-step="' + n + '"]');
    if (!step) return;
    step.open = true; stepMemo[stepKey(box, n)] = true;
    try { step.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }
  function paint(box) {
    var chips = chipStates(box), bar = box.querySelector(':scope > summary .kh-flowbar');
    if (bar) {
      bar.replaceChildren();
      chips.forEach(function (c) {
        var li = el('li', 'kh-chip-item');
        var b = el('button', 'kh-chip'); b.type = 'button'; b.dataset.state = c.s; b.dataset.step = String(c.n);
        b.title = 'افتح خطوة «' + c.label + '»';
        b.appendChild(el('span', 'kh-chip-ico', ICONS[c.s] || ''));
        var tx = el('span', 'kh-chip-txt'); tx.appendChild(el('b', '', c.n + '. ' + c.label)); tx.appendChild(el('small', '', c.t)); b.appendChild(tx);
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openStep(box, c.n); });
        li.appendChild(b); bar.appendChild(li);
      });
    }
    var any = chips.some(function (c) { return c.s === 'fail'; }), all = chips.every(function (c) { return c.s === 'done' || c.s === 'na'; });
    box.dataset.state = any ? 'fail' : (all ? 'done' : 'open');
    if (any && !box.open && openMemo[boxKey(box)] === undefined) box.open = true; /* الفشل يُفتح تلقائيًا ما لم تغلقه بنفسك */
    Array.prototype.forEach.call(box.querySelectorAll(':scope > .kh-flow-body > .kh-step'), function (d) {
      var c = chips[Number(d.dataset.step) - 1];
      if (!c) return;
      d.dataset.state = c.s;
      var st = d.querySelector(':scope > summary .kh-step-state');
      if (st) st.textContent = (ICONS[c.s] || '') + ' ' + c.t;
      if (c.s === 'fail' && stepMemo[stepKey(box, c.n)] === undefined && !d.open) d.open = true;
    });
    var note = box.querySelector('.kh-gen-note'); if (note) note.textContent = genNote(box);
    fillJobData(box);
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
  function updateTopSummary() {
    var top = $('kh-flow-top'); if (!top) return;
    var pill = document.querySelector('#kh-audio-review-gate .kh-gate-pill');
    var sp = top.querySelector('.kh-top-pill'); if (sp) sp.textContent = pill ? pill.textContent : '';
    var banner = $('kh-audio-review-gate');
    top.dataset.state = banner ? (banner.dataset.state || '') : '';
  }
  /* طبقة ثانوية مطوية داخل خطوة (تتذكر حالة فتحها بين إعادة البناء) */
  function makeSub(box, name, title) {
    var key = boxKey(box) + ':sub:' + name;
    var d = el('details', 'kh-sub');
    d.open = !!subMemo[key];
    d.appendChild(el('summary', '', title));
    d.addEventListener('toggle', function () { subMemo[key] = d.open; });
    return d;
  }
  /* خطوة مستقلة: رأس فيه الرقم والاسم والحالة، وجسم فيه بياناتها وحدها */
  function makeStep(box, n, label) {
    var d = el('details', 'kh-step'); d.dataset.step = String(n);
    var s = el('summary', 'kh-step-summary');
    s.appendChild(el('span', 'kh-step-num', String(n)));
    s.appendChild(el('span', 'kh-step-label', label));
    s.appendChild(el('span', 'kh-step-state', ''));
    d.appendChild(s);
    var body = el('div', 'kh-step-body'); d.appendChild(body);
    s.addEventListener('click', function () { setTimeout(function () { stepMemo[stepKey(box, n)] = d.open; }, 0); });
    return { d: d, body: body };
  }
  function layerSpeechPanel(box, panel) {
    var notes = panel.querySelector('.kh-speech-notes');
    if (notes && notes.children.length) {
      var sub = makeSub(box, 'gemini-notes', '📝 ملاحظات Gemini والتنبيهات (' + notes.children.length + ')');
      notes.parentNode.insertBefore(sub, notes);
      sub.appendChild(notes);
    }
    var hint = panel.querySelector('.kh-flow');
    if (hint) {
      var hintSub = makeSub(box, 'speech-hint', 'ℹ️ كيف تعمل هذه الخطوة؟');
      hint.parentNode.insertBefore(hintSub, hint);
      hintSub.appendChild(hint);
    }
  }
  function layerAudioCard(box, card) {
    var asr = card.querySelector('.kh-audio-asr-result');
    if (!asr) return;
    var sub = makeSub(box, 'asr:' + (card.dataset.clipKey || ''), '🔎 نتيجة مدقق النطق');
    asr.parentNode.insertBefore(sub, asr);
    sub.appendChild(asr);
  }
  function rebuild() {
    var host = $('blocks'); if (!host) return;
    loadStepStyles();
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
    var localeGate = translationGate(st, L);
    var currentTranslationStale = L !== 'ar' && !localeGate.ok && (!Array.isArray(localeGate.staleBlocks) || localeGate.staleBlocks.indexOf(current) >= 0);
    sb.forEach(function (b, i) { if (b && b.speaker === 'karma') karma.push(i); else if (b && b.speaker === 'narrator') narrator.push(i); });
    var order = karma.concat(narrator).sort(function (a, b) { return a - b; }), current = -1;
    for (var k = 0; k < order.length; k++) { var rec = byIndex[order[k]]; if (!rec || !rec.accepted) { current = order[k]; break; } }
    var genButton = gp && gp.querySelector('button:not(.kh-audio-publish-button)');
    var genStatus = gp && gp.querySelector('.kh-audio-review-state');
    if (currentTranslationStale && genButton) { genButton.disabled = true; genButton.title = localeGate.reason; }
    else if (genButton) { genButton.disabled = false; genButton.removeAttribute('title'); }
    info.forEach(function (rec) {
      if (!rec.panels.length && (L !== 'ar' && L !== 'en')) return;
      var local = sb[rec.index], speaker = local && local.speaker;
      var box = el('details', 'kh-flow-box'); box.dataset.index = String(rec.index);
      var sum = el('summary', 'kh-flow-summary');
      sum.appendChild(el('span', 'kh-flow-title', 'مقطع ' + (rec.index + 1) + (SPEAKERS[speaker] ? ' · ' + SPEAKERS[speaker] : '')));
      sum.appendChild(el('ol', 'kh-flowbar'));
      box.appendChild(sum);
      var body = el('div', 'kh-flow-body');
      var speech = rec.panels.filter(function (p) { return p.classList.contains('kh-speech-text-controls'); });
      var cards = rec.panels.filter(function (p) { return p.classList.contains('kh-audio-card'); });
      var engine = rec.panels.filter(function (p) { return p.classList.contains('kh-engine-controls'); });
      var other = rec.panels.filter(function (p) { return speech.indexOf(p) < 0 && cards.indexOf(p) < 0 && engine.indexOf(p) < 0; });
      /* بطاقة الصوت قد تكون موضوعة داخل لوحة نص القراءة (مقطع ٥ من ابن سينا)؛ نُخرجها إلى خطوة المعاينة */
      speech.forEach(function (sp) { direct(sp, '.kh-audio-card').forEach(function (c) { cards.unshift(c); }); });
      var followText = '';
      speech.forEach(function (sp) { var ta = sp.querySelector('textarea'); if (!followText && ta && String(ta.value || '').trim()) followText = String(ta.value).trim(); });

      /* ① النص */
      var step1 = makeStep(box, 1, 'النص');
      var original = local && typeof local.text === 'string' ? local.text : '';
      step1.body.appendChild(kv('المتحدث', SPEAKERS[speaker] || '—'));
      step1.body.appendChild(kv('عدد الحروف', String(original.length)));
      step1.body.appendChild(el('p', 'kh-orig-text', original || 'لا يوجد نص لهذا المقطع.'));
      body.appendChild(step1.d);

      /* ② نص القراءة (Gemini) */
      var step2 = makeStep(box, 2, 'نص القراءة (Gemini)');
      if (speech.length) {
        speech.forEach(function (p) { layerSpeechPanel(box, p); step2.body.appendChild(p); });
      } else {
        step2.body.appendChild(el('p', 'kh-muted', L === 'ar' ? 'هذا المقطع لا يحتاج نص قراءة منفصلًا.' : 'لا يلزم نص قراءة منفصل لهذه اللغة؛ يُولَّد الصوت من نص الحكاية.'));
      }
      body.appendChild(step2.d);

      /* ③ التوليد */
      if (L === 'ar' || L === 'en') {
        var step3 = makeStep(box, 3, 'التوليد');
        step3.body.appendChild(el('p', 'kh-gen-note', currentTranslationStale ? localeGate.reason : ''));
        if (rec.index === current && genButton) {
          var row = el('div', 'kh-gen-row'); row.appendChild(genButton); if (genStatus) row.appendChild(genStatus); step3.body.appendChild(row);
        }
        engine.forEach(function (p) { step3.body.appendChild(p); });
        var jobSub = makeSub(box, 'job', '⚙️ تفاصيل طلب التوليد');
        jobSub.appendChild(el('div', 'kh-job-data'));
        step3.body.appendChild(jobSub);
        var reload = el('button', 'kh-gen-reload', 'حدّث الصفحة لتسمع المقطع'); reload.type = 'button'; reload.hidden = true;
        reload.addEventListener('click', function () { location.reload(); });
        step3.body.appendChild(reload);
        body.appendChild(step3.d);
      }

      /* ④ المعاينة والاعتماد */
      var step4 = makeStep(box, 4, 'المعاينة والاعتماد');
      if (cards.length && followText) {
        step4.body.appendChild(el('div', 'kh-follow-label', 'نص القراءة — تابعه أثناء الاستماع'));
        step4.body.appendChild(el('p', 'kh-follow-text', followText));
      }
      cards.forEach(function (p) { layerAudioCard(box, p); step4.body.appendChild(p); });
      other.forEach(function (p) { step4.body.appendChild(p); });
      if (!cards.length && !other.length) step4.body.appendChild(el('p', 'kh-muted', 'لا يوجد صوت لهذا المقطع بعد. أرسله من خطوة التوليد، وسيظهر هنا بعد اكتماله.'));
      body.appendChild(step4.d);

      box.appendChild(body);
      rec.block.appendChild(box);
      var memoKey = boxKey(box);
      paint(box);
      box.open = openMemo[memoKey] !== undefined ? openMemo[memoKey] : (rec.index === current || box.dataset.state === 'fail');
      sum.addEventListener('click', function () { setTimeout(function () { openMemo[memoKey] = box.open; }, 0); });
      /* أي خطوة تُفتح تلقائيًا؟ أول خطوة فاشلة، وإلا أول خطوة لم تكتمل. وما فتحته أو أغلقته بنفسك يبقى كما هو. */
      var chips = chipStates(box), focus = 0, i;
      for (i = 1; i < chips.length && !focus; i++) if (chips[i].s === 'fail') focus = i + 1;
      for (i = 1; i < chips.length && !focus; i++) if (chips[i].s !== 'done' && chips[i].s !== 'na') focus = i + 1;
      Array.prototype.forEach.call(body.children, function (stepEl) {
        var n = Number(stepEl.dataset.step), mk = stepKey(box, n);
        stepEl.open = stepMemo[mk] !== undefined ? stepMemo[mk] : n === focus;
      });
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
