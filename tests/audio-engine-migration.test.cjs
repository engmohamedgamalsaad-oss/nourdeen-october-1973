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
  assert.match(source, /feat\/omnivoice-only-audio-cleanup-20261111/);
  assert.doesNotMatch(source, /feat\/omnivoice-unified-audio/);
});
