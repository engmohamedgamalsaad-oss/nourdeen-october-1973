// Style gate for story packages added to the project. It checks the editorial rules in
// khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md
// ("الأسلوب والفحص الآلي للحكايات الجديدة"). It complements validateStory()
// (the structural contract) and never replaces human review of facts/translation.
import { LANGUAGES } from './validate-story.mjs';

export const SECTION_ACCENTS = {
  october: '#d6ad55',
  history: '#d5b7ff',
  science: '#8ad9e8',
  women: '#d78bb2',
  people: '#e2b36d',
  curriculum: '#9bb7ff',
  islamic: '#78c59a'
};
export const DID_YOU_KNOW_MARKERS = {
  ar: 'هل تعلم؟',
  en: 'Did you know?',
  fr: 'Le saviez-vous ?',
  it: 'Lo sapevi?',
  de: 'Wusstest du?'
};
export const STYLE_LIMITS = {
  minBlocks: 10,
  minArabicChars: 3500,
  minHeadings: 4,
  karmaMaxChars: 300,
  karmaOpenWithin: 3,
  karmaMaxShare: 0.35,
  karmaMaxInWindow: 2,
  window: 5,
  minDidYouKnow: 3,
  minImageAfter: 2,
  maxSameAnswerShare: 0.6,
  minTranslationRatio: 0.5
};

const ARABIC = /[؀-ۿ]/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const blocksOf = (s, lang) => (Array.isArray(s?.i18n?.[lang]?.blocks) ? s.i18n[lang].blocks.filter(isObject) : []);
const textLength = blocks => blocks.reduce((n, b) => n + (typeof b.text === 'string' ? b.text.trim().length : 0), 0);
const norm = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();

