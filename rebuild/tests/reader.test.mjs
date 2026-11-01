import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../reader.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../reader.js', import.meta.url), 'utf8');
const builder = await readFile(new URL('../build-story.mjs', import.meta.url), 'utf8');
const baseCss = await readFile(new URL('../reader-base.css', import.meta.url), 'utf8');

test('unified reader exposes all five language choices and changes text direction', () => {
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) assert.match(html, new RegExp('data-lang="' + lang + '"'));
  assert.match(js, /current==='ar'\?'rtl':'ltr'/);
  assert.match(js, /localStorage\.setItem\('kh-lang',current\)/);
  assert.match(js, /sectionLabels\[current\]\[story\.section\]/);
  assert.match(js, /readerScript\.dataset\.storyPath\?document\.baseURI:ROOT/);
  assert.match(js, /openstreetmap\.org/);
  assert.match(js, /document\.body\.dataset\.design/);
  assert.match(html, /id="theme-toggle"/);
  assert.ok(baseCss.includes('Marhey,Cairo,Arial,sans-serif'), 'reader headings need a sans-serif fallback when external fonts are blocked');
  assert.match(html, /reader-base\.css\?v=20261030-shared-reader-1/);
  assert.match(js, /themeLight/);
  assert.match(js, /dataset\.theme/);
  assert.match(js, /j===q\.correct_option/);
  assert.match(js, /lang\.options\[q\.correct_option\]/);
});

test('unified reader renders story, gallery, quiz and source sections from one package', () => {
  for (const id of ['title', 'subtitle', 'summary', 'blocks', 'gallery', 'quiz', 'sources', 'map-section', 'map-link', 'story-intro-modal', 'intro-start', 'story-actions', 'print-story', 'share-whatsapp', 'share-facebook', 'share-copy', 'reaction-like', 'reaction-status', 'image-lightbox', 'intro-cover-fallback']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.ok(baseCss.includes('body[data-design=ancient-civilization]'));
  assert.match(js, /!\['KHALEDOON_STORY','KHALEDOON_STORY_V2'\]\.includes\(data\.format\)/);
  assert.match(js, /SECTION_PALETTE/);
  assert.match(js, /initReactions/);
  assert.match(js, /openLightbox/);
  assert.match(js, /showImageFallback/);
});

test('unified reader refuses to silently fall back to a legacy package', () => {
  assert.match(js, /لم يتم الرجوع تلقائيًا إلى أي صيغة قديمة/);
  assert.match(js, /data\.i18n\[l\]/);
});

test('story text is inserted as text and source links are isolated', () => {
  assert.match(js, /p\.textContent=b\.text/);
  assert.match(js, /a\.rel='noopener noreferrer'/);
  assert.match(js, /img\.alt=d\.alt/);
});

test('static builder validates story packages and will not overwrite existing story pages', () => {
  assert.match(builder, /validateStory/);
  assert.match(builder, /validateLocalImagePaths/);
  assert.match(builder, /validateStory\(story\)/);
  assert.match(builder, /Refusing to overwrite existing/);
  assert.match(builder, /story\.json/);
  assert.match(builder, /reader\.js\?v=20261030-shared-reader-1/);
  assert.match(html, /reader\.js\?v=20261030-shared-reader-1/);
});
