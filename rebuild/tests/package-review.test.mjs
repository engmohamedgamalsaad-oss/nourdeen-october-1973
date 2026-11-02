import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../package-review.html', import.meta.url), 'utf8');
const readerHtml = await readFile(new URL('../reader.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const legacyHtml = await readFile(new URL('../package-review-legacy.html', import.meta.url), 'utf8');
const legacyScripts = [...legacyHtml.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

test('canonical package review page has one syntactically valid local script', () => {
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0]));
});

test('canonical review only hands the validated draft to the shared reader and never writes to services', () => {
  const script = scripts.join('\n');
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|sessionStorage|indexedDB|supabase|github\.com\/repos/i);
  assert.match(script, /localStorage\.getItem\('kh-story-review-package'\)/);
  assert.match(script, /localStorage\.setItem\('kh-story-review-package'/);
  assert.match(script, /location\.replace\('reader\.html\?draft=1/);
  assert.match(script, /location\.replace\('package-review-legacy\.html/);
  assert.match(script, /get\('draft'\)==='1'/);
  assert.match(html, /لا يتم النشر من هذه النافذة/);
});

test('canonical review checks all five locales, image/source metadata and quiz translations before handoff', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) {
    assert.match(readerHtml, new RegExp('data-lang="' + lang + '"'), 'shared reader language button: ' + lang);
    assert.match(legacyHtml, new RegExp('value="' + lang + '"'), 'October legacy preview language option: ' + lang);
  }
  assert.match(scripts[0], /textContent/);
  assert.match(scripts[0], /s\.format!=='KHALEDOON_STORY'/);
  assert.match(scripts[0], /s\.i18n&&s\.i18n\[l\]/);
  assert.match(scripts[0], /s\.sources\.length<2/);
  assert.match(scripts[0], /s\.quiz\.length<5/);
  assert.match(scripts[0], /for\(const l of langs\)/);
  assert.match(scripts[0], /خمسة أسئلة/);
});

test('October review remains on its legacy preview while that preview rejects non-October stories', () => {
  assert.match(scripts[0], /parsed\.section==='october'/);
  assert.match(scripts[0], /package-review-legacy\.html/);
  assert.match(legacyHtml, /id="preview"/);
  assert.match(legacyScripts.join('\n'), /parsed\.section!=='october'/);
});
