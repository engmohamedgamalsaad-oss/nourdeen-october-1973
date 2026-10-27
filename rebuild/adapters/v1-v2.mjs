/**
 * Conservative V1 <-> V2 adapter for Khaledoon story packages.
 *
 * Conversion deliberately rejects shapes that cannot be represented without
 * guessing or silently discarding data. Keep this module isolated until reader,
 * admin, and import integrations have their own compatibility tests.
 */
export const V1_FORMAT = 'KH_STORY_PACKAGE_V1';
export const V2_FORMAT = 'KHALEDOON_STORY_V2';
export const LANGUAGES = ['ar', 'en', 'fr', 'it', 'de'];
const LEGACY_LANGUAGES = ['en', 'fr', 'it', 'de'];
const SECTION_MAP = {
  october: 'october', history: 'history', science: 'science',
  women: 'women', people: 'people', curriculum: 'curriculum', islamic: 'islamic'
};
const VARIANT_MAP = {
  timeline: 'curriculum', 'science-lab': 'science-lab',
  'ancient-civilization': 'ancient-civilization',
  'military-history': 'military-history', 'journey-map': 'islamic-heritage',
  'portrait-biography': 'portrait-biography', 'women-leadership': 'women-leadership',
  'arts-culture': 'arts-culture'
};
const ACCENTS = {
  october: '#d6ad55', history: '#d5b7ff', science: '#8ad9e8',
  women: '#d78bb2', people: '#e2b36d', curriculum: '#9bb7ff',
  islamic: '#78c59a'
};
const REVERSE_VARIANT = Object.fromEntries(Object.entries(VARIANT_MAP).map(([a,b]) => [b,a]));
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const clone = x => JSON.parse(JSON.stringify(x));
function fail(message) { throw new Error('V1/V2 conversion stopped safely: ' + message); }
function requireObject(x, label) { if (!isObject(x)) fail(label + ' must be an object'); }
function paragraphs(value) {
  return String(value || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
}
function textFromBlocks(blocks, speaker) {
  return blocks.filter(b => b.speaker === speaker).map(b => b.text).join('\n\n');
}
function toBlocks(karma, body) {
  const rows = [
    ...paragraphs(karma).map(text => ({ type: 'paragraph', speaker: 'karma', text })),
    ...paragraphs(body).map(text => ({
      type: /^هل تعلم[؟?:]|^did you know\?|^le saviez-vous\s*\?|^lo sapevi\s*\?|^wusstest du\s*\?/i.test(text)
        ? 'did_you_know' : 'paragraph',
      speaker: 'narrator', text
    }))
  ];
  return rows;
}
function urlOrPath(item, label) {
  const url = typeof item.url === 'string' ? item.url.trim() : '';
  const path = typeof item.path === 'string' ? item.path.trim() : '';
  if (Boolean(url) === Boolean(path)) fail(label + ' must provide exactly one of url/path');
  if (url && !/^https:\/\//i.test(url)) {
    if (!/^(?:assets\/images\/|images\/|stories\/)[^\s"'<>]+$/.test(url) ||
        url.split('/').some(p => p === '.' || p === '..')) fail(label + '.url is not a safe HTTPS URL or repository path');
    return { path: url };
  }
  return url ? { url } : { path };
}
function imageToV2(image, label, id) {
  requireObject(image, label);
  const source = urlOrPath(image, label);
  const i18n = {};
  for (const lang of LANGUAGES) {
    const locale = lang === 'ar' ? image : image.i18n?.[lang];
    if (!isObject(locale)) fail(label + ' is missing ' + lang + ' image text');
    for (const key of ['alt', 'caption', 'source_name', 'rights']) {
      if (!nonempty(locale[key])) fail(label + '.' + lang + '.' + key + ' is required');
    }
    i18n[lang] = Object.fromEntries(['alt','caption','source_name','rights'].map(k => [k, locale[k]]));
  }
  const kind = image.kind;
  if (!['archival','photograph','illustration','map','document'].includes(kind)) {
    fail(label + '.kind "' + kind + '" is not representable in the current V2 contract');
  }
  if (!/^https:\/\//i.test(String(image.source_url || ''))) fail(label + '.source_url must be HTTPS');
  return { ...source, id, kind, source_name: image.source_name, source_url: image.source_url,
    rights: image.rights, i18n };
}
function sourcesToV2(value) {
  if (typeof value !== 'string' || !value.trim()) fail('sources must be non-empty text');
  const lines = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const matches = line.match(/https:\/\/[^\s)\]>]+/gi) || [];
    if (matches.length !== 1) fail('sources line ' + (i + 1) + ' must contain exactly one HTTPS URL for reversible conversion');
    const url = matches[0].replace(/[.,;:]+$/, '');
    const organization = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    return { title: line, organization, url };
  });
}
function quizToV2(value) {
  let bank = value;
  if (typeof bank === 'string') {
    try { bank = JSON.parse(bank); } catch { fail('question_bank_json is not valid JSON'); }
  }
  const questions = bank?.questions;
  if (!Array.isArray(questions) || questions.length !== 5) fail('exactly five V1 quiz questions are required');
  return questions.map((q, i) => {
    requireObject(q, 'question ' + (i + 1));
    if (!Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) {
      fail('question ' + (i + 1) + ' must have four choices and a valid zero-based answer; no choices are invented');
    }
    const i18n = {};
    for (const lang of LANGUAGES) {
      const locale = lang === 'ar' ? q : q.i18n?.[lang];
      if (!isObject(locale) || !nonempty(locale.q) || !nonempty(locale.e) ||
          !Array.isArray(locale.o) || locale.o.length !== 4 || !locale.o.every(nonempty)) {
        fail('question ' + (i + 1) + ' is incomplete in ' + lang);
      }
      i18n[lang] = { question: locale.q, options: [...locale.o], explanation: locale.e };
    }
    return { id: 'question-' + (i + 1), correct_option: q.a, i18n };
  });
}
function metadataForLocale(v1, lang) {
  const source = lang === 'ar' ? v1 : (v1.translations?.[lang] || {});
  const out = {};
  const keys = ['student_name','narrator_name','grade','narrator_grade','history_note','images_note','figure_name','person'];
  const baseValues = {
    student_name: v1.student_name, narrator_name: v1.narrator_name,
    grade: v1.grade, narrator_grade: v1.narrator_grade,
    history_note: v1.history_note, images_note: v1.images_note,
    figure_name: v1.figure_name, person: v1.person
  };
  for (const key of keys) {
    const value = source[key] ?? (['narrator_name','narrator_grade','figure_name','person'].includes(key) ? baseValues[key] : undefined);
    const used = LANGUAGES.some(l => {
      const row = l === 'ar' ? v1 : v1.translations?.[l];
      return row && Object.hasOwn(row, key) || baseValues[key] !== undefined;
    });
    if (!used) continue;
    if (typeof value !== 'string') fail('metadata ' + key + ' needs an explicit value in locale ' + lang);
    out[key] = value;
  }
  return out;
}
export function v1ToV2(input, { slug } = {}) {
  requireObject(input, 'V1 package');
  if (input.format !== V1_FORMAT) fail('expected ' + V1_FORMAT);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) fail('caller must provide a stable slug; it is never guessed from a title');
  const section = SECTION_MAP[input.section_key];
  if (!section) fail('unsupported section_key: ' + input.section_key);
  if (!nonempty(input.original_body)) fail('original_body is required and must remain unchanged');
  const variant = VARIANT_MAP[input.visual_design];
  if (!variant) fail('visual_design has no lossless V2 mapping: ' + input.visual_design);
  if (!Array.isArray(input.images) || input.images.length < 2) fail('at least two V1 images are required');
  const i18n = {};
  for (const lang of LANGUAGES) {
    const src = lang === 'ar' ? input : input.translations?.[lang];
    if (!isObject(src)) fail('missing locale ' + lang);
    for (const key of ['title','subtitle','body','karma_text']) {
      if (!nonempty(src[key])) fail(lang + '.' + key + ' is required');
    }
    i18n[lang] = {
      title: src.title, subtitle: src.subtitle, summary: src.subtitle,
      blocks: toBlocks(src.karma_text, src.body),
      ...metadataForLocale(input, lang)
    };
  }
  const cover = imageToV2(input.cover, 'cover', undefined);
  delete cover.id;
  const images = input.images.map((im, i) => imageToV2(im, 'images[' + i + ']', 'image-' + (i + 1)));
  const map = input.map_location === undefined ? null : input.map_location;
  return {
    format: V2_FORMAT, slug, section,
    design: { variant, accent: ACCENTS[section] || '#d6ad55' },
    original_body: input.original_body,
    i18n, cover, images,
    sources: sourcesToV2(input.sources),
    quiz: quizToV2(input.question_bank),
    map_location: map === null ? null : clone(map)
  };
}
function imageToV1(image) {
  const ar = image.i18n.ar;
  const out = {
    ...('url' in image ? { url: image.url } : { path: image.path }),
    alt: ar.alt, caption: ar.caption, kind: image.kind,
    source_name: image.source_name, source_url: image.source_url, rights: image.rights,
    i18n: Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, clone(image.i18n[lang])]))
  };
  return out;
}
export function v2ToV1(input) {
  requireObject(input, 'V2 story');
  if (input.format !== V2_FORMAT) fail('expected ' + V2_FORMAT);
  const section_key = input.section === 'women' ? 'women' : input.section === 'people' ? 'people' : input.section;
  const visual_design = REVERSE_VARIANT[input.design?.variant];
  if (!visual_design) fail('V2 design variant has no V1 equivalent: ' + input.design?.variant);
  const translations = {};
  for (const lang of LEGACY_LANGUAGES) {
    const src = input.i18n?.[lang];
    if (!isObject(src)) fail('missing V2 locale ' + lang);
    translations[lang] = {
      title: src.title, subtitle: src.subtitle,
      karma_text: textFromBlocks(src.blocks || [], 'karma'),
      body: textFromBlocks(src.blocks || [], 'narrator'),
      ...Object.fromEntries(['student_name','narrator_name','grade','narrator_grade','history_note','images_note','figure_name','person']
        .filter(k => Object.hasOwn(src, k)).map(k => [k, src[k]]))
    };
  }
  const ar = input.i18n?.ar;
  if (!isObject(ar)) fail('missing V2 Arabic locale');
  let sawNarrator = false;
  for (const [i, block] of (ar.blocks || []).entries()) {
    if (block.speaker === 'narrator') sawNarrator = true;
    if (block.speaker === 'karma' && sawNarrator) fail('Arabic block order interleaves Karma after narrator text; V1 stores these streams separately');
  }
  for (const lang of LEGACY_LANGUAGES) {
    let narratorSeen = false;
    for (const block of input.i18n[lang].blocks || []) {
      if (block.speaker === 'narrator') narratorSeen = true;
      if (block.speaker === 'karma' && narratorSeen) fail(lang + ' block order interleaves Karma after narrator text; V1 stores these streams separately');
    }
  }
  const question_bank = { questions: input.quiz.map(q => {
    const qAr = q.i18n.ar;
    const i18n = Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, {
      q: q.i18n[lang].question, o: clone(q.i18n[lang].options), e: q.i18n[lang].explanation
    }]));
    return { q: qAr.question, o: clone(qAr.options), a: q.correct_option, e: qAr.explanation, i18n };
  }) };
  return {
    format: V1_FORMAT, section_key, figure_name: ar.figure_name || ar.person || '',
    title: ar.title, subtitle: ar.subtitle,
    narrator_name: ar.narrator_name || ar.student_name || '',
    narrator_grade: ar.narrator_grade || ar.grade || '',
    student_name: ar.student_name || ar.narrator_name || '',
    grade: ar.grade || ar.narrator_grade || '',
    original_body: input.original_body,
    karma_text: textFromBlocks(ar.blocks, 'karma'),
    body: textFromBlocks(ar.blocks, 'narrator'),
    history_note: ar.history_note || '', images_note: ar.images_note || '',
    sources: input.sources.map(s => s.title).join('\n'),
    cover: imageToV1(input.cover),
    images: input.images.map(imageToV1),
    visual_design, map_location: input.map_location === undefined ? null : clone(input.map_location),
    translations, question_bank
  };
}
