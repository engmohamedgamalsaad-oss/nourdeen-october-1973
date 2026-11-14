const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = fs.readFileSync(path.join(root, 'supabase/functions/audio-review-assets/index.ts'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'scripts/omnivoice_engine/worker.py'), 'utf8');

test('translation generation is per block and stores drafts, never human approval', () => {
  assert.match(assets, /body\.action === "translation_generate"/);
  assert.match(assets, /source_arabic_hash: sourceHash, translation_text: translationText/);
  assert.match(assets, /status: "draft"/);
  assert.match(assets, /Save as a draft only/);
});

test('human translation approval is explicit and tied to the current Arabic source hash', () => {
  assert.match(assets, /body\.action === "translation_save"/);
  assert.match(assets, /source\.sourceTextHash !== body\.source_arabic_hash/);
  assert.match(assets, /status: decision/);
  assert.match(preview, /اعتماد الترجمة/);
  assert.match(preview, /translation_save/);
});

test('English audio cannot be queued or published from an unapproved or stale translation', () => {
  assert.match(assets, /translation\.status !== "approved"/);
  assert.match(assets, /translation\.source_arabic_hash !== source\.sourceTextHash/);
  assert.match(assets, /enqueue_approved_language/);
  assert.match(assets, /لا يمكن نشر الصوت الإنجليزي/);
});

test('bulk queue preserves each Arabic block speaker for the unified Colab worker', () => {
  assert.match(assets, /speaker: block\.speaker/);
  assert.match(engine, /registry\.get\(job\.get\("speaker"\)\)/);
  assert.match(engine, /provider\.generate\(model/);
});
