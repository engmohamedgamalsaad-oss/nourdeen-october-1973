import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStyle, DID_YOU_KNOW_PREFIX, SECTION_ACCENT } from '../validate-style.mjs';

const L = ['ar', 'en', 'fr', 'it', 'de'];
const para = (lang, n) => ({
  ar: 'فقرة عربية رقم ' + n + ' تحكي معلومة تاريخية مفصلة عن الشخصية وعصرها وأثرها في الناس، وتشرح السبب والنتيجة بلغة سهلة تناسب الأطفال ولا تختصر الواقعة المهمة. '.repeat(2),
  en: 'English paragraph number ' + n + ' tells a detailed historical fact about the person, the era and the effect on people, explaining cause and result in simple words. '.repeat(2),
  fr: 'Paragraphe français numéro ' + n + ' qui raconte un fait historique détaillé sur le personnage, son époque et son effet sur les gens, avec cause et résultat. '.repeat(2),
  it: 'Paragrafo italiano numero ' + n + ' che racconta un fatto storico dettagliato sul personaggio, la sua epoca e il suo effetto sulle persone, con causa e risultato. '.repeat(2),
  de: 'Deutscher Absatz Nummer ' + n + ' erzählt eine ausführliche historische Tatsache über die Person, ihre Zeit und ihre Wirkung auf die Menschen, mit Ursache und Folge. '.repeat(2)
})[lang];
const karma = lang => ({ ar: 'ليه كده يا راوي؟', en: 'Why is that, narrator?', fr: 'Pourquoi, narrateur ?', it: 'Perché, narratore?', de: 'Warum, Erzähler?' })[lang];

// type, speaker, heading?, image_after?
const plan = [
  ['paragraph', 'karma'], ['paragraph', 'narrator', 'h1'], ['paragraph', 'narrator'], ['did_you_know', 'narrator'],
  ['paragraph', 'narrator', 'h2', 'img-a'], ['paragraph', 'narrator'], ['did_you_know', 'narrator'], ['paragraph', 'narrator', 'h3'],
  ['paragraph', 'karma'], ['paragraph', 'narrator'], ['did_you_know', 'narrator'], ['paragraph', 'narrator', 'h4', 'img-b'],
  ['paragraph', 'narrator'], ['paragraph', 'narrator'], ['paragraph', 'karma'], ['paragraph', 'narrator']
];
function blocks(lang) {
  return plan.map(([type, speaker, h, img], i) => {
    const b = { type, speaker, text: speaker === 'karma' ? karma(lang) : (type === 'did_you_know' ? DID_YOU_KNOW_PREFIX[lang] + ' ' : '') + para(lang, i) };
    if (h) b.heading = lang + ' heading ' + h;
    if (img) b.image_after = img;
    if (lang === 'ar' && h) b.heading = 'عنوان المشهد ' + h;
    return b;
  });
}
const imgI18n = lang => ({ alt: lang === 'ar' ? 'وصف' : lang + ' alt', caption: lang === 'ar' ? 'تعليق' : lang + ' caption', source_name: lang === 'ar' ? 'مصدر' : lang + ' source', rights: lang === 'ar' ? 'حقوق' : lang + ' rights' });
const image = id => ({ id, kind: 'photograph', source_name: 's', source_url: 'https://e.org', rights: 'r', i18n: Object.fromEntries(L.map(l => [l, imgI18n(l)])) });
function good() {
  return {
    format: 'KHALEDOON_STORY_V2', slug: 'x', section: 'women', design: { variant: 'women-leadership', accent: SECTION_ACCENT.women },
    original_body: 'x',
    i18n: Object.fromEntries(L.map(l => [l, {
      title: l === 'ar' ? 'عنوان' : l + ' title', subtitle: 's', summary: 's', history_note: l === 'ar' ? 'ملاحظة' : l + ' note', figure_name: l === 'ar' ? 'اسم' : l + ' Name', blocks: blocks(l)
    }])),
    cover: image('cover'), images: [image('img-a'), image('img-b')],
    sources: [{ title: 't', organization: 'o', url: 'https://a.org', i18n: Object.fromEntries(L.map(l => [l, { title: l === 'ar' ? 'عنوان' : l + ' t', organization: l === 'ar' ? 'جهة' : l + ' o' }])) }],
    quiz: [0, 1, 2, 3, 1].map((c, i) => ({ id: 'q' + i, correct_option: c, i18n: Object.fromEntries(L.map(l => [l, { question: l === 'ar' ? 'سؤال' : l + ' q', options: ['a', 'b', 'c', 'd'], explanation: l === 'ar' ? 'شرح' : l + ' e' }])) })),
    map_location: { lat: 30, lng: 31, place: Object.fromEntries(L.map(l => [l, l === 'ar' ? 'مكان' : l + ' place'])) }
  };
}
const has = (errs, part) => errs.some(e => e.includes(part));

