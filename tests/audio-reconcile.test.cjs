const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

let ts = null;
try { ts = require('typescript'); } catch (e) { /* optional dev dependency */ }
const skip = ts ? false : 'typescript is not installed';

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/audio-review-assets/index.ts'), 'utf8');
function loadPure() {
  const a = source.indexOf('// <reconcile-pure>'), b = source.indexOf('// </reconcile-pure>');
  assert.ok(a > 0 && b > a, 'reconcile-pure markers');
  const js = ts.transpileModule(source.slice(a, b), { compilerOptions: { target: 'ES2022' } }).outputText;
  const sha256Hex = (bytes) => Promise.resolve(crypto.createHash('sha256').update(bytes).digest('hex'));
  return new Function('sha256Hex', js + '; return { reconcilePlan, storyFromSnapshot, isSpeakableBlock };')(sha256Hex);
}
const h = (t) => crypto.createHash('sha256').update(String(t).trim()).digest('hex');
const blk = (speaker, text) => ({ speaker, text });
const snapOf = (ar, en) => ({ section: 's', slug: 'x', blocks: Object.assign({ ar }, en ? { en } : {}) });
const speechRec = (i, speaker, text, approved) => ({ language: 'ar', block_index: i, speaker, source_text_hash: h(text), suggested_text: approved, approved_text: approved, status: 'approved' });
const seg = (i, speaker, text, name) => ({ src: name, block_index: i, chunk_index: 0, speaker, text, provider: 'omnivoice', model: 'VoiceTut Egyptian Tashkeel', voice: 'v', audio_sha256: 'a'.repeat(64) });

test('unchanged story: nothing changes', { skip }, async () => {
  const { reconcilePlan, storyFromSnapshot } = loadPure();
  const ar = [blk('karma', 'أ'), blk('narrator', 'ب')];
  const review = { version: 1, regen: {}, audio_hashes: {}, clips: { k0: { lang: 'ar', block_index: 0, chunk_index: 0, speaker: 'karma', text: 'أ!', status: 'accepted' } },
    speech_texts: { 'ar:0': speechRec(0, 'karma', 'أ', 'أ!'), 'ar:1': speechRec(1, 'narrator', 'ب', 'ب!') } };
  const manifests = { ar: { segments: [seg(0, 'karma', 'أ!', 'a0.mp3'), seg(1, 'narrator', 'ب!', 'a1.mp3')] } };
  const plan = await reconcilePlan(review, storyFromSnapshot(snapOf(ar), 's', 'x'), manifests);
  assert.equal(plan.changed, false);
});

test('swapping two blocks moves approved text and audio, drops only the moved decisions', { skip }, async () => {
  const { reconcilePlan, storyFromSnapshot } = loadPure();
  const ar = [blk('narrator', 'ب'), blk('karma', 'أ'), blk('narrator', 'ج')];   // was: أ ب ج  (karma,narrator,narrator)
  const review = { version: 1, regen: {}, audio_hashes: {}, clips: {
      c0: { lang: 'ar', block_index: 0, chunk_index: 0, speaker: 'karma', text: 'أ!', status: 'accepted' },
      c2: { lang: 'ar', block_index: 2, chunk_index: 0, speaker: 'narrator', text: 'ج!', status: 'accepted' } },
    speech_texts: { 'ar:0': speechRec(0, 'karma', 'أ', 'أ!'), 'ar:1': speechRec(1, 'narrator', 'ب', 'ب!'), 'ar:2': speechRec(2, 'narrator', 'ج', 'ج!') } };
  const manifests = { ar: { segments: [seg(0, 'karma', 'أ!', 'a0.mp3'), seg(1, 'narrator', 'ب!', 'a1.mp3'), seg(2, 'narrator', 'ج!', 'a2.mp3')] } };
  const plan = await reconcilePlan(review, storyFromSnapshot(snapOf(ar), 's', 'x'), manifests);
  assert.equal(plan.changed, true);
  assert.equal(plan.review.speech_texts['ar:0'].approved_text, 'ب!');
  assert.equal(plan.review.speech_texts['ar:1'].approved_text, 'أ!');
  assert.equal(plan.review.speech_texts['ar:1'].block_index, 1);
  assert.equal(plan.review.speech_texts['ar:2'].approved_text, 'ج!');
  const segs = plan.manifests.ar.segments;
  assert.deepEqual(segs.map((x) => [x.block_index, x.src]), [[0, 'a1.mp3'], [1, 'a0.mp3'], [2, 'a2.mp3']]);
  assert.deepEqual(Object.keys(plan.review.clips), ['c2']);          // c0 (moved) dropped, c2 (same place, same text) kept
  assert.equal(plan.summary.clips_dropped, 1);
});

