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
  var t = normText(rec && rec.title); if (!t) return [];
  return (siteStories || []).filter(function (s) { return s && normText(s.title) === t; });
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

var api = {
  STATE: STATE, LABEL: LABEL, ORDER: ORDER, DECISION: DECISION, QUEUE: QUEUE,
  stateOf: stateOf, dbStatusFor: dbStatusFor, group: group, counters: counters,
  linkedSite: linkedSite, possibleSiteMatches: possibleSiteMatches, normText: normText,
  markPreviewSent: markPreviewSent, markApproved: markApproved, markPreviewRejected: markPreviewRejected,
  markEdited: markEdited, markPublishCheckFailed: markPublishCheckFailed,
  canMarkPublished: canMarkPublished, markPublished: markPublished
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.KHWorkflow = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