test('a well-formed story passes', () => assert.deepEqual(validateStyle(good()), []));

test('wrong accent colour is rejected', () => { const s = good(); s.design.accent = '#d7b878'; assert.ok(has(validateStyle(s), 'section colour')); });
test('map_location null is rejected', () => { const s = good(); s.map_location = null; assert.ok(has(validateStyle(s), 'map_location is required')); });
test('missing did_you_know cards are rejected in every language', () => {
  const s = good(); for (const l of L) s.i18n[l].blocks.forEach(b => { if (b.type === 'did_you_know') b.type = 'paragraph'; });
  assert.ok(has(validateStyle(s), 'needs at least 3 did_you_know'));
});
test('did_you_know without the translated opening mark is rejected', () => {
  const s = good(); s.i18n.fr.blocks[3].text = 'Un fait. ' + para('fr', 3); assert.ok(has(validateStyle(s), 'fr did_you_know #1 must start with'));
});
test('structure drift between languages is rejected', () => {
  const s = good(); s.i18n.de.blocks[2].speaker = 'karma'; assert.ok(has(validateStyle(s), 'de blocks differ'));
  const t = good(); t.i18n.it.blocks.pop(); assert.ok(has(validateStyle(t), 'it has 15 blocks'));
});
test('Arabic leaking into another language is rejected', () => {
  const s = good(); s.i18n.en.blocks[1].text += ' كلمة عربية'; assert.ok(has(validateStyle(s), 'i18n.en.blocks[1].text contains Arabic'));
  const t = good(); t.cover.i18n.de.caption = 'تعليق'; assert.ok(has(validateStyle(t), 'cover.i18n.de.caption'));
  const u = good(); u.quiz[0].i18n.it.options[0] = 'خيار'; assert.ok(has(validateStyle(u), 'quiz[0].i18n.it.options[0]'));
});
test('untranslated copies and truncated translations are rejected', () => {
  const s = good(); s.i18n.fr.blocks[2].text = s.i18n.en.blocks[2].text; assert.ok(has(validateStyle(s), 'copied, not translated'));
  const t = good(); t.i18n.de.blocks.forEach(b => { b.text = b.type === 'did_you_know' ? DID_YOU_KNOW_PREFIX.de + ' x' : b.text.slice(0, 20); }); assert.ok(has(validateStyle(t), 'looks truncated'));
});
test('Karma voice rules: opening, return, no chains, short lines', () => {
  const s = good(); for (const l of L) { s.i18n[l].blocks[0].speaker = 'narrator'; } assert.ok(has(validateStyle(s), 'open the story'));
  const t = good(); for (const l of L) { t.i18n[l].blocks[8].speaker = 'narrator'; t.i18n[l].blocks[14].speaker = 'narrator'; } assert.ok(has(validateStyle(t), 'come back in the second half'));
  const u = good(); for (const l of L) { u.i18n[l].blocks[1].speaker = 'karma'; u.i18n[l].blocks[1].text = karma(l); u.i18n[l].blocks[3].speaker = 'karma'; u.i18n[l].blocks[3].type = 'paragraph'; u.i18n[l].blocks[3].text = karma(l); }
  const errs = validateStyle(u); assert.ok(has(errs, 'question-and-answer chain') || has(errs, 'two Karma blocks in a row'));
  const v = good(); v.i18n.en.blocks[0].text = 'x'.repeat(400); assert.ok(has(validateStyle(v), 'longer than a child would say'));
});
test('images must be placed inside the story', () => {
  const s = good(); for (const l of L) s.i18n[l].blocks.forEach(b => { delete b.image_after; }); assert.ok(has(validateStyle(s), 'image_after'));
});
test('predictable quiz answers are rejected', () => {
  const s = good(); s.quiz.forEach(q => { q.correct_option = 0; }); assert.ok(has(validateStyle(s), 'predictable'));
});
test('thin stories are rejected', () => {
  const s = good(); for (const l of L) s.i18n[l].blocks = s.i18n[l].blocks.slice(0, 5); assert.ok(has(validateStyle(s), 'at least 10 blocks'));
});
