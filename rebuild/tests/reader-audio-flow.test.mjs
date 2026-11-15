import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const flow = await readFile(new URL('../reader-audio-flow.js', import.meta.url), 'utf8');

test('approved translations are restored only when source hash and speaker still match', () => {
  assert.match(flow, /async function sha256Trim\(value\)/);
  assert.match(flow, /async function restoreSavedTranslations\(\)/);
  assert.match(flow, /record\.status !== "approved"/);
  assert.match(flow, /record\.source_arabic_hash !== hash \|\| record\.speaker !== source\.speaker/);
  assert.match(flow, /translationWorkingText\[key\] = record\.translation_text/);
  assert.match(flow, /translationConfirmed\[key\] = true/);
});

test('translation generation stays blocked until a current approved translation is restored or prepared', () => {
  assert.match(flow, /!translationConfirmed\[currentTranslationKey\]/);
  assert.match(flow, /!String\(translationWorkingText\[currentTranslationKey\] \|\| ''\)\.trim\(\)/);
  assert.match(flow, /translation && translation\.status === 'approved' && translationConfirmed\[L \+ ':' \+ index\]/);
});

test('translation restore runs immediately after loading review records', () => {
  assert.match(flow, /translationRecords = data\.audio_review && data\.audio_review\.translations \|\| \{\};\s*var result = await restoreSavedTranslations\(\);\s*translationLoaded = true;/);
});
