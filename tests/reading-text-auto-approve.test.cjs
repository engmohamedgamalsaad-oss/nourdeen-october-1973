const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/audio-review-assets/index.ts'), 'utf8');
const review = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');
const flow = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');

test('Gemini success is the default-approved reading text, with no extra approval step', () => {
  assert.match(review, /decision: 'approved', origin: 'gemini'/);
  assert.match(edge, /auto_approved: body\.origin === "gemini"/);
  assert.doesNotMatch(edge, /لا يمكن اعتماد نص مقطع خارج دوره/);
  assert.doesNotMatch(edge, /هذا المقطع لم يحن دوره بعد/);
});

test('rejection note is sent to Gemini automatically and regenerates only that block', () => {
  assert.match(review, /prepareSpeechText\(Number\(entry\.block_index\), followupStatusNode \|\| null, followupButton \|\| null, \{ autoQueue: true \}\)/);
  assert.match(review, /sendBlockToEngine\('ar', index, \{ regen: true \}\)/);
  assert.match(review, /retranslateBlock\(entry\.lang/);
  assert.doesNotMatch(review, /focusGeminiFollowup/);
});

test('any block can be queued out of turn (no order gate), and only its own public audio is withdrawn', () => {
  assert.match(edge, /invalidatePublicClipAudio\(service, section, slug, language, blockIndex\)/);
  assert.doesNotMatch(edge, /invalidatePublicStoryAudio\(service, section, slug\);\n\s*}\n\s*catch|try \{ await invalidatePublicStoryAudio/);
});

/* Queue behaviour (fresh job per rejection, no duplicates, failed-job retry, healthy keys unchanged)
   is covered by tests/reject-cycle-queue.test.ts with a mock Supabase client, not by source greps. */

test('client reports a real queue outcome, never a stale completed job', () => {
  assert.match(review, /var sent = await sendBlockToEngine\('ar', index, \{ regen: true \}\)/);
  assert.doesNotMatch(review, /\['pending', 'processing', 'completed'\]\.indexOf\(job\.status\) >= 0;\n\s*text\(statusNode, queued \? 'أُرسل هذا المقطع/);
});

test('manual reading-text edit is optional and never queues audio by itself', () => {
  assert.match(review, /حفظ تعديلي \(اختياري\)/);
  const fn = review.slice(review.indexOf('async function approveSpeechText'), review.indexOf('function speechBadgeText'));
  assert.doesNotMatch(fn, /generateNextQueuedBlock|sendBlockToEngine/);
});

test('language-specific audio controls are shown in the story preview and gated per language', () => {
  assert.match(flow, /'kh-translation-bulk-generate', 'الترجمة'/);
  assert.match(flow, /kh-language-audio-batch/);
  assert.match(flow, /kh-language-audio-generate/);
  assert.match(flow, /kh-language-audio-review/);
  assert.match(flow, /action: 'enqueue_approved_language'/);
  assert.match(review, /canQueueLanguage: async function/);
  assert.match(review, /canReviewLanguage: function/);
  assert.doesNotMatch(flow, /kh-translation-queue-all/);
  assert.match(flow, /"kh-translation-generate", "إعادة الترجمة"/);
  assert.match(review, /iconButton\('spark', 'إعادة الترجمة'/);
  assert.match(flow, /prepareAllSpeechTexts/);
});

test('approved voices and engines are untouched', () => {
  assert.doesNotMatch(edge + review + flow, /fish|s2\.1-pro-free|a02a8220d6014812aa5ff73434c54cc0/i);
});
