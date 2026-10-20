/* اختبار وحدة story-workflow.js — يعمل بـ: node khaledoon/tests/story-workflow.test.js
   لا يستخدم شبكة ولا قاعدة بيانات؛ الصفوف التجريبية تُحاكي شكل السجلات الفعلية فقط. */
'use strict';
var assert = require('assert');
var W = require('../assets/story-workflow.js');
var passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('ok  - ' + name); } catch (e) { console.error('FAIL - ' + name + '\n' + e.stack); process.exitCode = 1; } }
var NOW = new Date('2026-10-20T10:00:00Z');

/* صفوف بنفس شكل الحالات الأربع الموجودة فعليًا (بدون نصوص حقيقية). */
var rows = {
  pendingNoMeta:  { id: 'a', status: 'pending',   story_meta: {} },
  pendingNull:    { id: 'b', status: 'pending',   story_meta: null },
  published:      { id: 'c', status: 'published', title: '**حكاية العالم أحمد زويل**', story_meta: {} },
  reviewApproved: { id: 'd', status: 'review',    story_meta: { preview_review: { decision: 'approved_waiting_for_github_upload', static_story_id: null, static_story_path: null, prepared_page_url: '', bundle_downloaded: false } } }
};

t('الصفوف الأربعة الحالية تُصنَّف تصنيفًا صحيحًا', function () {
  assert.equal(W.stateOf(rows.pendingNoMeta).state, 'editing');
  assert.equal(W.stateOf(rows.pendingNull).state, 'editing');
  assert.equal(W.stateOf(rows.published).state, 'published');
  var r = W.stateOf(rows.reviewApproved);
  assert.equal(r.state, 'awaiting_publish');
  assert.ok(r.warnings.indexOf('no_prepared_page') >= 0, 'يجب التنبيه أن لا مسار صفحة جاهزة');
});

t('status=review بلا قرار اعتماد لا يُعرض كمعتمد', function () {
  var r = W.stateOf({ status: 'review', story_meta: {} });
  assert.equal(r.state, 'editing');
  assert.ok(r.warnings.indexOf('review_without_approval_record') >= 0);
});

t('كل سجل في مجموعة واحدة فقط ولا يضيع سجل', function () {
  var list = Object.keys(rows).map(function (k) { return rows[k]; });
  var g = W.group(list), n = 0;
  W.ORDER.forEach(function (s) { n += g[s].length; });
  assert.equal(n, list.length);
  var seen = {};
  W.ORDER.forEach(function (s) { g[s].forEach(function (r) { assert.ok(!seen[r.id], 'مكرر: ' + r.id); seen[r.id] = 1; }); });
});

t('العدادات تفصل سجلات الأدمن عن صفحات الموقع', function () {
  var list = Object.keys(rows).map(function (k) { return rows[k]; });
  var site = [{ id: '001' }, { id: '002' }, { id: '003', published: false }];
  var c = W.counters(list, site);
  assert.equal(c.records, 4);
  assert.equal(c.sitePages, 2);
  assert.equal(c.queues.editing, 2);
  assert.equal(c.queues.preview, 0);
  assert.equal(c.queues.review, 1);
  assert.equal(c.byState.published, 1);
});

t('الربط يحتاج معرّفًا صريحًا؛ العنوان أو الشخصية يعرضان تنبيهًا فقط', function () {
  var site = [{ id: '007', title: 'حكاية العالم أحمد زويل', person: 'أحمد زويل' }];
  var byTitle = { id: 'x', status: 'pending', title: 'حكاية العالم أحمد زويل', story_meta: {} };
  assert.equal(W.linkedSite(byTitle, site), null);
  assert.equal(W.possibleSiteMatches(byTitle, site).length, 1);
  assert.equal(W.possibleSiteMatches(rows.published, site).length, 1, 'علامتا ** لا تمنعان التنبيه');
  var byFigure = { id: 'z', status: 'pending', title: 'عنوان مختلف', figure_name: 'أحمد زويل', story_meta: {} };
  assert.equal(W.linkedSite(byFigure, site), null, 'اسم الشخصية لا ينشئ ربطًا تلقائيًا');
  assert.equal(W.possibleSiteMatches(byFigure, site).length, 1, 'اسم الشخصية يعرض تنبيهًا استرشاديًا');
  var linked = { id: 'y', status: 'review', story_meta: { preview_review: { decision: W.DECISION.APPROVED, static_story_id: '7' } } };
  assert.equal(W.linkedSite(linked, site).id, '007');
});

