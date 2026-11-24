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

  var jobs = {}, previousJobs = {}, openMemo = {}, stepMemo = {}, subMemo = {}, topOpen = true, timer = null, polling = false, queueError = '', queueKnown = false, workerOnline = null, workerLastSeen = null, workerError = '';

  function $(id) { return document.getElementById(id); }
  function story() { return window.__KH_STORY_PACKAGE || null; }
  function lang() { return window.__KH_AUDIO_REVIEW_LANGUAGE || document.documentElement.lang || 'ar'; }
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

  var translationRecords = {};
  var translationWorkingText = Object.create(null);
  var translationConfirmed = Object.create(null);
  var translationStates = Object.create(null);
  var translationLoaded = false;
  function storyIdentity(st) {
    return { section: st && st.section, slug: st && st.slug };
  }
  function translationStorySnapshot(st) {
    if (!st || !st.i18n) return null;
    var blocks = {};
    ['ar', 'en', 'fr', 'it', 'de'].forEach(function (language) {
      var localized = st.i18n[language];
      if (!localized || !Array.isArray(localized.blocks)) return;
      blocks[language] = localized.blocks.map(function (block) {
        return {
          speaker: block && typeof block.speaker === 'string' ? block.speaker : '',
          text: block && typeof block.text === 'string' ? block.text : ''
        };
      });
    });
    return { section: st.section, slug: st.slug, blocks: blocks };
  }
  async function audioReviewAction(payload) {
    var st = story(), t = token(), identity = storyIdentity(st);
    if (!st || !identity.section || !identity.slug || !t) throw new Error("سجّل الدخول من لوحة الإدارة وافتح معاينة الحكاية من جديد.");
    var response = await fetch(SUPA + "/functions/v1/audio-review-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + t },
      body: JSON.stringify(Object.assign({
        section: identity.section, slug: identity.slug, language: lang(), story_snapshot: translationStorySnapshot(st),
      }, payload)),
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.success) throw new Error(data.error || "تعذر تنفيذ إجراء الترجمة.");
    return data;
  }
  async function sha256Trim(value) {
    var digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value == null ? "" : value).trim()));
    return Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function renderTranslationOnPage(index, text) {
    var st = story(), L = lang();
    if (!st || L === "ar" || !st.i18n || !st.i18n[L] || !Array.isArray(st.i18n[L].blocks)) return;
    var localized = st.i18n[L].blocks[index];
    if (localized) localized.text = String(text || "");
    var pageBlock = document.querySelector('#blocks .block[data-block-index="' + index + '"]');
    if (!pageBlock) return;
    var value = String(text || "");
    if (pageBlock.dataset.type === "timeline") {
      var list = pageBlock.querySelector("ol");
      if (!list) return;
      list.replaceChildren();
      value.split("\n").forEach(function (line) {
        var cut = line.indexOf(" — "), item = document.createElement("li");
        var year = document.createElement("b"), event = document.createElement("span");
        year.textContent = cut > 0 ? line.slice(0, cut) : "";
        event.textContent = cut > 0 ? line.slice(cut + 3) : line;
        item.append(year, event);
        list.appendChild(item);
      });
    } else {
      var paragraph = pageBlock.querySelector("p");
      if (paragraph) paragraph.textContent = value;
    }
  }

  async function restoreSavedTranslations() {
    var st = story(), L = lang();
    var arabic = st && st.i18n && st.i18n.ar && Array.isArray(st.i18n.ar.blocks) ? st.i18n.ar.blocks : [];
    var restored = 0, stale = 0;
    translationWorkingText = Object.create(null);
    translationConfirmed = Object.create(null);
    if (L === "ar") return { restored: 0, stale: 0 };
    for (var index = 0; index < arabic.length; index++) {
      var source = arabic[index];
      if (!source || !["karma", "narrator"].includes(source.speaker)) continue;
      var key = L + ":" + index, record = translationRecords[key];
      if (!record || record.status !== "approved" ||
          typeof record.translation_text !== "string" || !record.translation_text.trim()) continue;
      var hash = await sha256Trim(source.text);
      if (record.source_arabic_hash !== hash || record.speaker !== source.speaker) {
        stale++;
        continue;
      }
      translationWorkingText[key] = record.translation_text;
      translationConfirmed[key] = true;
      renderTranslationOnPage(index, record.translation_text);
      restored++;
    }
    return { restored: restored, stale: stale };
  }
  async function loadTranslations() {
    try {
      var data = await audioReviewAction({ action: "review_get" });
      translationRecords = data.audio_review && data.audio_review.translations || {};
      var result = await restoreSavedTranslations();
      translationStates = Object.create(null);
      Object.keys(translationRecords).forEach(function (key) {
        translationStates[key] = translationConfirmed[key] ? "approved" : (translationRecords[key] && translationRecords[key].status === "approved" ? "stale" : (translationRecords[key] && translationRecords[key].status || "missing"));
      });
      translationLoaded = true;
      if (result.stale) queueError = "تم تجاهل " + result.stale + " ترجمة قديمة لأن النص العربي أو المتحدث تغيّر.";
    } catch (e) {
      translationLoaded = false;
      translationRecords = {};
      translationWorkingText = Object.create(null);
      translationConfirmed = Object.create(null);
      queueError = String(e && e.message || e);
    }
  }
  // Bulk retry preserves approved translations for the exact Arabic source and speaker.
  function isCurrentApprovedTranslation(record, sourceBlock, sourceHash) {
    return !!record && record.status === 'approved' &&
      record.source_arabic_hash === sourceHash &&
      record.speaker === sourceBlock.speaker &&
      !!String(record.translation_text || '').trim();
  }
  async function runTranslationRounds(indices, translateOne, opts) {
    var maxRounds = opts.maxRounds, waitSeconds = opts.waitSeconds, sleep = opts.sleep, onWait = opts.onWait;
    var done = 0, skipped = 0, pending = indices.slice(), round = 0, stopped = false;
    while (pending.length) {
      var failedNow = [];
      for (var p = 0; p < pending.length; p++) {
        var outcome = await translateOne(pending[p], round);
        if (outcome === 'done') done++;
        else if (outcome === 'skipped') skipped++;
        else { failedNow.push(pending[p]); if (outcome === 'auth') { failedNow = failedNow.concat(pending.slice(p + 1)); stopped = true; break; } }
      }
      pending = failedNow;
      if (!pending.length || stopped || round >= maxRounds) break;
      round++;
      for (var left = waitSeconds; left > 0; left--) { onWait(pending, round, left); await sleep(1000); }
    }
    return { done: done, skipped: skipped, failed: pending, sessionLost: stopped, rounds: round };
  }
  function paintTranslationBlock(index, state, message, record) {
    var targetLanguage = arguments.length > 4 && arguments[4] || lang();
    var key = targetLanguage + ":" + index;
    if (record) {
      translationRecords[key] = record;
      translationWorkingText[key] = String(record.translation_text || "");
      translationConfirmed[key] = !!translationWorkingText[key].trim() && record.status === "approved";
      if (targetLanguage === lang()) {
        if (translationConfirmed[key]) renderTranslationOnPage(index, translationWorkingText[key]);
      }
    }
    var box = targetLanguage === lang() ? document.querySelector('.kh-flow-box[data-index="' + index + '"]') : null;
    var review = box && box.querySelector(".kh-translation-review");
    if (review) {
      var textarea = review.querySelector(".kh-translation-editor");
      var status = review.querySelector(".kh-translation-status");
      if (record && textarea) textarea.value = String(record.translation_text || "");
      if (status) {
        status.textContent = message || (state === "processing" ? "Gemini يجهّز ترجمة هذا المقطع…" : state === "failed" ? "فشلت ترجمة هذا المقطع؛ يمكنك إعادة المحاولة." : "✓ النص جاهز ومعتمد تلقائيًا.");
        status.dataset.state = state || "missing";
      }
    }
    if (box) paint(box);
    updateTranslationPublishButton();
  }
  function verifiedAudioCard(box, job) {
    var card = box && box.querySelector(".kh-audio-card[data-clip-key]");
    if (!card || !String(card.dataset.audioSha256 || "").trim()) return false;
    var expected = String(job && job.result && job.result.sha256 || "").toLowerCase();
    var actual = String(card.dataset.audioSha256 || "").toLowerCase();
    return !expected || actual === expected;
  }
  function refreshCompletedAudio() {
    var hasCompletedWithoutVerifiedCard = Object.keys(jobs).some(function (index) {
      var job = jobs[index];
      var box = document.querySelector('.kh-flow-box[data-index="' + index + '"]');
      return job && job.status === "completed" && !verifiedAudioCard(box, job);
    });
    if (!hasCompletedWithoutVerifiedCard) return Promise.resolve(false);
    var review = window.KHStoryAudioReview;
    if (!review || typeof review.refreshAudio !== "function") return Promise.resolve(false);
    return review.refreshAudio().then(function () {
      return Object.keys(jobs).some(function (index) {
        var job = jobs[index], box = document.querySelector('.kh-flow-box[data-index="' + index + '"]');
        return job && job.status === "completed" && verifiedAudioCard(box, job);
      });
    }).catch(function () { return false; });
  }

  function makeTranslationReview(box, index, arabicBlock, currentBlock) {
    var L = lang(), key = L + ":" + index;
    var record = translationRecords[key] || {};
    var wrap = el("section", "kh-translation-review");
    var status = el("p", "kh-translation-status");
    var textarea = document.createElement("textarea");
    textarea.className = "kh-translation-editor";
    textarea.rows = 5;
    textarea.value = Object.prototype.hasOwnProperty.call(translationWorkingText, key) ? translationWorkingText[key] : "";
    textarea.placeholder = "المساحة تبدأ فارغة. اضغط «إعادة الترجمة» لتجهيز ترجمة جديدة من النص العربي.";
    var buttons = el("div", "kh-translation-actions");
    var generate = el("button", "kh-translation-generate", "إعادة الترجمة");
    var save = el("button", "kh-translation-save", "حفظ تعديلي (اختياري)");
    [generate, save].forEach(function (b2) { b2.type = "button"; });
    function paintStatus() {
      var r = translationRecords[key] || {};
      if (translationStates[key] === "processing") {
        status.textContent = "Gemini يترجم هذا المقطع الآن…";
        status.dataset.state = "processing";
        save.disabled = !String(textarea.value || "").trim();
        return;
      }
      if (translationStates[key] === "failed") {
        status.textContent = "فشلت ترجمة هذا المقطع؛ يمكنك إعادة ترجمته وحده.";
        status.dataset.state = "failed";
        save.disabled = !String(textarea.value || "").trim();
        return;
      }
      status.textContent = r.status === "approved" ? (translationConfirmed[key] && String(textarea.value || "").trim() ? "✓ الترجمة الجديدة جاهزة ومطابقة للمصدر العربي" + (r.auto_approved ? " تلقائيًا" : "") : "توجد ترجمة محفوظة سابقًا؛ اضغط «إعادة الترجمة» لتجهيز ترجمة جديدة في هذه المعاينة.") :
        r.status === "draft" ? "مسودة قديمة — اضغط «إعادة الترجمة»" :
        r.status === "needs_revision" ? "تحتاج إلى إعادة ترجمة" : "لم تُجهَّز الترجمة بعد — اضغط «الترجمة»";
      status.dataset.state = translationConfirmed[key] ? (r.status || "missing") : (r.status === "approved" ? "saved-not-loaded" : (r.status || "missing"));
      save.disabled = !String(textarea.value || "").trim();
    }
    textarea.addEventListener("input", function () {
      translationWorkingText[key] = String(textarea.value || "");
      translationConfirmed[key] = false;
      paintStatus();
      updateTranslationPublishButton();
    });
    async function saveManualEdit() {
      var st = story(), ar = st && st.i18n && st.i18n.ar && st.i18n.ar.blocks && st.i18n.ar.blocks[index];
      if (!ar || !ar.text) throw new Error("النص العربي المقابل غير موجود.");
      var digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(ar.text).trim()));
      var hash = Array.from(new Uint8Array(digest), function (b3) { return b3.toString(16).padStart(2, "0"); }).join("");
      var result = await audioReviewAction({
        action: "translation_save", language: L, block_index: index, decision: "approved",
        translation_text: String(textarea.value || "").trim(), source_arabic_hash: hash,
      });
      translationRecords[key] = result.translation;
      translationStates[key] = "approved";
      translationWorkingText[key] = String(textarea.value || "").trim();
      translationConfirmed[key] = true;
      renderTranslationOnPage(index, translationWorkingText[key]);
      paintStatus();
      document.dispatchEvent(new CustomEvent("kh-audio-review-updated"));
    }
    generate.addEventListener("click", async function () {
      if (translationBatchBusy || translationSingleBusy) {
        status.textContent = "يوجد طلب ترجمة آخر قيد التنفيذ؛ انتظر اكتماله قبل بدء طلب جديد.";
        status.dataset.state = "processing";
        return;
      }
      translationSingleBusy = true;
      setTranslationGenerateControlsDisabled(true);
      generate.disabled = true; translationStates[key] = "processing"; status.textContent = "Gemini يعيد ترجمة هذا المقطع وحده من النص العربي والسياق وملاحظاتك السابقة…"; status.dataset.state = "processing";
      paint(box); updateTranslationPublishButton();
      try {
        await waitForTranslationSlot();
        var result = await audioReviewAction({ action: "translation_generate", language: L, block_index: index, force: true });
        var generatedText = String(result.translation && result.translation.translation_text || "").trim();
        if (!generatedText || !result.translation || result.translation.status !== "approved") throw new Error("لم تُحفظ ترجمة معتمدة وصالحة لهذا المقطع.");
        translationRecords[key] = result.translation;
        translationStates[key] = "approved";
        textarea.value = generatedText;
        translationWorkingText[key] = generatedText;
        translationConfirmed[key] = true;
        renderTranslationOnPage(index, generatedText);
        paintStatus(); paint(box); updateTranslationPublishButton();
        status.textContent += " — أُعيدت الترجمة واعتُمدت تلقائيًا، والصوت القديم لهذا المقطع غير صالح.";
        document.dispatchEvent(new CustomEvent("kh-audio-review-updated"));
      } catch (e) { translationStates[key] = "failed"; status.textContent = (e.message || "تعذر إعادة الترجمة.") + " — يمكنك إعادة المحاولة."; status.dataset.state = "failed"; paint(box); updateTranslationPublishButton(); }
      finally { translationSingleBusy = false; setTranslationGenerateControlsDisabled(false); generate.disabled = false; updateLanguageBatchPanel(); }
    });
    save.addEventListener("click", async function () {
      save.disabled = true;
      try { await saveManualEdit(); status.textContent = "تم حفظ تعديلك. أُبطل الصوت القديم لهذا المقطع فقط."; }
      catch (e) { status.textContent = e.message || "تعذر حفظ التعديل."; paintStatus(); }
    });
    buttons.append(generate, save);
    wrap.append(textarea, buttons, status);
    paintStatus();
    return wrap;
  }

  function paintWorkerStatus() {
    var node = $('kh-colab-worker-status');
    if (!node) return;
    node.dataset.state = workerOnline === true ? 'online' : workerOnline === false ? 'offline' : 'unknown';
    if (workerOnline === true) {
      node.textContent = 'Colab متصل — المقاطع المعتمدة ستبدأ تلقائيًا عند دخولها الطابور.';
      node.title = workerLastSeen ? 'آخر اتصال: ' + new Date(workerLastSeen).toLocaleString('ar-EG') : '';
    } else if (workerOnline === false) {
      node.textContent = 'Colab غير متصل حاليًا — المقاطع ستظل في الطابور حتى تشغيل الدفتر الموحد.';
      node.title = workerLastSeen ? 'آخر اتصال: ' + new Date(workerLastSeen).toLocaleString('ar-EG') : 'لم يسجل العامل اتصالًا حديثًا.';
    } else {
      node.textContent = workerError ? 'تعذر التحقق من اتصال Colab: ' + workerError : 'جارٍ التحقق من اتصال Colab…';
      node.title = '';
    }
  }
  function fetchWorkerStatus() {
    return fetch(SUPA + '/functions/v1/story-audio-worker', {
      method: 'GET', headers: { apikey: KEY }, cache: 'no-store'
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || typeof data.online !== 'boolean') throw new Error(data.error || 'استجابة حالة العامل غير صالحة.');
        workerOnline = data.online;
        workerLastSeen = data.last_seen_at || null;
        workerError = '';
        paintWorkerStatus();
        return true;
      });
    }).catch(function (error) {
      workerOnline = null;
      workerError = String(error && error.message || error || 'خطأ غير معروف');
      paintWorkerStatus();
      return false;
    });
  }

  function fetchJobs() {
    var st = story(), t = token();
    if (!st || !t || (!['ar', 'en', 'fr', 'it', 'de'].includes(lang()))) return Promise.resolve(false);
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
    var hasVerifiedCard = verifiedAudioCard(box, job);
    var s1, s2;
    if (L !== 'ar') {
      var translationKey = L + ':' + index;
      var translation = translationRecords[translationKey];
      var translationState = translationStates[translationKey];
      s1 = translationState === 'processing'
        ? { s: 'busy', t: 'Gemini يترجم الآن' }
        : translationState === 'failed'
          ? { s: 'fail', t: 'فشلت الترجمة' }
          : translation && translation.status === 'approved' && translationConfirmed[translationKey] && String(translationWorkingText[translationKey] || '').trim()
            ? { s: 'done', t: 'النص جاهز' }
            : translation && translation.status === 'approved'
              ? { s: 'warn', t: 'ترجمة محفوظة تحتاج تحققًا' }
              : translation && translation.status === 'draft'
                ? { s: 'warn', t: 'مسودة — أعد الترجمة' }
                : { s: 'todo', t: 'لم يُجهَّز' };
    } else {
      s1 = { s: 'done', t: 'جاهز' };
    }
    var readingStatus = speech ? speech.dataset.status : '';
    s2 = L !== 'ar' && !speech
      ? { s: 'na', t: 'لا يلزم — يُقرأ النص المترجم' }
      : readingStatus === 'approved'
        ? { s: 'done', t: 'نص القراءة جاهز' }
        : readingStatus === 'suggested'
          ? { s: 'warn', t: 'بانتظار المراجعة' }
          : { s: 'todo', t: 'لم يُجهَّز بعد' };
    var s3;
    if (!job) s3 = hasCard ? { s: 'done', t: 'تم سابقًا' } : (queueKnown ? { s: 'todo', t: 'لم يُرسل' } : { s: 'todo', t: 'الحالة غير معروفة' });
    else if (job.status === 'pending') s3 = { s: 'wait', t: 'في الطابور' };
    else if (job.status === 'processing') s3 = { s: 'busy', t: 'بيتم الآن' };
    else if (job.status === 'completed') s3 = hasVerifiedCard ? { s: 'done', t: 'الصوت جاهز' } : { s: 'busy', t: 'جارٍ التحقق من ملف الصوت وبصمته وظهوره في المعاينة' };
    else if (job.status === 'failed') s3 = { s: 'fail', t: 'فشل' };
    else s3 = { s: 'todo', t: String(job.status || '—') };
    var s4;
    if (!cards.length) s4 = { s: 'todo', t: 'لا يوجد صوت بعد' };
    else {
      var vals = Array.prototype.map.call(cards, function (c) { return c.dataset.review; });
      s4 = vals.indexOf('rejected') >= 0 ? { s: 'fail', t: 'مرفوض' } : vals.every(function (v) { return v === 'accepted'; }) ? { s: 'done', t: 'معتمد' } : { s: 'warn', t: 'استمع واعتمد' };
    }
    return [{ n: 1, label: 'النص', s: s1.s, t: s1.t }, { n: 2, label: 'نص القراءة', s: s2.s, t: s2.t }, { n: 3, label: 'التوليد', s: s3.s, t: s3.t }, { n: 4, label: 'المعاينة', s: s4.s, t: s4.t }];
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
    if (reload) reload.hidden = !(job && job.status === 'completed' && !verifiedAudioCard(box, job));
  }
  function updateTranslationPublishButton() {
    var button = $('kh-translation-publish-text');
    if (!button) return;
    var st = story(), blocks = st && st.i18n && st.i18n.ar && st.i18n.ar.blocks || [];
    var targetIndexes = [];
    blocks.forEach(function (block, index) {
      if (block && ['karma', 'narrator'].includes(block.speaker)) targetIndexes.push(index);
    });
    var allApproved = targetIndexes.length > 0 && targetIndexes.every(function (index) {
      var key = lang() + ':' + index;
      var record = translationRecords[key];
      return !!record && record.status === 'approved' && translationStates[key] !== 'processing' && translationStates[key] !== 'failed' && translationConfirmed[key] === true && !!String(translationWorkingText[key] || '').trim();
    });
    button.hidden = lang() === 'ar';
    button.disabled = lang() === 'ar' || !translationLoaded || !allApproved;
    button.title = allApproved ? 'كل المقاطع المنطوقة لها ترجمة جاهزة ومطابقة للمصدر العربي في هذه المعاينة؛ اضغط لنشر النص فقط.' : 'أكمل ترجمة كل المقاطع المنطوقة وتأكد من مطابقتها للمصدر العربي قبل النشر.';
  }
  function refresh() {
    Array.prototype.forEach.call(document.querySelectorAll('.kh-flow-box'), paint);
    updateTranslationPublishButton();
    updateLanguageBatchPanel();
    var err = $('kh-flow-queue-error');
    if (err) { err.hidden = !queueError; err.textContent = queueError ? 'تعذر قراءة حالة الطابور: ' + queueError : ''; }
    updateTopSummary();
  }

  /* أدوات الصوت تخص اللغة المفتوحة حاليًا داخل صفحة الحكاية، لا ملخصًا عامًا لكل اللغات. */
  var translationBatchBusy = false, translationSingleBusy = false, lastTranslationRequestAt = 0;
  async function waitForTranslationSlot() {
    var waitMs = Math.max(0, 5000 - (Date.now() - lastTranslationRequestAt));
    if (waitMs) await new Promise(function (resolve) { setTimeout(resolve, waitMs); });
    lastTranslationRequestAt = Date.now();
  }
  function setTranslationGenerateControlsDisabled(disabled) {
    document.querySelectorAll('.kh-translation-generate').forEach(function (button) { button.disabled = !!disabled; });
    var bulkButton = $('kh-translation-bulk-generate');
    if (bulkButton) bulkButton.disabled = !!disabled || !token();
  }
  var audioBatchBusy = false, audioBatchNote = {};
  /* توليد/اعتماد كل مقاطع اللغة الحالية دفعة واحدة (للغات الأربع المترجمة فقط). */
  async function runAudioBatch(kind, button) {
    var L = lang(), api = window.KHStoryAudioReview;
    if (audioBatchBusy || L === 'ar' || !api) return;
    audioBatchBusy = true; audioBatchNote[L] = '';
    var status = document.querySelector('#kh-language-audio-batch .kh-language-audio-status');
    if (button) button.disabled = true;
    if (status) status.textContent = kind === 'generate' ? 'جارٍ إرسال كل المقاطع إلى الطابور…' : 'جارٍ اعتماد صوت كل المقاطع…';
    try {
      if (kind === 'generate') {
        var r = await api.generateLanguageAudio(L), c = r.counts || {};
        var failedItems = (r.results || []).filter(function (item) { return item.state === 'blocked' || item.state === 'failed'; });
        audioBatchNote[L] = 'أُرسل ' + (c.queued || 0) + ' · أُعيد ' + (c.retried || 0) + ' · موجود بالطابور ' + (c.already_queued || 0) +
          ' · معتمد ' + (c.accepted || 0) + ' · تعذّر ' + failedItems.length + '.' +
          (failedItems.length ? ' ' + failedItems.slice(0, 3).map(function (item) { return 'مقطع ' + (item.block_index + 1) + ': ' + item.error; }).join(' | ') : '');
      } else {
        var a = await api.approveLanguageAudio(L);
        audioBatchNote[L] = 'تم اعتماد ' + a.approved + ' مقطع صوتيًا لهذه اللغة.';
      }
    } catch (e) {
      audioBatchNote[L] = (e && e.message) || 'تعذر تنفيذ العملية.';
    } finally {
      audioBatchBusy = false;
      refresh();
      setTimeout(function () { audioBatchNote[L] = ''; refresh(); }, 15000);
    }
  }
  async function updateLanguageBatchPanel() {
    var panel = $('kh-language-audio-batch'), st = story();
    if (!panel || !st) return;
    var L = lang(), api = window.KHStoryAudioReview;
    panel.dataset.lang = L;
    var title = panel.querySelector('.kh-language-audio-title');
    var reviewButton = panel.querySelector('.kh-language-audio-review');
    var status = panel.querySelector('.kh-language-audio-status');
    var bulkTranslate = panel.querySelector('#kh-translation-bulk-generate');
    if (title) title.textContent = 'أدوات اللغة — ' + ({ar:'العربية',en:'English',fr:'Français',it:'Italiano',de:'Deutsch'}[L] || L);
    if (!reviewButton || !status) return;
    if (bulkTranslate) {
      bulkTranslate.textContent = L === 'ar' ? 'تجهيز نصوص القراءة لكل المقاطع' : 'ترجمة كل المقاطع دفعة واحدة';
      bulkTranslate.title = L === 'ar'
        ? 'يجهّز نص القراءة الصوتية لكل المقاطع العربية دفعة واحدة.'
        : 'يترجم كل المقاطع بالاعتماد على ترتيب ونصوص المتحدثين في الصفحة العربية.';
      bulkTranslate.disabled = !token() || translationBatchBusy;
    }
    reviewButton.textContent = 'معاينة ومراجعة مقاطع ' + ({ar:'العربية',en:'الإنجليزية',fr:'الفرنسية',it:'الإيطالية',de:'الألمانية'}[L] || L);
    reviewButton.disabled = true;
    if (!token()) { status.textContent = 'سجّل الدخول من لوحة الإدارة لتمكين أدوات الصوت.'; return; }
    if (!api || typeof api.canReviewLanguage !== 'function') { status.textContent = 'جارٍ تحميل حالة الصوت لهذه اللغة…'; return; }
    var bulkGenerate = panel.querySelector('.kh-language-audio-generate-all');
    var bulkApprove = panel.querySelector('.kh-language-audio-approve-all');
    var bulkLanguage = L !== 'ar' && typeof api.languageBulkStatus === 'function';
    if (bulkGenerate) bulkGenerate.hidden = !bulkLanguage;
    if (bulkApprove) bulkApprove.hidden = !bulkLanguage;
    try {
      var reviewReady = api.canReviewLanguage(L) === true;
      reviewButton.disabled = !reviewReady;
      if (bulkLanguage) {
        var s = api.languageBulkStatus(L);
        if (bulkGenerate) bulkGenerate.disabled = !token() || audioBatchBusy || s.total === 0 || s.accepted === s.total;
        if (bulkApprove) bulkApprove.disabled = !token() || audioBatchBusy || !s.canApprove;
        if (!audioBatchBusy && !audioBatchNote[L]) {
          status.textContent = 'المقاطع ' + s.total + ': معتمد ' + s.accepted + ' · جاهز ' + s.ready + ' · في الطابور ' + s.pending +
            ' · قيد التوليد ' + s.processing + ' · فاشل ' + s.failed + ' · لم يُرسل ' + s.none + ' · مرفوض ' + s.rejected +
            '. الاعتماد الجماعي يتطلب اكتمال كل المقاطع والاستماع لكل مقطع كاملًا.';
        }
        if (audioBatchNote[L]) status.textContent = audioBatchNote[L];
        return;
      }
      status.textContent = reviewReady
        ? 'اكتمل تجهيز المقاطع. استمع إلى كل مقطع كاملًا واعتمده قبل الانتقال إلى المقطع التالي.'
        : 'تُجهّز المقاطع وتُراجع واحدًا تلو الآخر. لا يبدأ المقطع التالي قبل الاستماع الكامل واعتماد المقطع الحالي.';
    } catch (e) {
      status.textContent = 'تعذر التحقق من جاهزية اللغة: ' + (e.message || e);
    }
  }
  function ensureLanguageBatch(host) {
    var panel = $('kh-language-audio-batch');
    if (!panel) {
      panel = el('section', 'kh-audio-review-gate kh-language-audio-batch');
      panel.id = 'kh-language-audio-batch';
      var title = el('strong', 'kh-language-audio-title kh-gate-title', 'أدوات اللغة — اللغة الحالية');
      var actions = el('div', 'kh-audio-actions kh-language-audio-actions');
      var translationStatus = $('kh-translation-bulk-status');
      var bulkTranslate = $('kh-translation-bulk-generate');
      if (bulkTranslate) actions.appendChild(bulkTranslate);
      var reviewButton = el('button', 'kh-audio-review-btn kh-language-audio-review', 'معاينة ومراجعة المقاطع');
      reviewButton.type = 'button';
      reviewButton.addEventListener('click', function () {
        if (reviewButton.disabled) return;
        var boxes = document.querySelectorAll('.kh-flow-box');
        boxes.forEach(function (box) {
          box.open = true;
          var step = box.querySelector('details.kh-step[data-step="4"]');
          if (step) step.open = true;
        });
        var first = host.querySelector('.kh-flow-box');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      var status = el('p', 'kh-audio-review-state kh-language-audio-status', '');
      /* أزرار اللغات الأربع المترجمة فقط (en / fr / it / de)؛ تُخفى في العربية. */
      var generateAll = el('button', 'kh-audio-review-btn kh-language-audio-generate-all', 'توليد كل المقاطع');
      generateAll.type = 'button'; generateAll.hidden = true;
      generateAll.title = 'يرسل كل مقاطع هذه اللغة إلى طابور الصوت دفعة واحدة، لكل مقطع حالة مستقلة.';
      generateAll.addEventListener('click', function () { runAudioBatch('generate', generateAll); });
      var approveAll = el('button', 'kh-audio-review-btn kh-language-audio-approve-all', 'اعتماد كل المقاطع');
      approveAll.type = 'button'; approveAll.hidden = true;
      approveAll.title = 'يعتمد صوت كل المقاطع دفعة واحدة، بعد اكتمالها جميعًا والاستماع الكامل لكل مقطع.';
      approveAll.addEventListener('click', function () { runAudioBatch('approve', approveAll); });
      actions.append(generateAll, approveAll);
      actions.appendChild(reviewButton);
      panel.append(title);
      if (translationStatus) {
        translationStatus.classList.add('kh-language-translation-status');
        panel.appendChild(translationStatus);
      }
      panel.append(actions, status);
      host.parentNode.insertBefore(panel, host);
    }
    updateLanguageBatchPanel();
  }

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
      var worker = el('p', 'kh-colab-worker-status', 'جارٍ التحقق من اتصال Colab…'); worker.id = 'kh-colab-worker-status'; worker.dataset.state = 'unknown'; body.appendChild(worker);
      sum.addEventListener('click', function () { setTimeout(function () { topOpen = top.open; }, 0); });
      host.insertAdjacentElement('beforebegin', top);
    }
    var tbody = top.querySelector('.kh-top-body');
    if (banner && banner.parentNode !== tbody) tbody.appendChild(banner);
    if (importer && importer.parentNode !== tbody) tbody.appendChild(importer);
    if (!$('kh-translation-bulk-status')) {
      var bulkStatus = el('p', 'kh-translation-bulk-status', 'اضغط «الترجمة» لترجمة كل المقاطع دفعة واحدة من المصدر العربي إلى اللغات الأربع.');
      bulkStatus.id = 'kh-translation-bulk-status';
      tbody.appendChild(bulkStatus);
      var bulkRow = el('div', 'kh-translation-bulk-actions');
      var bulkTranslate = el('button', 'kh-translation-bulk-generate', 'الترجمة');
      bulkTranslate.id = 'kh-translation-bulk-generate'; bulkTranslate.type = 'button';
      bulkTranslate.addEventListener('click', async function () {
        if (translationBatchBusy || translationSingleBusy) return;
        var st = story(), activeLanguage = lang(), blocks = st && st.i18n && st.i18n.ar && st.i18n.ar.blocks || [];
        if (!blocks.length) return;
        if (!['ar', 'en', 'fr', 'it', 'de'].includes(activeLanguage)) {
          bulkStatus.textContent = 'لغة الصفحة الحالية غير مدعومة للترجمة.';
          return;
        }
        // كل صفحة تعمل على لغتها الحالية فقط؛ العربية تجهز نص القراءة ولا تطلق ترجمة للغات أخرى.
        var batchLanguages = activeLanguage === 'ar' ? [] : [activeLanguage];
        var labels = {ar:'العربية',en:'الإنجليزية',fr:'الفرنسية',it:'الإيطالية',de:'الألمانية'};
        var todo = [];
        for (var i = 0; i < blocks.length; i++) {
          if (blocks[i] && ['karma', 'narrator'].includes(blocks[i].speaker) && String(blocks[i].text || '').trim()) todo.push(i);
        }
        translationBatchBusy = true; setTranslationGenerateControlsDisabled(true);
        var doneByLanguage = {}, skippedByLanguage = {};
        batchLanguages.forEach(function (language) { doneByLanguage[language] = 0; skippedByLanguage[language] = 0; });
        var failed = [];
        var sessionLost = false;
        try {
          // Refresh the complete translation ledger before deciding which target segments are already current.
          var reviewData = await audioReviewAction({ action: 'review_get' });
          translationRecords = reviewData.audio_review && reviewData.audio_review.translations || translationRecords || {};

          // Arabic remains the canonical source. Its speech-text preparation is a separate step,
          // and is kept separate from every translated-language page.
          if (activeLanguage === 'ar' && window.KHStoryAudioReview &&
              typeof window.KHStoryAudioReview.prepareAllSpeechTexts === 'function') {
            var speechResult = await window.KHStoryAudioReview.prepareAllSpeechTexts(function (i, n) {
              bulkStatus.textContent = 'اللغة العربية هي المصدر: تجهيز نص القراءة للمقطع ' + (i + 1) + ' من ' + n + '. لن تبدأ ترجمة أي لغة أخرى من الصفحة العربية.';
            });
            if (speechResult && Array.isArray(speechResult.failed)) {
              speechResult.failed.forEach(function (item) {
                failed.push('نص القراءة العربي — المقطع ' + (Number(item.index) + 1));
              });
            }
          }

          for (var li = 0; li < batchLanguages.length; li++) {
            var targetLanguage = batchLanguages[li];
            var languageLabel = labels[targetLanguage];
            var languageTodo = [];
            for (var ti = 0; ti < todo.length; ti++) {
              var blockIndex = todo[ti];
              var sourceBlock = blocks[blockIndex];
              var key = targetLanguage + ':' + blockIndex;
              var existing = translationRecords[key];
              var sourceHash = await sha256Trim(sourceBlock.text);
              if (isCurrentApprovedTranslation(existing, sourceBlock, sourceHash)) {
                translationWorkingText[key] = String(existing.translation_text);
                translationConfirmed[key] = true;
                translationStates[key] = 'approved';
                skippedByLanguage[targetLanguage]++;
              } else {
                languageTodo.push(blockIndex);
              }
            }
            if (!languageTodo.length) {
              bulkStatus.textContent = 'مقاطع صفحة ' + languageLabel + ' جاهزة بالفعل.';
              continue;
            }
            var lastErrors = Object.create(null);
            var translateOne = async function (blockIndex, round) {
              var key = targetLanguage + ':' + blockIndex;
              bulkStatus.textContent = (round ? 'إعادة المحاولة ' + round + ' من 3 — ' : '') +
                'ترجمة المقطع ' + (blockIndex + 1) + ' من ' + blocks.length + ' إلى ' + languageLabel + ' من النص العربي…';
              translationStates[key] = 'processing';
              paintTranslationBlock(blockIndex, 'processing', 'Gemini يترجم هذا المقطع إلى ' + languageLabel + ' من المصدر العربي…', null, targetLanguage);
              try {
                await waitForTranslationSlot();
                var result = await audioReviewAction({
                  action: 'translation_generate',
                  language: targetLanguage,
                  block_index: blockIndex,
                  force: !!(translationRecords[key] && translationRecords[key].status === 'approved')
                });
                var translated = result.translation;
                if (!translated || translated.status !== 'approved' || !String(translated.translation_text || '').trim()) {
                  throw new Error('لم يُرجع الخادم ترجمة معتمدة للغة ' + languageLabel + '.');
                }
                translationRecords[key] = translated;
                translationWorkingText[key] = String(translated.translation_text);
                translationConfirmed[key] = true;
                translationStates[key] = 'approved';
                doneByLanguage[targetLanguage]++;
                paintTranslationBlock(blockIndex, 'approved', '✓ الترجمة العربية المصدر جاهزة ومعتمدة باللغة ' + languageLabel + '.', translated, targetLanguage);
                return 'done';
              } catch (e) {
                var message = String(e && e.message || 'تعذرت ترجمة هذا المقطع.');
                var latest = translationRecords[key];
                if (/معتمدة بالفعل/.test(message) && latest && latest.status === 'approved') {
                  translationStates[key] = 'stale';
                  paintTranslationBlock(blockIndex, 'stale', 'توجد ترجمة محفوظة؛ لم أستبدلها دون التحقق من تطابقها مع المصدر العربي.', latest, targetLanguage);
                  return 'skipped';
                }
                translationStates[key] = 'failed';
                lastErrors[blockIndex] = message;
                paintTranslationBlock(blockIndex, 'failed', message + ' — يمكنك إعادة المحاولة.', null, targetLanguage);
                if (/سجّل الدخول|سجل الدخول/.test(message)) return 'auth';
                return 'failed';
              }
            };
            var rounds = await runTranslationRounds(languageTodo, translateOne, {
              maxRounds: 3, waitSeconds: 20,
              sleep: function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); },
              onWait: function (pending, round, left) {
                var reason = lastErrors[pending[0]] ? ' السبب: ' + lastErrors[pending[0]] : '';
                bulkStatus.textContent = 'تعذر مؤقتًا ' + pending.length + ' مقطع باللغة ' + languageLabel +
                  '. إعادة محاولة تلقائية ' + round + ' من 3 بعد ' + left + ' ثانية.' + reason;
              }
            });
            skippedByLanguage[targetLanguage] += rounds.skipped;
            rounds.failed.forEach(function (index) { failed.push(languageLabel + ' — المقطع ' + (index + 1) + (lastErrors[index] ? ' (' + lastErrors[index] + ')' : '')); });
            if (rounds.sessionLost) { sessionLost = true; break; }
          }
        } catch (e) {
          translationBatchBusy = false; setTranslationGenerateControlsDisabled(false);
          bulkStatus.textContent = e.message || (activeLanguage === 'ar' ? 'تعذر تجهيز نصوص القراءة العربية.' : 'تعذرت ترجمة مقاطع ' + labels[activeLanguage] + ' من المصدر العربي.');
          bulkTranslate.disabled = !token();
          return;
        }
        var summary = batchLanguages.map(function (language) {
          return labels[language] + ': ' + doneByLanguage[language] + ' جديدة، ' + skippedByLanguage[language] + ' مطابقة للمصدر';
        }).join(' | ');
        bulkStatus.textContent = activeLanguage === 'ar'
          ? 'اكتمل تجهيز نصوص القراءة العربية للمقاطع. لم تبدأ أي ترجمة للغات أخرى ولم يبدأ أي توليد صوتي.'
          : 'اكتملت ترجمة مقاطع صفحة ' + labels[activeLanguage] + ' فقط من المصدر العربي. ' + summary +
            (failed.length ? ' | تعذر تجهيز: ' + failed.join('؛ ') : '') +
            (sessionLost ? ' | انتهت جلسة الدخول؛ سجّل الدخول ثم أعد تشغيل العملية لإكمال مقاطع هذه اللغة.' : '') +
            ' لم يبدأ أي توليد صوتي.';
        translationBatchBusy = false; setTranslationGenerateControlsDisabled(false);
        onUpdated();
      });
      bulkRow.appendChild(bulkTranslate);
      var publishAudio = el('button', 'kh-translation-publish-text kh-translation-publish-audio', 'نشر صوت هذه اللغة للزوار');
      publishAudio.type = 'button';
      var audioPublishStatus = el('p', 'kh-translation-audio-publish-status', 'بعد اعتماد كل المقاطع، انشر الصوت هنا أولًا. بعد نجاح النشر أرسل النص للمراجعة من الزر التالي.');
      audioPublishStatus.id = 'kh-translation-audio-publish-status';
      publishAudio.addEventListener('click', async function () {
        var api = window.KHStoryAudioReview, language = lang();
        if (!api || typeof api.publishLanguageAudio !== 'function') {
          bulkStatus.textContent = 'أدوات نشر الصوت غير جاهزة؛ حدّث المعاينة وحاول مرة أخرى.';
          return;
        }
        publishAudio.disabled = true;
        audioPublishStatus.textContent = 'جارٍ التحقق من الاعتمادات ونشر صوت ' + language.toUpperCase() + '…';
        try {
          await api.publishLanguageAudio(language);
          audioPublishStatus.textContent = 'تم نشر صوت ' + language.toUpperCase() + ' بنجاح. يمكنك الآن إرسال نص اللغة للمراجعة والنشر.';
          if (audioPending) audioPending.hidden = true;
          publishAudio.textContent = 'تحديث الصوت المنشور';
        } catch (error) {
          audioPublishStatus.textContent = 'تعذر نشر الصوت: ' + (error && error.message || error);
        } finally { publishAudio.disabled = false; }
      });
      var publishText = el('button', 'kh-translation-publish-text', 'نشر نص هذه اللغة (طلب مراجعة)');
      var audioPending = el('p', 'kh-translation-audio-pending', 'هذا الزر ينشر النص فقط. يجب نشر الصوت من الزر السابق أولًا حتى يظهر مشغل للزائر.');
      audioPending.id = 'kh-translation-audio-pending';
      publishText.id = 'kh-translation-publish-text'; publishText.type = 'button';
      publishText.addEventListener('click', async function () {
        var context = {}, language = lang(), audioPublished = false;
        var api = window.KHStoryAudioReview;
        try { context = JSON.parse(localStorage.getItem('kh-story-review-context') || '{}'); } catch (e) {}
        if (api && typeof api.refreshAudio === 'function') {
          try { await api.refreshAudio(); } catch (statusError) {}
        }
        audioPublished = !!(api && typeof api.isLanguageAudioPublished === 'function' && api.isLanguageAudioPublished(language));
        audioPending.hidden = audioPublished;
        try { localStorage.setItem('kh-text-publish-language', language); } catch (e) {}
        var audioNote = audioPublished
          ? ' صوت ' + language.toUpperCase() + ' منشور بالفعل للزوار.'
          : ' هذا الطلب ينشر النص فقط؛ صوت ' + language.toUpperCase() + ' لم يُنشر بعد. استخدم زر «نشر صوت هذه اللغة للزوار» لنشره.';
        if (window.opener && !window.opener.closed && context.submission_id != null) {
          window.opener.postMessage({ type: 'KH_TEXT_LANGUAGE_PUBLISH', submission_id: String(context.submission_id), language: language }, location.origin);
          bulkStatus.textContent = 'أُرسل طلب نشر النص للغة ' + language.toUpperCase() + ' إلى لوحة الإدارة. راجع رسالة التأكيد هناك.' + audioNote + ' لا يبدأ أي توليد صوتي تلقائيًا.';
        } else {
          bulkStatus.textContent = 'تم تحديد نشر النص للغة ' + language.toUpperCase() + '. افتح لوحة الإدارة من نفس الحكاية واضغط «نشر النص فقط (طلب مراجعة)». ' + audioNote + ' لا يبدأ أي توليد صوتي تلقائيًا.';
        }
      });
      bulkRow.appendChild(publishAudio);
      bulkRow.appendChild(audioPublishStatus);
      bulkRow.appendChild(publishText);
      bulkRow.appendChild(audioPending);
      tbody.appendChild(bulkRow);
    }
    var publishTextButton = $('kh-translation-publish-text');
    if (publishTextButton) publishTextButton.hidden = lang() === 'ar';
    var publishAudioButton = $('kh-translation-publish-audio');
    var audioPublishStatus = $('kh-translation-audio-publish-status');
    if (publishAudioButton) publishAudioButton.hidden = lang() === 'ar';
    if (audioPublishStatus) audioPublishStatus.hidden = lang() === 'ar';
    var audioPendingLabel = $('kh-translation-audio-pending');
    if (audioPendingLabel) audioPendingLabel.hidden = lang() === 'ar';
    var bulkTranslateButton = $('kh-translation-bulk-generate');
    if (bulkTranslateButton) bulkTranslateButton.hidden = false;
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
    sb.forEach(function (b, i) { if (b && b.speaker === 'karma') karma.push(i); else if (b && b.speaker === 'narrator') narrator.push(i); });
    var order = karma.concat(narrator).sort(function (a, b) { return a - b; }), current = -1;
    for (var k = 0; k < order.length; k++) { var rec = byIndex[order[k]]; if (!rec || !rec.accepted) { current = order[k]; break; } }
    var currentTranslationKey = L + ':' + current;
    var currentTranslation = L !== 'ar' ? translationRecords[currentTranslationKey] : null;
    var currentTranslationStale = L !== 'ar' && (
      translationStates[currentTranslationKey] === 'processing' ||
      translationStates[currentTranslationKey] === 'failed' ||
      !currentTranslation || currentTranslation.status !== 'approved' ||
      !translationConfirmed[currentTranslationKey] ||
      !String(translationWorkingText[currentTranslationKey] || '').trim()
    );
    var genButton = gp && gp.querySelector('button:not(.kh-audio-publish-button)');
    var genStatus = gp && gp.querySelector('.kh-audio-review-state');
    if (currentTranslationStale && genButton) { genButton.disabled = true; genButton.title = 'نفّذ «الترجمة» لهذا المقطع قبل توليد الصوت.'; }
    else if (genButton) { genButton.disabled = false; genButton.removeAttribute('title'); }
    info.forEach(function (rec) {
      /* كل مقاطع اللغة المترجمة يجب أن تعرض خطواتها حتى قبل وجود أي صوت أو بطاقة مراجعة. */
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
      var original = L === 'ar' && local && typeof local.text === 'string' ? local.text : '';
      step1.body.appendChild(kv('المتحدث', SPEAKERS[speaker] || '—'));
      if (L === 'ar') {
        step1.body.appendChild(kv('عدد الحروف', String(original.length)));
        step1.body.appendChild(el('p', 'kh-orig-text', original || 'لا يوجد نص لهذا المقطع.'));
      } else {
        step1.body.appendChild(el('p', 'kh-muted', 'النص العربي المرجعي:'));
        var arabicBlock = st && st.i18n && st.i18n.ar && st.i18n.ar.blocks && st.i18n.ar.blocks[rec.index];
        step1.body.appendChild(el('p', 'kh-orig-text', arabicBlock && arabicBlock.text || 'لا يوجد نص عربي لهذا المقطع.'));
        step1.body.appendChild(makeTranslationReview(box, rec.index, arabicBlock, local));
      }
      body.appendChild(step1.d);

      /* ② نص القراءة (Gemini) */
      var step2 = makeStep(box, 2, 'نص القراءة (Gemini)');
      if (speech.length) {
        speech.forEach(function (p) { layerSpeechPanel(box, p); step2.body.appendChild(p); });
      } else if (L === 'ar') {
        step2.body.appendChild(el('p', 'kh-muted', 'هذا المقطع لا يحتاج نص قراءة منفصلًا.'));
      }
      if (L !== 'ar' && !speech.length) {
        step2.body.appendChild(el('p', 'kh-muted', 'لا يلزم نص قراءة منفصل لهذه اللغة: يُقرأ النص المترجم المعتمد في الخطوة الأولى مباشرة عند التوليد.'));
      }
      body.appendChild(step2.d);

      /* ③ التوليد */
      if (['ar', 'en', 'fr', 'it', 'de'].includes(L)) {
        var step3 = makeStep(box, 3, 'التوليد');
        step3.body.appendChild(el('p', 'kh-gen-note', currentTranslationStale ? 'لا يمكن توليد الصوت قبل نجاح «الترجمة» لهذا المقطع.' : ''));
        if (rec.index === current && genButton) {
          var row = el('div', 'kh-gen-row'); row.appendChild(genButton); if (genStatus) row.appendChild(genStatus); step3.body.appendChild(row);
        }
        engine.forEach(function (p) { step3.body.appendChild(p); });
        var jobSub = makeSub(box, 'job', '⚙️ تفاصيل طلب التوليد');
        jobSub.appendChild(el('div', 'kh-job-data'));
        step3.body.appendChild(jobSub);
        var reload = el('button', 'kh-gen-reload', 'حدّث الصفحة لتسمع المقطع'); reload.type = 'button'; reload.hidden = true;
        reload.textContent = 'إعادة فحص الصوت';
        reload.addEventListener('click', function () {
          var api = window.KHStoryAudioReview;
          if (!api || typeof api.refreshAudio !== 'function') return;
          reload.disabled = true;
          api.refreshAudio().then(function () { poll(); }).catch(function () {}).finally(function () { reload.disabled = false; });
        });
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
      if (!cards.length && !other.length) step4.body.appendChild(el('p', 'kh-muted', 'لا يوجد صوت لهذا المقطع باللغة المحددة بعد. أرسله من خطوة التوليد، وسيظهر هنا بعد اكتماله.'));
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
    ensureLanguageBatch(host);
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
    Promise.all([fetchJobs(), fetchWorkerStatus()]).then(function () { return refreshCompletedAudio(); }).then(function () { refresh(); }).then(function () { polling = false; schedule(); }, function () { polling = false; schedule(); });
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
  document.addEventListener('site-language-change', function () { loadTranslations().then(onUpdated); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(timer); poll(); } });
  if ($('kh-audio-review-gate')) {
    loadTranslations().then(function () { onUpdated(); });
  }
})();
