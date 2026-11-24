import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const flow = await readFile(new URL('../reader-audio-flow.js', import.meta.url), 'utf8');

test('current translation drafts and approvals are restored only when source hash and speaker still match', () => {
  assert.match(flow, /async function sha256Trim\(value\)/);
  assert.match(flow, /async function restoreSavedTranslations\(\)/);
  assert.match(flow, /!\["approved", "draft"\]\.includes\(record\.status\)/);
  assert.match(flow, /record\.source_arabic_hash !== hash \|\| record\.speaker !== source\.speaker/);
  assert.match(flow, /translationWorkingText\[key\] = record\.translation_text/);
  assert.match(flow, /translationConfirmed\[key\] = true/);
});

test('translation generation stays blocked until a current approved translation is restored or prepared', () => {
  assert.match(flow, /!translationConfirmed\[currentTranslationKey\]/);
  assert.match(flow, /!String\(translationWorkingText\[currentTranslationKey\] \|\| ''\)\.trim\(\)/);
  assert.match(flow, /translation && translation\.status === 'approved' && translationConfirmed\[translationKey\]/);
  assert.match(flow, /s1 = translationState === 'processing'/);
  assert.match(flow, /label: 'النص', s: s1\.s, t: s1\.t/);
  assert.match(flow, /label: 'نص القراءة', s: s2\.s, t: s2\.t/);
});

test('translation restore runs immediately after loading review records', () => {
  assert.match(flow, /translationRecords = data\.audio_review && data\.audio_review\.translations \|\| \{\};\s*var result = await restoreSavedTranslations\(\);\s*translationStates = Object\.create\(null\);[\s\S]*?translationLoaded = true;/);
});
