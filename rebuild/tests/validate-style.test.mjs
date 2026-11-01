import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStyle, SECTION_ACCENTS, DID_YOU_KNOW_MARKERS } from '../validate-style.mjs';

const langs = ['ar', 'en', 'fr', 'it', 'de'];
// Deterministic pseudo-text per language so languages are never identical and non-Arabic has no Arabic letters.
const filler = (lang, n) => (lang === 'ar' ? 'كلمة '.repeat(n) : lang + ' word '.repeat(n)).trim();

// 12 blocks: K N N(H) N N(H,img) K? -> keep Karma at 0, 6 and 10.
const plan = [
  ['karma', 'paragraph', 0, null], ['narrator', 'paragraph', 1, null], ['narrator', 'paragraph', 0, null],
  ['narrator', 'did_you_know', 0, null], ['narrator', 'paragraph', 1, 'image-1'], ['narrator', 'paragraph', 0, null],
  ['karma', 'paragraph', 0, null], ['narrator', 'paragraph', 1, 'image-2'], ['narrator', 'did_you_know', 0, null],
  ['narrator', 'paragraph', 1, null], ['karma', 'paragraph', 0, null], ['narrator', 'did_you_know', 0, null]
];
const block = (lang, [speaker, type, heading, image], i) => {
  const body = type === 'did_you_know'
    ? DID_YOU_KNOW_MARKERS[lang] + ' ' + filler(lang, 60 + i)
    : speaker === 'karma' ? filler(lang, 10 + i) : filler(lang, 75 + i);
  const b = { type, speaker, text: body };
  if (heading) b.heading = filler(lang, 3) + ' ' + i;
  if (image) b.image_after = image;
  return b;
};
const make = () => ({
  section: 'history',
  design: { variant: 'ancient-civilization', accent: SECTION_ACCENTS.history },
  i18n: Object.fromEntries(langs.map(l => [l, {
    title: l === 'ar' ? 'عنوان' : 'Title ' + l,
    history_note: filler(l, 5), figure_name: l === 'ar' ? 'اسم' : 'Name ' + l,
    blocks: plan.map((p, i) => block(l, p, i))
  }])),
  cover: { i18n: {} }, images: [],
  sources: [],
  quiz: [0, 1, 2, 3, 0].map((c, i) => ({ id: 'question-' + (i + 1), correct_option: c, i18n: {} }))
});
const has = (errors, needle) => errors.some(e => e.includes(needle));

test('a well-formed package passes the style gate', () => {
  assert.deepEqual(validateStyle(make()), []);
});
test('accent must equal the section colour', () => {
  const s = make(); s.design.accent = '#112233';
  assert.ok(has(validateStyle(s), 'section colour'));
});
test('Karma must open early and return in the second half', () => {
  const s = make();
  for (const l of langs) { s.i18n[l].blocks[0].speaker = 'narrator'; }
  assert.ok(has(validateStyle(s), 'open the story'));
  const t = make();
  for (const l of langs) { t.i18n[l].blocks[6].speaker = 'narrator'; t.i18n[l].blocks[10].speaker = 'narrator'; }
  assert.ok(has(validateStyle(t), 'second half'));
});
test('Karma rules: length, consecutive blocks, share', () => {
  const long = make(); long.i18n.ar.blocks[0].text = 'ك'.repeat(301);
  assert.ok(has(validateStyle(long), 'speaks too long'));
  const twice = make(); twice.i18n.ar.blocks[1].speaker = 'karma';
  assert.ok(has(validateStyle(twice), 'consecutive Karma'));
  const many = make();
  for (const i of [0, 2, 4, 6, 8, 10]) many.i18n.ar.blocks[i].speaker = 'karma';
  const errors = validateStyle(many);
  assert.ok(has(errors, 'of the blocks') || has(errors, 'within blocks'));
});
test('did_you_know cards need the translated marker and a minimum count', () => {
  const s = make(); s.i18n.de.blocks[3].text = 'Ohne Marker ' + filler('de', 50);
  assert.ok(has(validateStyle(s), 'de did_you_know #1 must start with'));
  const few = make();
  for (const l of langs) few.i18n[l].blocks[11].type = 'paragraph';
  assert.ok(has(validateStyle(few), 'at least 3 did_you_know'));
});
test('languages must match block for block', () => {
  const s = make(); s.i18n.fr.blocks.pop();
  assert.ok(has(validateStyle(s), 'fr has 11 blocks but ar has 12'));
  const t = make(); t.i18n.it.blocks[4].image_after = 'image-2';
  assert.ok(has(validateStyle(t), 'it.blocks[4].image_after differs'));
});
test('Arabic must not leak into other languages and text must not be copied', () => {
  const s = make(); s.i18n.en.blocks[2].text = 'English then عربي ' + filler('en', 70);
  assert.ok(has(validateStyle(s), 'en blocks[2].text contains Arabic'));
  const c = make(); c.i18n.it.blocks[2].text = c.i18n.fr.blocks[2].text;
  assert.ok(has(validateStyle(c), 'identical text in fr and it'));
});
test('history_note and figure_name are required in every language', () => {
  const s = make(); delete s.i18n.de.figure_name;
  assert.ok(has(validateStyle(s), 'i18n.de.figure_name is required'));
});
test('at least two images placed in the text; quiz answers not skewed', () => {
  const s = make();
  for (const l of langs) s.i18n[l].blocks[7].image_after = undefined;
  assert.ok(has(validateStyle(s), 'image_after'));
  const q = make(); q.quiz.forEach(x => { x.correct_option = 1; });
  assert.ok(has(validateStyle(q), 'quiz answers sit in option 1'));
});
