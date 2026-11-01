// Style gate for NEW Khaledoon V2 stories.
//
// validate-story.mjs checks that a package matches the data contract.
// This file checks that a package is *written and structured* the way the
// approved prompt (MASTER-STORY-WORKFLOW.md) asks, regardless of which AI tool
// produced it: five complete languages, the Karma/Narrator voices, "Did you
// know?" cards, image placement, map link, section colour and a usable quiz.
//
// It is intentionally NOT applied to already-published stories (for example
// stories/women/010). Use it through `rebuild/validate-package.mjs --style`.
import { LANGUAGES } from './validate-story.mjs';

export const DID_YOU_KNOW_PREFIX = {
  ar: 'هل تعلم؟',
  en: 'Did you know?',
  fr: 'Le saviez-vous ?',
  it: 'Lo sapevi?',
  de: 'Wusstest du?'
};

// Must stay equal to SECTION_PALETTE in rebuild/reader.js (the reader ignores
// design.accent and always paints the section colour).
export const SECTION_ACCENT = {
  october: '#d6ad55',
  history: '#d5b7ff',
  science: '#8ad9e8',
  women: '#d78bb2',
  people: '#e2b36d',
  curriculum: '#9bb7ff',
  islamic: '#78c59a',
  readers: '#80d5c7'
};

export const LIMITS = {
  minBlocks: 10,
  minHeadings: 4,
  minDidYouKnow: 3,
  minKarma: 2,
  maxKarmaShare: 0.35,
  maxKarmaInWindow: 2,
  karmaWindow: 5,
  maxKarmaChars: 300,
  minArabicChars: 3500,
  minTranslationRatio: 0.5,
  maxSameCorrectShare: 0.6,
  minBlocksWithImage: 2
};

const ARABIC = /[\u0600-\u06FF]/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const blocksOf = (s, lang) => (Array.isArray(s?.i18n?.[lang]?.blocks) ? s.i18n[lang].blocks : []);
const signature = b => [b?.type, b?.speaker, nonempty(b?.heading) ? 'heading' : 'no-heading', b?.image_after || 'no-image'].join('|');

function pushArabicLeaks(out, label, value) {
  if (typeof value === 'string' && ARABIC.test(value)) out.push(label + ' contains Arabic text in a non-Arabic language');
}

