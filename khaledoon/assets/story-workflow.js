/* khaledoon/assets/story-workflow.js
   مصدر واحد لحالة دورة الحكاية. دوال نقية بلا شبكة ولا DOM ولا Supabase.
   تعتمد فقط على: record.status  +  record.story_meta.preview_review  (+ story_meta.pending_draft للمنشورة).
   لا تتطلب أي تعديل في قاعدة البيانات. تعمل في المتصفح (window.KHWorkflow) وفي Node للاختبار. */
(function (root) {
'use strict';

var STATE = {
  EDITING: 'editing',                 // تحت التحرير
  PREVIEW_SENT: 'preview_sent',       // مرسلة للمعاينة
  PREVIEW_REJECTED: 'preview_rejected', // معاينة مرفوضة (تعود للتحرير)
  AWAITING_PUBLISH: 'awaiting_publish', // بانتظار النشر (قُبلت المعاينة)
  PUBLISHED: 'published',             // تم النشر
  REJECTED: 'rejected'                // الحكاية الأصلية مرفوضة
};
var LABEL = {
  editing: 'تحت التحرير',
  preview_sent: 'مرسلة للمعاينة',
  preview_rejected: 'معاينة مرفوضة',
  awaiting_publish: 'بانتظار النشر',
  published: 'تم النشر',
  rejected: 'مرفوضة'
};
var ORDER = ['editing', 'preview_rejected', 'preview_sent', 'awaiting_publish', 'published', 'rejected'];

/* قيم preview_review.decision. «approved_waiting_for_github_upload» و«rejected» موجودتان فعلًا في الكود والبيانات. */
var DECISION = {
  SENT: 'sent',
  APPROVED: 'approved_waiting_for_github_upload',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  EDITED: 'edited_after_review'
};

/* العدادات التي طلبها صاحب المشروع: تحت التحرير / المعاينة / المراجعة. */
var QUEUE = {
  editing: ['editing', 'preview_rejected'],
  preview: ['preview_sent'],
  review: ['awaiting_publish']
};

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function metaOf(rec) { return rec && isObj(rec.story_meta) ? rec.story_meta : {}; }
function reviewOf(rec) { var m = metaOf(rec); return isObj(m.preview_review) ? m.preview_review : {}; }
function clone(x) { return JSON.parse(JSON.stringify(x == null ? {} : x)); }
function iso(now) { return (now instanceof Date ? now : new Date(now || Date.now())).toISOString(); }

/* الحالة الفعلية لسجل واحد. تعيد {state, label, warnings[]}. */
function stateOf(rec) {
  var status = rec && rec.status, pr = reviewOf(rec), d = pr.decision, w = [];
  var out = function (s) { return { state: s, label: LABEL[s], warnings: w }; };

  if (status === 'rejected') return out(STATE.REJECTED);
  if (status === 'published') {
    if (isObj(metaOf(rec).pending_draft)) w.push('pending_draft_over_published');
    return out(STATE.PUBLISHED);
  }
  if (status !== 'pending' && status !== 'review') w.push('unknown_status');

  if (d === DECISION.APPROVED) {
    if (!pr.static_story_path && !pr.prepared_page_url) w.push('no_prepared_page');
    if (pr.publish_error) w.push('last_publish_check_failed');
    return out(STATE.AWAITING_PUBLISH);
  }
  /* status=review بلا قرار اعتماد مسجّل: لا نعرضه كمعتمد لمجرد الاسم. */
  if (status === 'review') w.push('review_without_approval_record');
  if (d === DECISION.SENT) return out(STATE.PREVIEW_SENT);
  if (d === DECISION.REJECTED) return out(STATE.PREVIEW_REJECTED);
  if (d && d !== DECISION.EDITED && d !== DECISION.PUBLISHED) w.push('unknown_decision');
  return out(STATE.EDITING);
}

/* حالة قاعدة البيانات المتوافقة مع الحالة المشتقة (القيم الحالية فقط: pending/review/published/rejected). */
function dbStatusFor(state) {
  switch (state) {
    case STATE.AWAITING_PUBLISH: return 'review';
    case STATE.PUBLISHED: return 'published';
    case STATE.REJECTED: return 'rejected';
    default: return 'pending';
  }
}

/* كل سجل في مجموعة واحدة فقط. */
function group(records) {
  var g = {};
  ORDER.forEach(function (s) { g[s] = []; });
  (records || []).forEach(function (r) { g[stateOf(r).state].push(r); });
  return g;
}

/* عدادات سجلات الأدمن منفصلة تمامًا عن عدد صفحات HTML المنشورة. */
function counters(records, siteStories) {
  var g = group(records), byState = {}, queues = {};
  ORDER.forEach(function (s) { byState[s] = g[s].length; });
  Object.keys(QUEUE).forEach(function (q) {
    queues[q] = QUEUE[q].reduce(function (n, s) { return n + byState[s]; }, 0);
  });
  var pages = (siteStories || []).filter(function (s) { return s && s.published !== false; });
  return { records: (records || []).length, byState: byState, queues: queues, sitePages: pages.length };
}

/* ربط سجل بصفحة موقع منشورة: صريح فقط (static_story_id المسجّل عند الاعتماد، أو story_number).
   لا ربط بالعنوان أو اسم الشخصية، حتى لا يختفي سجل داخل بطاقة صفحة منشورة. */
function pad3(v) { var n = parseInt(String(v == null ? '' : v), 10); return isFinite(n) && n > 0 ? String(n).padStart(3, '0') : ''; }
function linkedSite(rec, siteStories) {
  var ids = [pad3(reviewOf(rec).static_story_id), pad3(rec && rec.story_number), pad3(metaOf(rec).story_number)].filter(Boolean);
  if (!ids.length) return null;
  var list = siteStories || [];
  for (var i = 0; i < list.length; i++) { if (ids.indexOf(pad3(list[i] && list[i].id)) >= 0) return list[i]; }
  return null;
}

/* تنبيه استرشادي فقط (لا يدمج ولا يخفي): تطابق عنوان مطبّع. */
function normText(x) {
  return String(x == null ? '' : x)
    .replace(/[*_`#>]+/g, '').replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim().replace(/[.,،؛;:!?؟]+$/g, '').trim().toLocaleLowerCase();
}
function possibleSiteMatches(rec, siteStories) {
  var t = normText(rec && rec.title);
  var figure = normText(rec && (rec.figure_name || rec.person));
  if (!t && !figure) return [];
  return (siteStories || []).filter(function (s) {
    if (!s) return false;
    var titleMatch = !!t && normText(s.title) === t;
    var figureMatch = !!figure && normText(s.person || s.figure_name) === figure;
    return titleMatch || figureMatch;
  });
}

/* ===== كتابة الانتقالات: تُنتج story_meta جديدًا ولا تغيّر المُدخل. نفس الدوال يستخدمها الأدمن والمعاينة وباني الحكاية. ===== */
function pushHistory(meta, entry) {
  var h = Array.isArray(meta.preview_review_history) ? meta.preview_review_history.slice(-19) : [];
  h.push(entry); meta.preview_review_history = h;
}
function withReview(meta, patch, historyEntry) {
  var m = clone(meta), prev = isObj(m.preview_review) ? m.preview_review : {};
  if (historyEntry && prev.decision) pushHistory(m, { decision: prev.decision, at: prev.reviewed_at || prev.sent_at || null, note: prev.note || '', reason: prev.reason || '' });
  m.preview_review = Object.assign({}, prev, patch);
  return m;
}

/* فتح/إرسال المعاينة. */
function markPreviewSent(meta, now) {
  return withReview(meta, { decision: DECISION.SENT, sent_at: iso(now), note: 'أُرسلت للمعاينة؛ لم تُنشر.', reason: '', publish_error: null }, true);
}
/* قبول المعاينة: يحفظ مسار الصفحة الجاهزة إن وُجد. لا يعني نشرًا. */
function markApproved(meta, info, now) {
  info = info || {};
  var prev = isObj(meta && meta.preview_review) ? meta.preview_review : {};
  return withReview(meta, {
    decision: DECISION.APPROVED, reviewed_at: iso(now),
    note: 'قُبلت المعاينة؛ الرفع والنشر الحي خطوة منفصلة تتطلب موافقة المسؤول.', reason: '',
    static_story_id: info.static_story_id != null ? info.static_story_id : (prev.static_story_id || null),
    static_story_path: info.static_story_path != null ? info.static_story_path : (prev.static_story_path || null),
    bundle_downloaded: !!info.bundle_downloaded,
    prepared_page_url: info.prepared_page_url != null ? info.prepared_page_url : (prev.prepared_page_url || ''),
    publish_error: null
  }, true);
}
/* رفض المعاينة: يعيد الحكاية للتحرير مع حفظ السبب والسجل السابق. لا يحذف شيئًا من النص. */
function markPreviewRejected(meta, reason, now) {
  return withReview(meta, { decision: DECISION.REJECTED, reviewed_at: iso(now), note: 'رُفضت المعاينة؛ أُعيدت الحكاية للتحرير.', reason: String(reason || '').slice(0, 1000), publish_error: null }, true);
}
/* تعديل المحتوى بعد الاعتماد يُسقط الاعتماد؛ غير ذلك لا يتغير (تبقى «معاينة مرفوضة» حتى تُرسل من جديد). */
function markEdited(meta, now) {
  var pr = isObj(meta && meta.preview_review) ? meta.preview_review : {};
  if (pr.decision !== DECISION.APPROVED) return clone(meta);
  return withReview(meta, { decision: DECISION.EDITED, edited_at: iso(now), note: 'عُدّل المحتوى بعد الاعتماد؛ يلزم إرساله للمعاينة من جديد.' }, true);
}
/* فشل فحص الصفحة الحية: تبقى بانتظار النشر مع سبب محفوظ. */
function markPublishCheckFailed(meta, reason, now) {
  return withReview(meta, { publish_error: { at: iso(now), reason: String(reason || '').slice(0, 1000) } }, false);
}
/* السماح بتسجيل «تم النشر»: فقط من «بانتظار النشر» وبعد نجاح فحص الصفحة الحية. */
function canMarkPublished(rec, verification) {
  var s = stateOf(rec);
  if (s.state !== STATE.AWAITING_PUBLISH) return { ok: false, reason: 'السجل ليس في حالة «بانتظار النشر».' };
  if (!verification || verification.ok !== true) return { ok: false, reason: 'لم ينجح فحص الصفحة الحية بعد.' };
  return { ok: true, reason: '' };
}
function markPublished(meta, now) {
  var m = withReview(meta, { decision: DECISION.PUBLISHED, published_confirmed_at: iso(now), note: 'أكد الأدمن رفع الملفات ونجح فحص الصفحة الحية.', publish_error: null }, false);
  delete m.pending_draft;
  return m;
}

/* عدد الفقرات بالطريقة نفسها التي يقسّم بها مولّد الصفحة (سطر فارغ واحد على الأقل بين فقرتين). */
function paragraphCount(s) {
  return String(s == null ? '' : s).split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean).length;
}

/* فحص اكتمال حزمة AI قبل الاستيراد؛ يمنع مرور ترجمة أو بنك أسئلة ناقص إلى المعاينة. */
function validateStoryPackage(pkg) {
  var errors = [], langs = ['en', 'fr', 'it', 'de'];
  if (!isObj(pkg)) return { ok: false, errors: ['ناتج الحكاية ليس كائن JSON.'] };
  function textField(obj, key, label, min) {
    var value = obj && obj[key];
    if (typeof value !== 'string' || value.trim().length < (min || 1)) errors.push(label);
  }
  [
    ['section_key', 'مفتاح القسم'], ['figure_name', 'اسم الشخصية'],
    ['title', 'العنوان'], ['subtitle', 'العنوان الفرعي'],
    ['narrator_name', 'اسم الراوي'], ['narrator_grade', 'صف الراوي'],
    ['karma_text', 'صوت كارما'], ['history_note', 'السياق التاريخي'],
    ['sources', 'المصادر'], ['images_note', 'ملاحظات الصور وحقوقها']
  ].forEach(function (field) { textField(pkg, field[0], field[1], 1); });
  textField(pkg, 'original_body', 'النص الأصلي', 20);
  textField(pkg, 'body', 'نص الراوي (50 حرفًا على الأقل)', 50);
  var designOptions = ['timeline','science-lab','ancient-civilization','military-history','journey-map','portrait-biography','women-leadership','arts-culture','discovery'];
  if (designOptions.indexOf(String(pkg.visual_design || '')) < 0) errors.push('اختر تصميمًا بصريًا مخصصًا من قائمة visual_design.');
  /* الخريطة التفاعلية: يجب أن يختار المولّد موقعًا موثقًا أو يصرّح صراحة بعدم توفره. */
  if (!Object.prototype.hasOwnProperty.call(pkg, 'map_location')) {
    errors.push('حقل map_location مطلوب: أرسل null عند عدم توفر موقع موثق، أو كائن موقع مكتمل.');
  } else if (pkg.map_location !== null) {
    var mapLoc = pkg.map_location;
    if (!isObj(mapLoc)) {
      errors.push('map_location يجب أن يكون null أو كائن موقع موثق.');
    } else {
      if (typeof mapLoc.lat !== 'number' || !Number.isFinite(mapLoc.lat) || mapLoc.lat < -90 || mapLoc.lat > 90 ||
          typeof mapLoc.lng !== 'number' || !Number.isFinite(mapLoc.lng) || mapLoc.lng < -180 || mapLoc.lng > 180) {
        errors.push('map_location يحتاج lat وlng رقميين ضمن حدود الإحداثيات الصحيحة.');
      }
      if (!isObj(mapLoc.place) || ['ar','en','fr','it','de'].some(function (l) {
        return typeof mapLoc.place[l] !== 'string' || !mapLoc.place[l].trim();
      })) errors.push('اسم المكان في map_location مطلوب باللغات الخمس ar/en/fr/it/de.');
      if (typeof mapLoc.source_name !== 'string' || !mapLoc.source_name.trim() ||
          typeof mapLoc.source_url !== 'string' || !/^https:\/\//i.test(mapLoc.source_url.trim())) {
        errors.push('map_location يحتاج اسم مصدر ورابط مصدر موثوقًا قابلًا للفتح.');
      }
      if (mapLoc.approximate !== undefined && typeof mapLoc.approximate !== 'boolean') {
        errors.push('map_location.approximate يجب أن تكون true أو false.');
      }
    }
  }
  /* الغلاف جزء من عقد الحزمة، ولا يجوز إسقاطه أثناء الاستيراد أو توليد الصفحة. */
  var cover = pkg.cover;
  if (!isObj(cover)) {
    errors.push('كائن cover مطلوب ويجب أن يتضمن بيانات الغلاف ومصدره وحقوقه.');
  } else {
    var coverUrl = String(cover.url || '').trim();
    var coverPath = String(cover.path || '').trim();
    if (coverUrl) {
      if (!/^https:\/\//i.test(coverUrl)) errors.push('cover.url يجب أن يكون رابط صورة HTTPS مباشرًا.');
    } else if (coverPath.split('/').some(function (part) { return part === '.' || part === '..'; }) || !/^(?:assets\/images\/|images\/|stories\/)[^\s"'<>]+$/i.test(coverPath)) {
      errors.push('cover يحتاج url HTTPS أو path إلى ملف موجود داخل المستودع تحت assets/images/ أو images/ أو stories/.');
    }
    ['alt','caption','source_name','rights'].forEach(function (key) {
      if (typeof cover[key] !== 'string' || !cover[key].trim()) errors.push('cover.' + key + ' مطلوب.');
    });
    if (typeof cover.source_url !== 'string' || !/^https:\/\//i.test(cover.source_url.trim())) {
      errors.push('cover.source_url يجب أن يكون رابط HTTPS حقيقيًا للمصدر.');
    }
    if (['archival','illustration','diagram','map'].indexOf(String(cover.kind || '')) < 0) {
      errors.push('cover.kind يجب أن يكون archival أو illustration أو diagram أو map.');
    }
    if (!isObj(cover.i18n)) {
      errors.push('cover.i18n مطلوب بترجمات en/fr/it/de للنص البديل والتعليق.');
    } else {
      langs.forEach(function (lang) {
        var translatedCover = cover.i18n[lang];
        if (!isObj(translatedCover) || !String(translatedCover.alt || '').trim() || !String(translatedCover.caption || '').trim()) {
          errors.push('الغلاف: النص البديل والتعليق مترجمان ومطلوبان في ' + lang.toUpperCase() + '.');
        }
      });
    }
  }

  var images = Array.isArray(pkg.images) ? pkg.images : [];
  var validImages = images.filter(function (im) {
    if (!isObj(im)) return false;
    var imageUrl = String(im.url || '').trim(), sourceUrl = String(im.source_url || '').trim();
    var urlOk = /^https:\/\//i.test(imageUrl) || /^(?:\.\.\/|\.\/|images\/|assets\/images\/)[^\s"'<>]+$/i.test(imageUrl);
    return urlOk && /^https:\/\//i.test(sourceUrl) && String(im.alt || '').trim() &&
      String(im.caption || '').trim() && String(im.source_name || '').trim() && String(im.rights || '').trim() &&
      ['archival','illustration','diagram','map'].indexOf(String(im.kind || '')) >= 0;
  });
  if (validImages.length < 2) errors.push('حزمة الاستيراد تحتاج صورتين موثقتين وصالحتين على الأقل في images؛ لكل صورة url وalt وcaption وkind وsource_name وsource_url وrights وترجمات i18n. إذا تعذر التحقق من صورتين، لا تُرسل حزمة للاستيراد.');
  images.forEach(function (im, index) {
    if (!isObj(im)) return;
    ['en','fr','it','de'].forEach(function (lang) {
      var translated = im.i18n && im.i18n[lang];
      if (!translated || !String(translated.alt || '').trim() || !String(translated.caption || '').trim()) {
        errors.push('الصورة ' + (index + 1) + ': النص البديل والتعليق ناقصان في ' + lang.toUpperCase() + '.');
      }
    });
  });

  /* حدود الأطوال التي يقصّ عندها الاستيراد النص بصمت؛ القص يكسر تطابق الفقرات مع الترجمات. */
  [
    ['title', 140, 'العنوان'], ['subtitle', 200, 'العنوان الفرعي'], ['body', 12000, 'نص الراوي'],
    ['history_note', 12000, 'السياق التاريخي'], ['sources', 3000, 'المصادر'], ['images_note', 1500, 'ملاحظات الصور']
  ].forEach(function (limit) {
    var value = pkg[limit[0]];
    if (typeof value === 'string' && value.length > limit[1]) {
      errors.push(limit[2] + ' أطول من الحد المسموح (' + limit[1] + ' حرفًا)؛ اختصره حتى لا يُقصّ عند الحفظ.');
    }
  });

  /* مصدران مختلفان على الأقل بروابط فعلية، وهو شرط تحضير النشر نفسه. */
  var sourceUrls = String(pkg.sources || '').match(/https?:\/\/[^\s)\]>]+/g) || [];
  var uniqueSourceUrls = {};
  sourceUrls.forEach(function (u) { uniqueSourceUrls[u.replace(/[.,;:]+$/, '')] = true; });
  if (Object.keys(uniqueSourceUrls).length < 2) errors.push('المصادر تحتاج رابطين مختلفين على الأقل، كل مصدر في سطر مستقل.');

  if (!isObj(pkg.translations)) {
    errors.push('قسم الترجمات غير موجود.');
  } else {
    var requiredTranslationFields = [
      ['student_name', 'اسم الراوي'], ['grade', 'الصف'], ['title', 'العنوان'],
      ['subtitle', 'العنوان الفرعي'], ['karma_text', 'صوت كارما'],
      ['body', 'نص الراوي'], ['history_note', 'السياق التاريخي'],
      ['images_note', 'ملاحظات الصور']
    ];
    var parityFields = [
      ['karma_text', 'صوت كارما'], ['body', 'نص الراوي'],
      ['history_note', 'السياق التاريخي'], ['images_note', 'ملاحظات الصور']
    ];
    langs.forEach(function (lang) {
      var translation = pkg.translations[lang];
      if (!isObj(translation)) {
        errors.push('الترجمة ' + lang.toUpperCase() + ' غير موجودة.');
        return;
      }
      requiredTranslationFields.forEach(function (field) {
        if (typeof translation[field[0]] !== 'string' || !translation[field[0]].trim()) {
          errors.push(lang.toUpperCase() + ': حقل ' + field[1] + ' فارغ.');
        }
      });
      /* اسم الشخصية المترجم (اختياري لكنه يظهر في البحث والخريطة): إن وُجد فيجب أن يكون بحروف غير عربية. */
      if (typeof translation.figure_name === 'string' && /[\u0600-\u06FF]/.test(translation.figure_name)) {
        errors.push(lang.toUpperCase() + ': اسم الشخصية المترجم (figure_name) يجب ألا يحتوي حروفًا عربية.');
      }
      /* المولّد يربط الترجمة بالأصل فقرة بفقرة؛ اختلاف العدد يوقف التحضير لاحقًا. */
      parityFields.forEach(function (field) {
        var original = pkg[field[0]], translated = translation[field[0]];
        if (typeof original !== 'string' || typeof translated !== 'string' || !translated.trim()) return;
        if (paragraphCount(original) !== paragraphCount(translated)) {
          errors.push(lang.toUpperCase() + ': عدد فقرات ' + field[1] + ' (' + paragraphCount(translated) + ') لا يطابق العربية (' + paragraphCount(original) + '). افصل الفقرات بسطر فارغ وبالعدد نفسه.');
        }
      });
    });

    /* لا نعدّ العبارات القصيرة المتشابهة خطأً؛ نفحص النصوص الطويلة فقط بحثًا عن نسخ ترجمة كاملة بين لغتين. */
    function duplicateComparableText(value) {
      return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    }
    [['body', 'نص الراوي'], ['history_note', 'السياق التاريخي']].forEach(function (field) {
      var seenLongTranslations = [];
      langs.forEach(function (lang) {
        var translation = pkg.translations[lang];
        var value = translation && translation[field[0]];
        if (typeof value !== 'string') return;
        var normalized = duplicateComparableText(value);
        if (normalized.length < 100) return;
        var previous = seenLongTranslations.find(function (entry) { return entry.normalized === normalized; });
        if (previous) {
          errors.push(lang.toUpperCase() + ': ' + field[1] + ' مطابق بالكامل لترجمة ' + previous.lang.toUpperCase() + ' في نص طويل (100 حرف فأكثر). راجع الترجمتين بدل نسخ النص نفسه.');
        } else {
          seenLongTranslations.push({ lang: lang, normalized: normalized });
        }
      });
    });
  }

  var questions = isObj(pkg.question_bank) && Array.isArray(pkg.question_bank.questions) ? pkg.question_bank.questions : [];
  if (questions.length < 5) errors.push('بنك الأسئلة يحتاج خمسة أسئلة على الأقل.');
  questions.forEach(function (question, index) {
    var label = 'السؤال ' + (index + 1);
    if (!isObj(question) || typeof question.q !== 'string' || !question.q.trim()) errors.push(label + ': نص السؤال فارغ.');
    if (!isObj(question) || !Array.isArray(question.o) || question.o.length < 2 ||
        question.o.some(function (option) { return typeof option !== 'string' || !option.trim(); })) {
      errors.push(label + ': الاختيارات ناقصة.');
    }
    if (!isObj(question) || !Number.isInteger(question.a) || !Array.isArray(question.o) ||
        question.a < 0 || question.a >= question.o.length) errors.push(label + ': رقم الإجابة الصحيحة غير صالح.');
    if (!isObj(question) || typeof question.e !== 'string' || !question.e.trim()) errors.push(label + ': تفسير الإجابة فارغ.');
    langs.forEach(function (lang) {
      var translation = question && question.i18n && question.i18n[lang];
      if (!translation || typeof translation.q !== 'string' || !translation.q.trim() ||
          !Array.isArray(translation.o) || !Array.isArray(question.o) ||
          translation.o.length !== question.o.length ||
          translation.o.some(function (option) { return typeof option !== 'string' || !option.trim(); }) ||
          typeof translation.e !== 'string' || !translation.e.trim()) {
        errors.push(label + ': ترجمة السؤال أو الاختيارات أو التفسير ناقصة في ' + lang.toUpperCase() + '.');
      }
    });
  });
  return { ok: errors.length === 0, errors: errors };
}

var api = {
  STATE: STATE, LABEL: LABEL, ORDER: ORDER, DECISION: DECISION, QUEUE: QUEUE,
  stateOf: stateOf, dbStatusFor: dbStatusFor, group: group, counters: counters,
  linkedSite: linkedSite, possibleSiteMatches: possibleSiteMatches, normText: normText,
  markPreviewSent: markPreviewSent, markApproved: markApproved, markPreviewRejected: markPreviewRejected,
  markEdited: markEdited, markPublishCheckFailed: markPublishCheckFailed,
  canMarkPublished: canMarkPublished, markPublished: markPublished,
  validateStoryPackage: validateStoryPackage
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.KHWorkflow = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