t('دورة كاملة: تحرير ← مرسلة ← مرفوضة ← مرسلة ← معتمدة ← منشورة', function () {
  var rec = { status: 'pending', story_meta: {} };
  assert.equal(W.stateOf(rec).state, 'editing');

  rec.story_meta = W.markPreviewSent(rec.story_meta, NOW);
  assert.equal(W.stateOf(rec).state, 'preview_sent');

  rec.story_meta = W.markPreviewRejected(rec.story_meta, 'الصور ناقصة', NOW);
  var s = W.stateOf(rec);
  assert.equal(s.state, 'preview_rejected');
  assert.equal(rec.story_meta.preview_review.reason, 'الصور ناقصة');
  assert.equal(W.dbStatusFor(s.state), 'pending');

  /* تعديل بعد الرفض لا يمسح علامة الرفض */
  rec.story_meta = W.markEdited(rec.story_meta, NOW);
  assert.equal(W.stateOf(rec).state, 'preview_rejected');

  rec.story_meta = W.markPreviewSent(rec.story_meta, NOW);
  assert.equal(W.stateOf(rec).state, 'preview_sent');
  assert.equal(rec.story_meta.preview_review.reason, '', 'سبب الرفض القديم لا يبقى على الإرسال الجديد');
  assert.ok(rec.story_meta.preview_review_history.some(function (h) { return h.decision === 'rejected' && h.at; }), 'سجل الرفض محفوظ');

  rec.story_meta = W.markApproved(rec.story_meta, { static_story_id: '011', static_story_path: 'stories/history/011', bundle_downloaded: true }, NOW);
  rec.status = W.dbStatusFor('awaiting_publish');
  s = W.stateOf(rec);
  assert.equal(s.state, 'awaiting_publish');
  assert.equal(rec.status, 'review');
  assert.deepEqual(s.warnings, []);

  assert.equal(W.canMarkPublished(rec, null).ok, false);
  assert.equal(W.canMarkPublished(rec, { ok: false }).ok, false);

  /* فشل الفحص: تبقى بانتظار النشر مع سبب */
  rec.story_meta = W.markPublishCheckFailed(rec.story_meta, 'الصفحة غير موجودة (404)', NOW);
  s = W.stateOf(rec);
  assert.equal(s.state, 'awaiting_publish');
  assert.ok(s.warnings.indexOf('last_publish_check_failed') >= 0);
  assert.equal(rec.story_meta.preview_review.publish_error.reason, 'الصفحة غير موجودة (404)');

  assert.equal(W.canMarkPublished(rec, { ok: true }).ok, true);
  rec.story_meta = W.markPublished(rec.story_meta, NOW);
  rec.status = 'published';
  assert.equal(W.stateOf(rec).state, 'published');
  assert.equal(rec.story_meta.preview_review.publish_error, null);
});

t('تعديل المحتوى بعد الاعتماد يُسقط الاعتماد', function () {
  var rec = { status: 'review', story_meta: W.markApproved({}, { static_story_path: 'stories/x/001' }, NOW) };
  assert.equal(W.stateOf(rec).state, 'awaiting_publish');
  rec.story_meta = W.markEdited(rec.story_meta, NOW);
  rec.status = 'pending';
  assert.equal(W.stateOf(rec).state, 'editing');
});

t('لا يُسمح بتسجيل النشر من غير حالة «بانتظار النشر»', function () {
  assert.equal(W.canMarkPublished({ status: 'pending', story_meta: {} }, { ok: true }).ok, false);
  assert.equal(W.canMarkPublished({ status: 'published', story_meta: {} }, { ok: true }).ok, false);
});

t('الدوال لا تغيّر المُدخل (immutability) وتحفظ المفاتيح الأخرى', function () {
  var meta = { karma_text: 'x', pending_draft: { a: 1 } };
  var snap = JSON.stringify(meta);
  var out = W.markPreviewSent(meta, NOW);
  assert.equal(JSON.stringify(meta), snap);
  assert.equal(out.karma_text, 'x');
  assert.deepEqual(out.pending_draft, { a: 1 });
});

