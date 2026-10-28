import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../reader.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../reader.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../reader-enhance.css', import.meta.url), 'utf8');
const baseCss = await readFile(new URL('../reader-base.css', import.meta.url), 'utf8');
const builder = await readFile(new URL('../build-story.mjs', import.meta.url), 'utf8');
const validator = await readFile(new URL('../validate-story.mjs', import.meta.url), 'utf8');
const sectionMatch = validator.match(/const sections = new Set\(\[([^\]]+)\]/);
assert.ok(sectionMatch, 'validator exposes the canonical section contract');
const sections = [...sectionMatch[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]);

test('every canonical section has a motif and a restrained reveal choice', () => {
  const motif = js.match(/SECTION_MOTIF=\{([^}]+)\}/)?.[1] || '';
  const reveals = js.match(/REVEALS=\{([\s\S]+?)\};\nvar statLabels/)?.[1] || '';
  for (const section of sections) {
    assert.match(motif, new RegExp(section + ':'), section + ' motif');
    assert.match(reveals, new RegExp(section + ':\\['), section + ' reveal');
  }
  assert.match(js, /enhance\(t\);/, 'enhancement runs after story content is rendered');
});

test('visual additions are additive and support RTL/LTR, light/dark and reduced motion', () => {
  for (const motif of ['steps', 'arrows', 'halo', 'diamonds', 'square', 'num']) {
    assert.match(css, new RegExp('data-motif=' + motif), motif);
  }
  assert.match(css, /html\[dir=rtl\]/);
  assert.match(css, /html\[dir=ltr\]/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.kh-progress\{/);
  assert.doesNotMatch(css, /(^|\n)(body|header|main|\.hero|\.section|h1|h2)\s*\{/, 'base page rules must not be replaced');
  assert.match(html, /reader\.js\?v=20261028-v2-reader-4/);
  assert.match(js, /reader-enhance\.css\?v=20261028-v2-enhance-5/);
});

test('all five language labels exist and language/theme changes do not replay entrance animations', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) {
    assert.match(js, new RegExp(lang + ":\\['"), lang + ' labels');
  }
  assert.match(js, /if\(enhanceShown\)\{body\.classList\.remove\('kh-motion'\);return\}/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  for (const section of sections) assert.match(css, new RegExp('body\\[data-section=' + section + '\\]'), section + ' section palette');
  assert.match(css, /\.story-intro-modal/);
  assert.match(css, /\.image-lightbox/);
  assert.match(css, /@media print/);
  assert.match(css, /#blocks \.block\{background:color-mix/);
  assert.match(css, /\.kh-image-fallback/);
});
