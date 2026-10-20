/* Contract/integration checks for the story workflow. Run:
   node khaledoon/tests/story-workflow-integration.test.js
   No network, browser, or real Supabase writes are used. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var W = require('../assets/story-workflow.js');
var admin = fs.readFileSync('khaledoon/admin.html', 'utf8');
var builder = fs.readFileSync('khaledoon/story-builder.html', 'utf8');
var preview = fs.readFileSync('khaledoon/preview.html', 'utf8');
var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
var favicon = fs.readFileSync('khaledoon/assets/admin-favicon.svg', 'utf8');
var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok - ' + name); }
  catch (e) { console.error('FAIL - ' + name + '\n' + e.stack); process.exitCode = 1; }
}
function mockPatch(record, patch) {
  /* In-memory replacement for a Supabase PATCH; never calls fetch or a server. */
  return Object.assign({}, record, patch);
}
test('admin imports the workflow module and derives status counters', function () {
  assert.ok(admin.includes('src="assets/story-workflow.js"'));
  assert.ok(admin.includes('window.KHWorkflow.counters(visibleAdminRecords,sitePageItems)'));
  assert.ok(admin.includes("itemState(i)===fStatus"));
  assert.ok(!admin.includes('handleStoryPreviewDecision'));
});
test('admin uses its actual crimson book favicon asset', function () {
  assert.ok(admin.includes('type="image/svg+xml" href="/nourdeen-october-1973/khaledoon/assets/admin-favicon.svg"'));
  assert.ok(favicon.includes('viewBox="0 0 64 64"'));
  assert.ok(favicon.includes('fill="#8f1728"'));
  assert.ok(favicon.includes('<path'));
});
test('admin links submissions to static pages by explicit identifier only', function () {
  assert.ok(admin.includes('window.KHWorkflow.linkedSite(it,vStories)'));
  assert.ok(!admin.includes('norm(s.title)===t'));
  assert.ok(admin.includes('items=visibleRecords.concat(sitePageItems)'));
  assert.ok(admin.includes('window.KHWorkflow.linkedSite(record,sitePageItems)'));
});
test('published stories cannot be deleted and deleting drafts never hides static pages', function () {
  assert.ok(admin.includes("if(it._t!=='site'&&it.status!=='published')"));
  assert.ok(admin.includes("if(it&&it.status==='published'){say('err','ممنوع حذف سجل حكاية منشورة من هذه القائمة؛ استخدم «إخفاء» فقط.');return}"));
  var removeItemBlock = admin.slice(admin.indexOf('async function removeItem'), admin.indexOf('async function remove(it,btn)'));
  var removeBlock = admin.slice(admin.indexOf('async function remove(it,btn)'), admin.indexOf('function copyKey'));
  assert.ok(!removeItemBlock.includes('await hideStaticStoryBeforeDelete(it)'));
  assert.ok(!removeBlock.includes('await hideStaticStoryBeforeDelete(it)'));
  assert.ok(!admin.includes('hideStaticStoryBeforeDelete'));
  assert.ok(admin.includes("if(it.status!=='published'){delBtn.type='button';bar.appendChild(delBtn)}else{delBtn.hidden=true;delBtn.disabled=true}"));
  assert.ok(admin.includes("if(it._t!=='site'&&it.status!=='published')"));
  assert.ok(admin.includes('var visibleRecords=adminRecords.filter(function(record){return !linkedPublished[String(record.id)]})'));
});
test('manual builder merges metadata and protects original body', function () {
  assert.ok(builder.includes('Object.assign({},currentMeta||{})'));
  assert.ok(builder.includes('(currentRecord&&currentRecord.original_body)||d.original_body'));
  assert.ok(builder.includes('window.KHWorkflow.markPreviewSent(meta,new Date())'));
  assert.ok(!builder.includes('kh-story-preview-decision'));
});
test('preview requires rejection reason and calls workflow transitions', function () {
  assert.ok(preview.includes('id="rejectionReason"'));
  assert.ok(preview.includes('window.KHWorkflow.markPreviewRejected(meta,rejectionReason,new Date())'));
  assert.ok(preview.includes('window.KHWorkflow.markApproved(meta'));
  assert.ok(preview.includes('تمت المعاينة بنجاح'));
  assert.ok(preview.includes('رفض المعاينة'));
});
test('reader-template preview keeps translations and disables reaction writes', function () {
  assert.ok(bundle.includes('renderPreviewHtml:renderPreviewHtml'));
  assert.ok(bundle.includes("translatedRows(d,'preview')"));
  assert.ok(bundle.includes('reactions.js'));
  assert.ok(bundle.includes('معاينة خاصة غير منشورة'));
});
['manual','AI'].forEach(function (mode) {
  test(mode + ' path: save, reject, resend, approve, failed verification, publish', function () {
    var original = 'النص الأصلي الثابت الذي لا يجوز تغييره';
    var record = { id: mode, status: 'pending', original_body: original,
      body: 'نسخة تحريرية', consent: true, admin_notes: 'ملاحظة محفوظة',
      story_meta: { source_mode: mode, manual_builder: mode === 'manual',
        preview_review: { decision: 'sent' } } };
    var totalBefore = 1;
    record.story_meta = W.markPreviewRejected(record.story_meta, 'أضف مصدرًا موثوقًا', new Date('2026-10-20T10:00:00Z'));
    record = mockPatch(record, { status: 'pending', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'preview_rejected');
    assert.equal(record.story_meta.preview_review.reason, 'أضف مصدرًا موثوقًا');
    assert.equal(record.original_body, original);
    assert.equal(record.consent, true);
    assert.equal(record.admin_notes, 'ملاحظة محفوظة');
    record.story_meta = W.markPreviewSent(record.story_meta, new Date('2026-10-20T10:01:00Z'));
    record = mockPatch(record, { story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'preview_sent');
    record.story_meta = W.markApproved(record.story_meta, { static_story_id: '099', static_story_path: 'stories/history/099/' }, new Date('2026-10-20T10:02:00Z'));
    record = mockPatch(record, { status: 'review', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'awaiting_publish');
    record.story_meta = W.markPublishCheckFailed(record.story_meta, 'HTTP 404', new Date('2026-10-20T10:03:00Z'));
    record = mockPatch(record, { story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'awaiting_publish');
    assert.equal(record.story_meta.preview_review.publish_error.reason, 'HTTP 404');
    assert.equal(W.canMarkPublished(record, { ok: false }).ok, false);
    assert.equal(W.canMarkPublished(record, { ok: true }).ok, true);
    record.story_meta = W.markPublished(record.story_meta, new Date('2026-10-20T10:04:00Z'));
    record = mockPatch(record, { status: 'published', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'published');
    assert.equal(record.original_body, original);
    assert.equal(W.group([record]).published.length, 1);
    assert.equal(W.ORDER.reduce(function (n, s) { return n + W.group([record])[s].length; }, 0), totalBefore);
  });
});
console.log('\n' + passed + ' integration checks passed' + (process.exitCode ? ', with failures' : ''));