t('حكاية منشورة لها مسودة معلّقة تبقى «تم النشر» مع تنبيه، ولا تُحسب مرتين', function () {
  var rec = { status: 'published', story_meta: { pending_draft: { title: 'جديد' } } };
  var s = W.stateOf(rec);
  assert.equal(s.state, 'published');
  assert.ok(s.warnings.indexOf('pending_draft_over_published') >= 0);
  assert.equal(W.group([rec]).published.length, 1);
});

t('markPublished يزيل pending_draft ويبقي بقية البيانات', function () {
  var m = W.markPublished({ pending_draft: { a: 1 }, keep: 1 }, NOW);
  assert.equal(m.pending_draft, undefined);
  assert.equal(m.keep, 1);
});

t('قيم غير متوقعة لا تكسر الحساب', function () {
  assert.equal(W.stateOf(null).state, 'editing');
  assert.equal(W.stateOf({}).state, 'editing');
  assert.ok(W.stateOf({ status: 'weird', story_meta: {} }).warnings.indexOf('unknown_status') >= 0);
  assert.ok(W.stateOf({ status: 'pending', story_meta: { preview_review: { decision: 'zzz' } } }).warnings.indexOf('unknown_decision') >= 0);
});

t('AI story package validator accepts a complete five-language package', function () {
  var langs = ['en', 'fr', 'it', 'de'];
  var translations = {};
  langs.forEach(function (lang) {
    translations[lang] = { student_name: 'Narrator', grade: 'Grade 7', title: 'Title',
      subtitle: 'Subtitle', karma_text: 'Karma asks a question', body: 'A complete translated story',
      history_note: 'Historical context', images_note: 'Image source and rights' };
  });
  var questions = [];
  for (var i = 0; i < 5; i++) {
    var i18n = {};
    langs.forEach(function (lang) { i18n[lang] = { q: 'Question ' + i, o: ['Option A', 'Option B'], e: 'Explanation' }; });
    questions.push({ q: 'Question ' + i, o: ['Option A', 'Option B'], a: 0, e: 'Explanation', i18n: i18n });
  }
  var pkg = { format: 'KH_STORY_PACKAGE_V1', section_key: 'history', figure_name: 'Test figure',
    title: 'A complete story', subtitle: 'A full subtitle', narrator_name: 'Karma', narrator_grade: 'Grade 7',
    original_body: 'This is the preserved original story text.', karma_text: 'Karma asks why history matters.',
    body: 'A complete narrator story with more than fifty characters for validation.',
    history_note: 'Context and verification notes.', sources: 'A verified source URL https://example.org/source',
    images_note: 'Historical image attribution and license notes.', visual_design: 'ancient-civilization',
    images: [
      {url:'https://images.example/a.jpg',alt:'Image A',caption:'Caption A',kind:'illustration',source_name:'Source A',source_url:'https://example.org/a',rights:'License noted',i18n:Object.fromEntries(langs.map(function(lang){return [lang,{alt:'Image A '+lang,caption:'Caption A '+lang}]}))},
      {url:'https://images.example/b.jpg',alt:'Image B',caption:'Caption B',kind:'diagram',source_name:'Source B',source_url:'https://example.org/b',rights:'License noted',i18n:Object.fromEntries(langs.map(function(lang){return [lang,{alt:'Image B '+lang,caption:'Caption B '+lang}]}))}
    ], translations: translations, question_bank: { questions: questions } };
  assert.equal(W.validateStoryPackage(pkg).ok, true);
  delete pkg.translations.de.body;
  var missingTranslation = W.validateStoryPackage(pkg);
  assert.equal(missingTranslation.ok, false);
  assert.ok(missingTranslation.errors.some(function (e) { return e.indexOf('DE: حقل نص الراوي') >= 0; }));
  pkg.translations.de.body = 'A complete translated story';
  delete pkg.question_bank.questions[0].i18n.it.o;
  var missingQuizTranslation = W.validateStoryPackage(pkg);
  assert.equal(missingQuizTranslation.ok, false);
  assert.ok(missingQuizTranslation.errors.some(function (e) { return e.indexOf('ترجمة السؤال أو الاختيارات أو التفسير ناقصة في IT') >= 0; }));
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', with FAILURES' : ''));
