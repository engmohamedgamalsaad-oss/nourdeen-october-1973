import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../reader.html', import.meta.url), 'utf8');

test('V2 reader exposes all five language choices and direction handling', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) assert.match(html, new RegExp('data-lang="' + lang + '"'));
  assert.match(html, /current==='ar'\?'rtl':'ltr'/);
});

test('V2 reader renders required story sections from one package', () => {
  for (const id of ['title', 'subtitle', 'summary', 'blocks', 'gallery', 'quiz', 'sources']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /data\.format!=='KHALEDOON_STORY_V2'/);
});

test('V2 reader refuses to silently fall back to a legacy package', () => {
  assert.match(html, /لم يتم الرجوع تلقائيًا إلى أي صيغة قديمة/);
  assert.match(html, /data\.i18n\[l\]/);
});

test('story and source content are inserted as text, and source links are isolated', () => {
  assert.match(html, /p\.textContent=b\.text/);
  assert.match(html, /a\.rel='noopener noreferrer'/);
  assert.match(html, /img\.alt=d\.alt/);
});
