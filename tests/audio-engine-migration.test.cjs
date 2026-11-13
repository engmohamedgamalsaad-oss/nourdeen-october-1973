const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../khaledoon/assets/audio-review-core.js');

test('Arabic and English default to the unified OmniVoice provider', () => {
  for (const language of ['ar', 'en']) {
    assert.deepEqual(core.engineOf(language, 'karma'), {
      voice: 'omnivoice-karma-reference',
      provider: 'omnivoice',
      model: 'VoiceTut Egyptian Tashkeel'
    });
    assert.deepEqual(core.engineOf(language, 'narrator'), {
      voice: 'omnivoice-narrator-reference',
      provider: 'omnivoice',
      model: 'VoiceTut Egyptian Tashkeel'
    });
  }
});

test('active review, player and worker endpoints reject legacy Fish Audio IDs/providers', () => {
  const files = [
    'khaledoon/assets/audio-review-core.js',
    'rebuild/reader-audio-review.js',
    'assets/shared/story-audio.js',
    'supabase/functions/audio-review-assets/index.ts'
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /fish-audio|s2\.1-pro-free|592625f68416462f8b6161ddf5fdbffb|a02a8220d6014812aa5ff73434c54cc0/i, file);
  }
});

test('public player has no fallback to the legacy static audio tree', () => {
  const source = fs.readFileSync(path.join(root, 'assets/shared/story-audio.js'), 'utf8');
  assert.doesNotMatch(source, /legacyManifestUrl|\.\.\/\.\.\/\.\.\/assets\/audio/);
});

test('Colab notebook loads the unified engine from the active migration branch', () => {
  const notebook = JSON.parse(fs.readFileSync(path.join(root, 'notebooks/Khaledoon_OmniVoice_Unified_Worker.ipynb'), 'utf8'));
  const source = notebook.cells.flatMap(cell => cell.source || []).join('');
  assert.match(source, /ENGINE_BRANCH = 'main'/);
  assert.doesNotMatch(source, /feat\/omnivoice-unified-audio|feat\/omnivoice-only-audio-cleanup/);
});

test('audio-only rejection advances the regeneration revision for that exact clip', () => {
  const entry = {
    key: 'clip-original', story_id: 'history/ibn-sina', lang: 'ar',
    block_index: 4, chunk_index: 0, speaker: 'narrator',
    base: 'base-hash-4', text: 'approved speech text', audio_sha256: 'a'.repeat(64)
  };
  const rejected = core.applyDecision(core.emptyReview(), entry, {
    status: 'rejected', issue: 'audio_only', note: 'الصوت غير مناسب'
  });
  const bumped = core.bumpAudioOnly(rejected);
  assert.equal(bumped.bumped, 1);
  assert.equal(bumped.review.regen['base-hash-4'], 1);
  assert.equal(bumped.review.clips['clip-original'].bumped, true);
  assert.equal(bumped.review.clips['clip-original'].text, 'approved speech text');
});

test('admin review exposes a same-block regeneration action after audio-only rejection', () => {
  const source = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');
  assert.match(source, /next = core\.bumpAudioOnly\(next\)\.review/);
  assert.match(source, /generateNextQueuedBlock\(entry\.lang, state, regenerateBtn, entry\.block_index\)/);
  assert.match(source, /إعادة توليد هذا المقطع/);
});

test('generateNextQueuedBlock is defined, not only called', () => {
  const source = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');
  assert.match(source, /async function generateNextQueuedBlock\(language, statusNode, button, index\)/);
});