export function validateStyle(s) {
  const out = [];
  if (!isObject(s) || !isObject(s.i18n)) return ['style: package has no i18n object'];

  // 1. Section colour: the reader paints SECTION_ACCENT[section]; design.accent must not pretend otherwise.
  const expected = SECTION_ACCENT[s.section];
  if (expected && String(s.design?.accent || '').toLowerCase() !== expected) {
    out.push('style: design.accent must equal the section colour ' + expected + ' (no story-specific colours)');
  }

  // 2. Map link is mandatory for a new story.
  if (!isObject(s.map_location)) out.push('style: map_location is required for a new story (null is not allowed)');

  const ar = blocksOf(s, 'ar');

  // 3. Same scene structure in all five languages (types, speakers, headings, image slots).
  for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
    const other = blocksOf(s, lang);
    if (other.length !== ar.length) {
      out.push('style: ' + lang + ' has ' + other.length + ' blocks but ar has ' + ar.length);
      continue;
    }
    const bad = ar.map((b, i) => (signature(b) === signature(other[i]) ? -1 : i)).filter(i => i >= 0);
    if (bad.length) out.push('style: ' + lang + ' blocks differ in type/speaker/heading/image from ar at index ' + bad.slice(0, 5).join(', '));
  }

  // 4. Story size and scene headings.
  if (ar.length < LIMITS.minBlocks) out.push('style: at least ' + LIMITS.minBlocks + ' blocks are required (found ' + ar.length + ')');
  const headings = ar.filter(b => nonempty(b.heading)).length;
  if (headings < LIMITS.minHeadings) out.push('style: at least ' + LIMITS.minHeadings + ' scene headings are required (found ' + headings + ')');
  const arChars = ar.reduce((n, b) => n + String(b.text || '').length, 0);
  if (arChars < LIMITS.minArabicChars) out.push('style: Arabic story text is too thin (' + arChars + ' characters, minimum ' + LIMITS.minArabicChars + ')');

  // 5. Voices: Karma opens briefly, returns later, never dominates; the Narrator carries the story.
  const karmaIdx = ar.map((b, i) => (b.speaker === 'karma' ? i : -1)).filter(i => i >= 0);
  const narratorCount = ar.length - karmaIdx.length;
  if (karmaIdx.length < LIMITS.minKarma) out.push('style: Karma must speak at least ' + LIMITS.minKarma + ' times');
  if (ar.length && karmaIdx.length / ar.length > LIMITS.maxKarmaShare) out.push('style: Karma has too many blocks (' + karmaIdx.length + ' of ' + ar.length + '); the Narrator must carry the story');
  if (narratorCount < 4) out.push('style: the Narrator needs at least 4 blocks');
  if (karmaIdx.length && !karmaIdx.some(i => i < 3)) out.push('style: Karma must open the story within the first 3 blocks');
  if (karmaIdx.length && !karmaIdx.some(i => i >= Math.floor(ar.length / 2))) out.push('style: Karma must come back in the second half of the story');
  for (let i = 1; i < karmaIdx.length; i++) if (karmaIdx[i] === karmaIdx[i - 1] + 1) out.push('style: two Karma blocks in a row at index ' + karmaIdx[i - 1]);
  for (let start = 0; start + LIMITS.karmaWindow <= ar.length; start++) {
    const n = ar.slice(start, start + LIMITS.karmaWindow).filter(b => b.speaker === 'karma').length;
    if (n > LIMITS.maxKarmaInWindow) { out.push('style: question-and-answer chain: ' + n + ' Karma turns within ' + LIMITS.karmaWindow + ' blocks starting at index ' + start); break; }
  }
  for (const lang of LANGUAGES) {
    blocksOf(s, lang).forEach((b, i) => {
      if (b.speaker === 'karma' && String(b.text || '').length > LIMITS.maxKarmaChars) out.push('style: ' + lang + ' Karma block ' + i + ' is longer than a child would say (' + LIMITS.maxKarmaChars + ' characters max)');
    });
  }

  // 6. "Did you know?" cards, translated with the right opening mark.
  for (const lang of LANGUAGES) {
    const cards = blocksOf(s, lang).filter(b => b.type === 'did_you_know');
    if (cards.length < LIMITS.minDidYouKnow) out.push('style: ' + lang + ' needs at least ' + LIMITS.minDidYouKnow + ' did_you_know blocks (found ' + cards.length + ')');
    cards.forEach((b, i) => {
      if (!String(b.text || '').trim().startsWith(DID_YOU_KNOW_PREFIX[lang])) out.push('style: ' + lang + ' did_you_know #' + (i + 1) + ' must start with "' + DID_YOU_KNOW_PREFIX[lang] + '"');
    });
  }

  // 7. Images are placed inside the story, not only dumped in the gallery.
  const withImage = ar.filter(b => nonempty(b.image_after)).length;
  if (withImage < LIMITS.minBlocksWithImage) out.push('style: place at least ' + LIMITS.minBlocksWithImage + ' images inside the story with image_after (found ' + withImage + ')');

  // 8. Language completeness: no Arabic leaking into other languages, no untouched copies, no truncated translations.
  const metaFields = ['title', 'subtitle', 'summary', 'history_note', 'images_note', 'figure_name', 'person'];
  for (const field of ['title', 'subtitle', 'summary', 'history_note', 'figure_name']) {
    if (!nonempty(s.i18n.ar?.[field])) out.push('style: i18n.ar.' + field + ' is required');
  }
  if (nonempty(s.i18n.ar?.title) && !ARABIC.test(s.i18n.ar.title)) out.push('style: i18n.ar.title must be Arabic');
  for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
    const t = s.i18n[lang] || {};
    for (const field of metaFields) pushArabicLeaks(out, 'style: i18n.' + lang + '.' + field, t[field]);
    for (const field of ['history_note', 'figure_name']) if (!nonempty(t[field])) out.push('style: i18n.' + lang + '.' + field + ' is required');
    blocksOf(s, lang).forEach((b, i) => {
      pushArabicLeaks(out, 'style: i18n.' + lang + '.blocks[' + i + '].text', b.text);
      pushArabicLeaks(out, 'style: i18n.' + lang + '.blocks[' + i + '].heading', b.heading);
    });
    const chars = blocksOf(s, lang).reduce((n, b) => n + String(b.text || '').length, 0);
    if (arChars && chars < arChars * LIMITS.minTranslationRatio) out.push('style: ' + lang + ' text is much shorter than ar (' + chars + ' vs ' + arChars + ' characters); the translation looks truncated');
  }
  const seen = new Map();
  for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
    blocksOf(s, lang).forEach((b, i) => {
      const text = String(b.text || '').trim();
      if (text.length < 40) return;
      const key = i + '::' + text;
      if (seen.has(key)) out.push('style: ' + lang + ' block ' + i + ' is identical to ' + seen.get(key) + '; it was copied, not translated');
      else seen.set(key, lang);
    });
  }
  for (const [label, image] of [['cover', s.cover], ...(Array.isArray(s.images) ? s.images.map((im, i) => ['images[' + i + ']', im]) : [])]) {
    for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
      for (const field of ['alt', 'caption', 'source_name', 'rights']) pushArabicLeaks(out, 'style: ' + label + '.i18n.' + lang + '.' + field, image?.i18n?.[lang]?.[field]);
    }
  }
  for (const [i, src] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
      for (const field of ['title', 'organization']) pushArabicLeaks(out, 'style: sources[' + i + '].i18n.' + lang + '.' + field, src?.i18n?.[lang]?.[field]);
    }
  }
  for (const [i, q] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
    for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
      const t = q?.i18n?.[lang];
      pushArabicLeaks(out, 'style: quiz[' + i + '].i18n.' + lang + '.question', t?.question);
      pushArabicLeaks(out, 'style: quiz[' + i + '].i18n.' + lang + '.explanation', t?.explanation);
      (Array.isArray(t?.options) ? t.options : []).forEach((o, j) => pushArabicLeaks(out, 'style: quiz[' + i + '].i18n.' + lang + '.options[' + j + ']', o));
    }
  }
  for (const field of ['place', 'place_label', 'source_name']) {
    const loc = s.map_location?.[field];
    if (!isObject(loc)) continue;
    for (const lang of LANGUAGES.filter(l => l !== 'ar')) pushArabicLeaks(out, 'style: map_location.' + field + '.' + lang, loc[lang]);
  }

  // 9. Quiz: the right answer must not always sit in the same slot.
  if (Array.isArray(s.quiz) && s.quiz.length) {
    const counts = new Map();
    for (const q of s.quiz) counts.set(q?.correct_option, (counts.get(q?.correct_option) || 0) + 1);
    const most = Math.max(...counts.values());
    if (most / s.quiz.length > LIMITS.maxSameCorrectShare) out.push('style: quiz answers are predictable: ' + most + ' of ' + s.quiz.length + ' correct answers use the same option slot; shuffle correct_option');
  }

  return out;
}

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const nodePath = await import('node:path');
  if (import.meta.url === new URL('file://' + nodePath.default.resolve(process.argv[1])).href) {
    const filename = process.argv[2];
    if (!filename) { console.error('Usage: node rebuild/validate-style.mjs <story.json>'); process.exitCode = 2; }
    else try {
      const { readFile } = await import('node:fs/promises');
      const story = JSON.parse(await readFile(filename, 'utf8'));
      const problems = validateStyle(story);
      if (problems.length) { console.error('Style gate failed (' + problems.length + '):\n- ' + problems.join('\n- ')); process.exitCode = 1; }
      else console.log('Style gate passed.');
    } catch (e) { console.error('Unable to read/parse JSON: ' + e.message); process.exitCode = 2; }
  }
}