export function validateStyle(s) {
  const out = [];
  const L = STYLE_LIMITS;
  if (!isObject(s) || !isObject(s.i18n)) return ['style: story.i18n object required'];

  // Section colour comes from the section only.
  const expected = SECTION_ACCENTS[s.section];
  if (expected && String(s.design?.accent || '').toLowerCase() !== expected) {
    out.push('style: design.accent must equal the section colour ' + expected + ' for section "' + s.section + '"');
  }

  // Karma / narrator rhythm (checked on the Arabic source, parity enforces the rest).
  const ar = blocksOf(s, 'ar');
  if (ar.length < L.minBlocks) out.push('style: ar needs at least ' + L.minBlocks + ' blocks (found ' + ar.length + ')');
  const arTotal = textLength(ar);
  if (arTotal < L.minArabicChars) out.push('style: ar body is too short (' + arTotal + ' chars, need about ' + L.minArabicChars + ' or more)');
  const headings = ar.filter(b => typeof b.heading === 'string' && b.heading.trim()).length;
  if (headings < L.minHeadings) out.push('style: ar needs at least ' + L.minHeadings + ' scene headings (found ' + headings + ')');

  const karmaIdx = ar.map((b, i) => (b.speaker === 'karma' ? i : -1)).filter(i => i >= 0);
  if (!karmaIdx.some(i => i < L.karmaOpenWithin)) out.push('style: Karma must open the story within the first ' + L.karmaOpenWithin + ' blocks');
  if (!karmaIdx.some(i => i >= Math.ceil(ar.length / 2))) out.push('style: Karma must return in the second half of the story');
  for (const i of karmaIdx) {
    if (ar[i].text.trim().length > L.karmaMaxChars) out.push('style: ar.blocks[' + i + '] Karma speaks too long (' + ar[i].text.trim().length + ' > ' + L.karmaMaxChars + ' chars)');
    if (ar[i + 1]?.speaker === 'karma') out.push('style: ar.blocks[' + i + '] and [' + (i + 1) + '] are consecutive Karma blocks');
  }
  for (let i = 0; i + L.window <= ar.length; i++) {
    const n = ar.slice(i, i + L.window).filter(b => b.speaker === 'karma').length;
    if (n > L.karmaMaxInWindow) { out.push('style: more than ' + L.karmaMaxInWindow + ' Karma blocks within blocks ' + i + '–' + (i + L.window - 1)); break; }
  }
  if (ar.length && karmaIdx.length / ar.length > L.karmaMaxShare) {
    out.push('style: Karma has ' + Math.round(100 * karmaIdx.length / ar.length) + '% of the blocks (max ' + Math.round(100 * L.karmaMaxShare) + '%)');
  }

  // Did-you-know cards with translated marker, per language.
  for (const lang of LANGUAGES) {
    const cards = blocksOf(s, lang).filter(b => b.type === 'did_you_know');
    if (cards.length < L.minDidYouKnow) out.push('style: ' + lang + ' needs at least ' + L.minDidYouKnow + ' did_you_know blocks (found ' + cards.length + ')');
    for (const [i, b] of cards.entries()) {
      if (!String(b.text || '').trim().startsWith(DID_YOU_KNOW_MARKERS[lang])) {
        out.push('style: ' + lang + ' did_you_know #' + (i + 1) + ' must start with "' + DID_YOU_KNOW_MARKERS[lang] + '"');
      }
    }
  }

  // Language parity: same count, type, speaker, heading positions, image_after.
  for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
    const b = blocksOf(s, lang);
    if (b.length !== ar.length) { out.push('style: ' + lang + ' has ' + b.length + ' blocks but ar has ' + ar.length); continue; }
    for (let i = 0; i < ar.length; i++) {
      const same = (k, f = x => x) => f(ar[i][k]) === f(b[i][k]);
      if (!same('type')) out.push('style: ' + lang + '.blocks[' + i + '].type differs from ar');
      if (!same('speaker')) out.push('style: ' + lang + '.blocks[' + i + '].speaker differs from ar');
      if (!same('heading', x => Boolean(x && String(x).trim()))) out.push('style: ' + lang + '.blocks[' + i + '] heading position differs from ar');
      if (!same('image_after')) out.push('style: ' + lang + '.blocks[' + i + '].image_after differs from ar');
    }
    const total = textLength(b);
    if (arTotal && total < arTotal * L.minTranslationRatio) out.push('style: ' + lang + ' translation is shorter than half of the Arabic text');
  }

  // No Arabic fallback in the other four languages; no copied text between languages.
  const arabicIn = (lang, label, v) => { if (typeof v === 'string' && ARABIC.test(v)) out.push('style: ' + lang + ' ' + label + ' contains Arabic text'); };
  for (const lang of LANGUAGES.filter(l => l !== 'ar')) {
    const t = s.i18n[lang];
    if (!isObject(t)) continue;
    for (const k of ['title', 'subtitle', 'summary', 'history_note', 'figure_name', 'person', 'images_note']) arabicIn(lang, k, t[k]);
    for (const [i, b] of blocksOf(s, lang).entries()) { arabicIn(lang, 'blocks[' + i + '].text', b.text); arabicIn(lang, 'blocks[' + i + '].heading', b.heading); }
    for (const [i, im] of [s.cover, ...(Array.isArray(s.images) ? s.images : [])].entries()) {
      for (const k of ['alt', 'caption', 'source_name', 'rights']) arabicIn(lang, 'image[' + i + '].' + k, im?.i18n?.[lang]?.[k]);
    }
    for (const [i, src] of (Array.isArray(s.sources) ? s.sources : []).entries()) for (const k of ['title', 'organization']) arabicIn(lang, 'sources[' + i + '].' + k, src?.i18n?.[lang]?.[k]);
    for (const [i, q] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
      const qt = q?.i18n?.[lang];
      arabicIn(lang, 'quiz[' + i + '].question', qt?.question); arabicIn(lang, 'quiz[' + i + '].explanation', qt?.explanation);
      (Array.isArray(qt?.options) ? qt.options : []).forEach((o, j) => arabicIn(lang, 'quiz[' + i + '].options[' + j + ']', o));
    }
    if (isObject(s.map_location)) for (const k of ['place', 'place_label', 'source_name']) arabicIn(lang, 'map_location.' + k, s.map_location[k]?.[lang]);
  }
  for (let a = 0; a < LANGUAGES.length; a++) for (let c = a + 1; c < LANGUAGES.length; c++) {
    const A = blocksOf(s, LANGUAGES[a]), C = blocksOf(s, LANGUAGES[c]);
    const copied = A.filter((b, i) => C[i] && norm(b.text).length > 20 && norm(b.text) === norm(C[i].text)).length;
    if (copied) out.push('style: ' + copied + ' block(s) have identical text in ' + LANGUAGES[a] + ' and ' + LANGUAGES[c] + ' (untranslated copy)');
  }
  for (const lang of LANGUAGES) {
    const t = s.i18n[lang];
    if (isObject(t)) for (const k of ['history_note', 'figure_name']) if (!String(t[k] || '').trim()) out.push('style: i18n.' + lang + '.' + k + ' is required');
  }

  // Images placed inside the text.
  const placed = new Set(ar.map(b => b.image_after).filter(Boolean));
  if (placed.size < L.minImageAfter) out.push('style: at least ' + L.minImageAfter + ' different images must be placed in the text with image_after (found ' + placed.size + ')');

  // Quiz answer distribution.
  const quiz = Array.isArray(s.quiz) ? s.quiz : [];
  if (quiz.length) {
    const counts = {};
    for (const q of quiz) counts[q?.correct_option] = (counts[q?.correct_option] || 0) + 1;
    const [pos, max] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
    if (max / quiz.length > L.maxSameAnswerShare) out.push('style: ' + max + ' of ' + quiz.length + ' quiz answers sit in option ' + pos + ' (max ' + Math.round(100 * L.maxSameAnswerShare) + '%)');
  }
  return out;
}
