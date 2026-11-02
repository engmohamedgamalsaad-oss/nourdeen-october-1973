import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../package-review.html', import.meta.url), 'utf8');
const readerHtml = await readFile(new URL('../reader.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

test('package review page has one syntactically valid local script', () => {
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0]));
});

test('package review performs no network or remote publish writes and stores only the draft package', () => {
  const script = scripts.join('\n');
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|localStorage\.(?:removeItem|clear)\s*\(|sessionStorage|indexedDB|supabase|github\.com\/repos/i);
  assert.match(script, /localStorage\.setItem\('kh-story-review-package'/);
  assert.match(script, /localStorage\.getItem\('kh-story-review-package'\)/);
  assert.match(script, /get\('draft'\)==='1'/);
  assert.match(html, /لا يتم النشر من هذه النافذة/);
  assert.match(html, /type="file" accept="\.json,application\/json"/);
});

test('package review hands canonical packages to the real five-language reader', () => {
  assert.match(html, /reader\.html\?draft=1/);
  assert.doesNotMatch(html, /id="preview"/);
  assert.match(scripts[0], /location\.replace/);
  assert.match(scripts[0], /KHALEDOON_STORY/);
  assert.match(scripts[0], /textContent/);
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) assert.match(readerHtml, new RegExp('data-lang="' + lang + '"'));
  assert.match(readerHtml, /id="map-section"/);
  assert.match(readerHtml, /id="original-body"/);
  assert.match(readerHtml, /id="blocks"/);
  assert.match(readerHtml, /id="quiz-section"/);
});
