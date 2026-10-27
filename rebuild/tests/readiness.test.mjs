import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gate = await readFile(new URL('../../scripts/check-new-story-readiness.js', import.meta.url), 'utf8');
const cli = await readFile(new URL('../validate-package.mjs', import.meta.url), 'utf8');

test('new V2 story pages use the canonical package and bypass V1-only requirements', () => {
  assert.match(gate, /data-story-path=\["']data\\\.v2\\\.json\["']/);
  assert.match(gate, /data\.v2\.json/);
  assert.match(gate, /V2 is canonical/);
  assert.match(gate, /continue;/);
});

test('V2 package readiness invokes the strict shared validator', () => {
  assert.match(gate, /rebuild\/validate-package\.mjs/);
  assert.match(cli, /validateStory/);
  assert.match(cli, /validateLocalImagePaths/);
  assert.match(cli, /KHALEDOON_STORY_V2/);
});
