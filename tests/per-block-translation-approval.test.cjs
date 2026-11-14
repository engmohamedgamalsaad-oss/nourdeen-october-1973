const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = fs.readFileSync(path.join(root, 'supabase/functions/audio-review-assets/index.ts'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'scripts/omnivoice_engine/worker.py'), 'utf8');
const notebook = JSON.parse(fs.readFileSync(path.join(root, 'notebooks/Khaledoon_OmniVoice_Unified_Worker.ipynb'), 'utf8'));
const notebookCode = notebook.cells.filter(cell => cell.cell_type === 'code').map(cell => Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')).join('\n');
const publicAudio = fs.readFileSync(path.join(root, 'assets/shared/story-audio.js'), 'utf8');
const storyReader = fs.readFileSync(path.join(root, 'rebuild/reader.js'), 'utf8');

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

test('public audio player accepts normal MP3 filenames and uses a fresh cache key', () => {
  assert.ok(publicAudio.includes("!/^[A-Za-z0-9_-]+\\.mp3$/.test"), 'MP3 validation must escape the dot once, not twice');
  assert.match(storyReader, /story-audio\.js\?v=20261114-public-audio-mp3-fix-1/);
});

test('the single Colab notebook registers both voices and the admin preview reports worker presence', () => {
  assert.match(notebookCode, /registry\.register\(KarmaProvider/);
  assert.match(notebookCode, /registry\.register\(NarratorProvider/);
  assert.match(notebookCode, /run_worker\(client, voice_model, registry/);
  assert.match(engine, /registry\.get\(job\.get\("speaker"\)\)/);
  assert.match(preview, /fetchWorkerStatus/);
  assert.match(preview, /story-audio-worker/);
  assert.match(preview, /workerOnline === false/);
});
