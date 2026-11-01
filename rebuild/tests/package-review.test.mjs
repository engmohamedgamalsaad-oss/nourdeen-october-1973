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
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|localStorage\.(?:setItem|removeItem|clear)\s*\(|sessionStorage|indexedDB|supabase|github\.com\/repos/i);
  assert.match(script, /localStorage\.getItem\('kh-v2-review-package'\)/);
  assert.match(script, /get\('draft'\)==='1'/);
  assert.match(html, /لا تحفظ على Supabase ولا تنشر/);
  assert.match(html, /type="file" accept="\.json,application\/json"/);
});

test('package review page exposes all five locales and displays data through textContent', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) assert.match(html, new RegExp('value="' + lang + '"'));
  assert.match(scripts[0], /textContent/);
  assert.match(scripts[0], /function link\(url,label\)\{if\(typeof url!==.*https:/);
  assert.match(scripts[0], /رابط مصدر الصورة/);
  assert.match(scripts[0], /رابط المصدر/);
  assert.match(scripts[0], /KHALEDOON_STORY/);
  assert.match(scripts[0], /src\.i18n/);
  assert.match(html, /id="map-section"/);
  assert.match(html, /id="original-body"/);
  assert.match(scripts[0], /\$\('original-body'\)\.textContent=story\.original_body/);
  assert.match(scripts[0], /story\.map_location/);
  assert.match(scripts[0], /openstreetmap\.org/);
  assert.match(scripts[0], /خمسة أسئلة/);
});