test('removing a block drops its stale text/audio/decision and shifts the rest', { skip }, async () => {
  const { reconcilePlan, storyFromSnapshot } = loadPure();
  const ar = [blk('karma', 'أ'), blk('narrator', 'ج')];                // ب removed
  const review = { version: 1, regen: {}, audio_hashes: {}, clips: { c1: { lang: 'ar', block_index: 1, chunk_index: 0, speaker: 'narrator', text: 'ب!', status: 'accepted' } },
    speech_texts: { 'ar:0': speechRec(0, 'karma', 'أ', 'أ!'), 'ar:1': speechRec(1, 'narrator', 'ب', 'ب!'), 'ar:2': speechRec(2, 'narrator', 'ج', 'ج!') } };
  const manifests = { ar: { segments: [seg(0, 'karma', 'أ!', 'a0.mp3'), seg(1, 'narrator', 'ب!', 'a1.mp3'), seg(2, 'narrator', 'ج!', 'a2.mp3')] } };
  const plan = await reconcilePlan(review, storyFromSnapshot(snapOf(ar), 's', 'x'), manifests);
  assert.deepEqual(Object.keys(plan.review.speech_texts).sort(), ['ar:0', 'ar:1']);
  assert.equal(plan.review.speech_texts['ar:1'].approved_text, 'ج!');
  assert.deepEqual(plan.manifests.ar.segments.map((x) => [x.block_index, x.src]), [[0, 'a0.mp3'], [1, 'a2.mp3']]);
  assert.equal(Object.keys(plan.review.clips).length, 0);
});

test('an edited block keeps old audio flagged as stale (never silently accepted) and loses its approved text', { skip }, async () => {
  const { reconcilePlan, storyFromSnapshot } = loadPure();
  const ar = [blk('karma', 'أ جديد')];
  const review = { version: 1, regen: {}, audio_hashes: {}, clips: { c0: { lang: 'ar', block_index: 0, chunk_index: 0, speaker: 'karma', text: 'أ!', status: 'accepted' } },
    speech_texts: { 'ar:0': speechRec(0, 'karma', 'أ', 'أ!') } };
  const manifests = { ar: { segments: [seg(0, 'karma', 'أ!', 'a0.mp3')] } };
  const plan = await reconcilePlan(review, storyFromSnapshot(snapOf(ar), 's', 'x'), manifests);
  assert.equal(plan.review.speech_texts['ar:0'], undefined);
  assert.equal(Object.keys(plan.review.clips).length, 0);
  assert.equal(plan.manifests.ar, undefined);                          // segment kept in place; the page flags it as stale
});

test('English follows block text; a removed last block drops its manifest segment', { skip }, async () => {
  const { reconcilePlan, storyFromSnapshot } = loadPure();
  const en = [blk('narrator', 'Two'), blk('karma', 'One')];            // swapped
  const manifests = { en: { segments: [seg(0, 'karma', 'One', 'e0.mp3'), seg(1, 'narrator', 'Two', 'e1.mp3'), seg(2, 'narrator', 'Gone', 'e2.mp3')] } };
  const plan = await reconcilePlan(null, storyFromSnapshot(snapOf([], en), 's', 'x'), manifests);
  assert.deepEqual(plan.manifests.en.segments.map((x) => [x.block_index, x.src]), [[0, 'e1.mp3'], [1, 'e0.mp3']]);
  assert.equal(plan.summary.segments_dropped, 1);
});

test('snapshot validation rejects a mismatched story identity', { skip }, () => {
  const { storyFromSnapshot } = loadPure();
  assert.equal(storyFromSnapshot({ section: 'a', slug: 'b', blocks: { ar: [] } }, 'a', 'c'), null);
  assert.equal(storyFromSnapshot(null, 'a', 'b'), null);
});
