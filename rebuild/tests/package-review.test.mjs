import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../package-review.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

test('package review page has one syntactically valid local script', () => {
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0]));
});

test('package review page makes no network, storage, or publish writes', () => {
  const script = scripts.join('\n');
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|supabase|github\.com\/repos/i);
  assert.match(html, /لا تحفظ على Supabase ولا تنشر/);
  assert.match(html, /type="file" accept="\.json,application\/json"/);
});

test('package review page exposes all five locales and displays data through textContent', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) assert.match(html, new RegExp('value="' + lang + '"'));
  assert.match(scripts[0], /textContent/);
  assert.match(scripts[0], /KHALEDOON_STORY_V2/);
  assert.match(scripts[0], /src\.i18n/);
  assert.match(html, /id="map-section"/);
  assert.match(scripts[0], /story\.map_location/);
  assert.match(scripts[0], /openstreetmap\.org/);
  assert.match(scripts[0], /خمسة أسئلة/);
});
