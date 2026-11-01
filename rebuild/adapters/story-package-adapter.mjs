import { validateForAdminBridge, validateStory } from '../validate-story.mjs?v=20261028-v2-admin-6';

/**
 * Conservative legacy package ↔ unified story adapter for Khaledoon story packages.
 *
 * Conversion deliberately rejects shapes that cannot be represented without
 * guessing or silently discarding data. Keep this module isolated until reader,
 * admin, and import integrations have their own compatibility tests.
 */
export const LEGACY_PACKAGE_FORMAT = 'KH_STORY_PACKAGE_LEGACY';
export const LEGACY_PACKAGE_FORMAT_ALIASES = ['KH_STORY_PACKAGE_LEGACY', 'KH_STORY_PACKAGE_V1'];
export const LEGACY_STORY_FORMAT = 'KHALEDOON_STORY_V2';
export const STORY_FORMAT = 'KHALEDOON_STORY';
// Compatibility exports retained for older integrations during the migration window.
export const LEGACY_PACKAGE_FORMAT = LEGACY_PACKAGE_FORMAT;
export const STORY_FORMAT = STORY_FORMAT;
const isStoryFormat = value => value === STORY_FORMAT || value === LEGACY_STORY_FORMAT;
export const LANGUAGES = ['ar', 'en', 'fr', 'it', 'de'];
const LEGACY_LANGUAGES = ['en', 'fr', 'it', 'de'];
const SECTION_MAP = {
  october: 'october', history: 'history', science: 'science',
  women: 'women', learning: 'women',
  people: 'people', fame: 'people', curriculum: 'curriculum', islamic: 'islamic', readers: 'readers'
};
const VARIANT_MAP = {
  timeline: 'curriculum', 'science-lab': 'science-lab',
  'ancient-civilization': 'ancient-civilization',
  'military-history': 'military-history', 'journey-map': 'islamic-heritage',
  'portrait-biography': 'portrait-biography', 'women-leadership': 'women-leadership',
  'arts-culture': 'arts-culture', discovery: 'reader-story'
};
const ACCENTS = {
  october: '#d6ad55', history: '#d5b7ff', science: '#8ad9e8',
  women: '#d78bb2', people: '#e2b36d', curriculum: '#9bb7ff',
  islamic: '#78c59a', readers: '#d6ad55'
};
const REVERSE_VARIANT = Object.fromEntries(Object.entries(VARIANT_MAP).map(([a,b]) => [b,a]));
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const encodeOrganizationMarker = value => String(value).replace(/[%\]\r\n]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
const clone = x => JSON.parse(JSON.stringify(x));
function fail(message) { throw new Error('legacy story conversion stopped safely: ' + message); }
function requireObject(x, label) { if (!isObject(x)) fail(label + ' must be an object'); }
function isDidYouKnowText(text) {
  return /^هل تعلم[؟?:]|^did you know\?|^le saviez-vous\s*\?|^lo sapevi\s*\?|^wusstest du\s*\?/i.test(text);
}
function paragraphs(value, label = 'story text') {
  if (typeof value !== 'string' || !value.length) fail(label + ' must be non-empty text');
  const rows = value.split('\n\n');
  if (rows.some(x => !x.length || x !== x.trim()) || rows.join('\n\n') !== value) {
    fail(label + ' has whitespace or paragraph separators that cannot be round-tripped exactly');
  }
  return rows;
}
function textFromBlocks(blocks, speaker) {
  return blocks.filter(b => b.speaker === speaker).map(b => b.text).join('\n\n');
}
function toBlocks(karma, body) {
  const rows = [
    ...paragraphs(karma, 'karma_text').map(text => ({ type: 'paragraph', speaker: 'karma', text })),
    ...paragraphs(body, 'body').map(text => ({
      type: isDidYouKnowText(text) ? 'did_you_know' : 'paragraph',
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
function imageToStory(image, label, id) {
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
  if (!['archival','illustration','map','diagram'].includes(kind)) {
    fail(label + '.kind "' + kind + '" is not representable in the current unified story contract');
  }
  if (!/^https:\/\//i.test(String(image.source_url || ''))) fail(label + '.source_url must be HTTPS');
  return { ...source, id, kind, source_name: image.source_name, source_url: image.source_url,
    rights: image.rights, i18n };
}
function sourcesToStory(value) {
  if (typeof value !== 'string' || !value.trim()) fail('sources must be non-empty text');
  const lines = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const sources = lines.map((line, i) => {
    const matches = line.match(/https:\/\/[^\s)\]>]+/gi) || [];
    if (matches.length !== 1) fail('sources line ' + (i + 1) + ' must contain exactly one HTTPS URL for reversible conversion');
    const url = matches[0].replace(/[.,;:]+$/, '');
    const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    // unified story sources round-trip through a readable organization marker in legacy's
    // plain-text source field. Ordinary legacy lines retain their original title.
    const beforeUrl = line.slice(0, line.indexOf(matches[0])).trim();
    const marker = beforeUrl.match(/^(.*?) — \[org:([^\]]+)\] —$/);
    if (marker) {
      let organization;
      try { organization = decodeURIComponent(marker[2]); }
      catch { fail('sources line ' + (i + 1) + ' has malformed encoded organization metadata'); }
      const title = marker[1];
      return { title, organization, url, i18n: Object.fromEntries(LANGUAGES.map(lang => [lang, { title, organization }])) };
    }
    const title = line;
    return { title, organization: hostname, url, i18n: Object.fromEntries(LANGUAGES.map(lang => [lang, { title, organization: hostname }])) };
  });
  if (sources.length < 2 || new Set(sources.map(s => s.url)).size < 2) {
    fail('legacy package requires at least two distinct source URLs');
  }
  return sources;
}
function quizToStory(value) {
  let bank = value;
  if (typeof bank === 'string') {
    try { bank = JSON.parse(bank); } catch { fail('question_bank_json is not valid JSON'); }
  }
  const questions = bank?.questions;
  if (!Array.isArray(questions) || questions.length !== 5) fail('exactly five legacy quiz questions are required; received ' + (Array.isArray(questions) ? questions.length : 'a non-array value') + '; choose exactly five explicitly before conversion—no questions are discarded automatically');
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
function isNarratorRoleLabel(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
  return new Set([
    'راوي الحكاية',
    'story narrator',
    "narrateur de l'histoire",
    "narratrice de l'histoire",
    "narrateur de l’histoire",
    'narratore della storia',
    'narratrice della storia',
    'erzähler der geschichte',
    'erzählerin der geschichte'
  ]).has(normalized);
}
function metadataForLocale(v1, lang) {
  const keys = ['student_name','narrator_name','grade','narrator_grade','history_note','images_note','figure_name','person'];
  const baseValues = {
    student_name: v1.student_name, narrator_name: v1.narrator_name,
    grade: v1.grade, narrator_grade: v1.narrator_grade,
    history_note: v1.history_note, images_note: v1.images_note,
    figure_name: v1.figure_name, person: v1.person
  };
  const source = lang === 'ar' ? v1 : (v1.translations?.[lang] || {});
  const out = {};
  for (const key of keys) {
    const fallback = ['narrator_name','narrator_grade','figure_name','person'].includes(key)
      ? baseValues[key] : undefined;
    const value = source[key] ?? fallback;
    // A role label is not a school grade; don't misfile it as grade metadata.
    if ((key === 'grade' || key === 'narrator_grade') && isNarratorRoleLabel(value)) continue;
    // These fields are optional per locale. Preserve known translations even
    // when the source omitted another language; never synthesize the missing one.
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
function normalizeLegacyPackage(input) {
  const v1 = { ...input };
  const hasLegacySignature = ['section_key','visual_design','original_body','translations','images']
    .every(key => Object.hasOwn(v1, key));
  if (v1.format === undefined && hasLegacySignature) v1.format = LEGACY_PACKAGE_FORMAT;
  if (!LEGACY_PACKAGE_FORMAT_ALIASES.includes(v1.format)) fail('expected ' + LEGACY_PACKAGE_FORMAT + ' or a recognizable legacy package');
  if (!nonempty(v1.body) && nonempty(v1.current_body)) v1.body = v1.current_body;
  if (typeof v1.question_bank === 'string') {
    try { v1.question_bank = JSON.parse(v1.question_bank); }
    catch { fail('question_bank string is not valid JSON'); }
  }
  return v1;
}
export function legacyToStory(input, { slug, coverOverride } = {}) {
  requireObject(input, 'legacy package');
  input = normalizeLegacyPackage(input);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) fail('caller must provide a stable slug; it is never guessed from a title');
  const section = SECTION_MAP[input.section_key];
  if (!section) fail('unsupported section_key: ' + input.section_key);
  if (!nonempty(input.original_body)) fail('original_body is required and must remain unchanged');
  const variant = VARIANT_MAP[input.visual_design];
  if (!variant) fail('visual_design has no lossless story mapping: ' + input.visual_design);
  if (!Array.isArray(input.images) || input.images.length < 2 || input.images.length > 5) fail('legacy package requires between two and five gallery images');
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
  let coverSource = input.cover;
  if (coverOverride !== undefined) {
    if (input.cover !== null && input.cover !== undefined) {
      fail('coverOverride is only allowed when the legacy cover is missing or null');
    }
    requireObject(coverOverride, 'coverOverride');
    const coverLocator = coverOverride.url || coverOverride.path;
    if (!nonempty(coverLocator)) fail('coverOverride needs a verified url or path');
    if (input.images.some(im => (im?.url || im?.path) === coverLocator)) {
      fail('coverOverride duplicates a gallery image; choose a separate verified cover');
    }
    coverSource = coverOverride;
  }
  const cover = imageToStory(coverSource, 'cover', undefined);
  delete cover.id;
  const images = input.images.map((im, i) => imageToStory(im, 'images[' + i + ']', 'image-' + (i + 1)));
  const map = input.map_location === undefined ? null : input.map_location;
  return {
    format: STORY_FORMAT, slug, section,
    design: { variant, accent: ACCENTS[section] || '#d6ad55' },
    original_body: input.original_body,
    i18n, cover, images,
    sources: sourcesToStory(input.sources),
    quiz: quizToStory(input.question_bank),
    map_location: map === null ? null : clone(map)
  };
}
function imageToLegacy(image) {
  if (!['archival','illustration','diagram','map'].includes(image.kind)) {
    fail('unified story image kind "' + image.kind + '" has no valid legacy representation');
  }
  const ar = image.i18n.ar;
  if (ar.source_name !== image.source_name || ar.rights !== image.rights) {
    fail('Arabic image attribution/rights must match the legacy top-level fields');
  }
  const out = {
    ...('url' in image ? { url: image.url } : { path: image.path }),
    alt: ar.alt, caption: ar.caption, kind: image.kind,
    source_name: image.source_name, source_url: image.source_url, rights: image.rights,
    i18n: Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, clone(image.i18n[lang])]))
  };
  return out;
}
export function storyToLegacy(input) {
  requireObject(input, 'unified story');
  if (!isStoryFormat(input.format)) fail('expected ' + STORY_FORMAT + ' (legacy package formats remain readable during migration)');
  const contractErrors = validateForAdminBridge(input);
  if (contractErrors.length) fail('unified story admin-bridge validation failed: ' + contractErrors.join('; '));
  if (!['october','history','science','women','people','curriculum','islamic','readers'].includes(input.section)) {
    fail('unified story section has no canonical legacy section_key: ' + input.section);
  }
  if (!Array.isArray(input.sources) || input.sources.length < 2 ||
      new Set(input.sources.map(s => s?.url)).size < 2 ||
      !Array.isArray(input.quiz) || input.quiz.length !== 5 ||
      !Array.isArray(input.images) || input.images.length < 2 || input.images.length > 5) {
    fail('unified story requires at least two distinct sources, exactly five quiz questions, and between two and five images');
  }
  if (!nonempty(input.original_body)) fail('unified story original_body must be non-empty and preserved');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug || '')) fail('unified story slug must be stable lowercase kebab-case');
  requireObject(input.cover, 'unified story cover');
  if (Object.hasOwn(input.cover, 'id')) fail('unified story cover ID has no legacy representation');

  const section_key = input.section === 'women' ? 'learning' : input.section === 'people' ? 'fame' : input.section;
  const visual_design = REVERSE_VARIANT[input.design?.variant];
  if (!visual_design) fail('unified story design variant has no legacy equivalent: ' + input.design?.variant);
  if (input.design?.accent !== ACCENTS[input.section]) {
    fail('custom unified story accent cannot be represented by the legacy story package');
  }
  for (const [i, source] of input.sources.entries()) {
    if (!isObject(source) || !nonempty(source.title) || !nonempty(source.url) || !nonempty(source.organization)) {
      fail('source ' + (i + 1) + ' is incomplete');
    }
    let hostname = '';
    try { hostname = new URL(source.url).hostname; } catch {}
    if (!/^https:\/\//i.test(source.url) || !hostname) {
      fail('source ' + (i + 1) + ' URL must be valid HTTPS');
    }
    if (/[\r\n]/.test(source.title) || / — \[org:[^\]]+\] —/.test(source.title)) {
      fail('source ' + (i + 1) + ' title cannot be represented safely in the single-line legacy source field');
    }
    const matches = source.title.match(/https:\/\/[^\s)\]>]+/gi) || [];
    const titleUrl = matches[0]?.replace(/[.,;:]+$/, '');
    // Existing legacy lines have already encoded the URL in title; retain them byte-for-byte.
    if (matches.length === 1 && titleUrl === source.url && hostname === source.organization) continue;
    if (matches.length) fail('source ' + (i + 1) + ' title already contains a URL that cannot be represented unambiguously');
  }
  for (const [i, image] of input.images.entries()) {
    if (image?.id !== 'image-' + (i + 1)) fail('non-canonical image IDs cannot be represented losslessly in legacy');
  }
  for (const [i, question] of input.quiz.entries()) {
    if (question?.id !== 'question-' + (i + 1)) fail('non-canonical quiz IDs cannot be represented losslessly in legacy');
  }
  const translations = {};
  for (const lang of LANGUAGES) {
    const src = input.i18n?.[lang];
    if (!isObject(src)) fail('missing unified story locale ' + lang);
    for (const key of ['title', 'subtitle', 'summary']) {
      if (!nonempty(src[key])) fail(lang + '.' + key + ' is required');
    }
    if (src.summary !== src.subtitle) fail(lang + ' summary differs from subtitle and cannot be preserved by legacy');
    if (!Array.isArray(src.blocks) || src.blocks.length < 3) fail(lang + ' needs at least three story blocks');
    for (const [i, block] of src.blocks.entries()) {
      if (!isObject(block) || !['karma', 'narrator'].includes(block.speaker) ||
          !['paragraph', 'did_you_know'].includes(block.type) || !nonempty(block.text)) {
        fail(lang + ' block ' + (i + 1) + ' is incomplete');
      }
      if (Object.hasOwn(block, 'image_after')) fail(lang + ' block ' + (i + 1) + ' has inline image placement that legacy cannot preserve');
      if (!nonempty(block.text) || block.text !== block.text.trim() || /\n{2,}/.test(block.text)) {
        fail(lang + ' block ' + (i + 1) + ' has text whitespace that legacy cannot round-trip exactly');
      }
      const inferredType = isDidYouKnowText(block.text) ? 'did_you_know' : 'paragraph';
      if (block.type !== inferredType) fail(lang + ' block ' + (i + 1) + ' type cannot be preserved by legacy');
    }
  }
  for (const lang of LEGACY_LANGUAGES) {
    const src = input.i18n?.[lang];
    if (!isObject(src)) fail('missing unified story locale ' + lang);
    translations[lang] = {
      title: src.title, subtitle: src.subtitle,
      karma_text: textFromBlocks(src.blocks || [], 'karma'),
      body: textFromBlocks(src.blocks || [], 'narrator'),
      ...Object.fromEntries(['student_name','narrator_name','grade','narrator_grade','history_note','images_note','figure_name','person']
        .filter(k => Object.hasOwn(src, k)).map(k => [k, src[k]]))
    };
  }
  const ar = input.i18n?.ar;
  if (!isObject(ar)) fail('missing unified story Arabic locale');
  if (!nonempty(ar.figure_name) && !nonempty(ar.person)) {
    fail('Arabic figure_name or person is required for the current legacy admin record; title is not used as a substitute');
  }
  let sawNarrator = false;
  for (const [i, block] of (ar.blocks || []).entries()) {
    if (block.speaker === 'narrator') sawNarrator = true;
    if (block.speaker === 'karma' && sawNarrator) fail('Arabic block order interleaves Karma after narrator text; legacy stores these streams separately');
  }
  for (const lang of LEGACY_LANGUAGES) {
    let narratorSeen = false;
    for (const block of input.i18n[lang].blocks || []) {
      if (block.speaker === 'narrator') narratorSeen = true;
      if (block.speaker === 'karma' && narratorSeen) fail(lang + ' block order interleaves Karma after narrator text; legacy stores these streams separately');
    }
  }
  const question_bank = { questions: input.quiz.map((q, i) => {
    requireObject(q, 'quiz question ' + (i + 1));
    if (q.id !== 'question-' + (i + 1)) fail('non-canonical quiz IDs cannot be represented losslessly in legacy');
    if (!Number.isInteger(q.correct_option) || q.correct_option < 0 || q.correct_option > 3) {
      fail('quiz question ' + (i + 1) + ' has an invalid answer index');
    }
    requireObject(q.i18n, 'quiz question ' + (i + 1) + ' translations');
    for (const lang of LANGUAGES) {
      const text = q.i18n[lang];
      if (!isObject(text) || !nonempty(text.question) || !nonempty(text.explanation) ||
          !Array.isArray(text.options) || text.options.length !== 4 || !text.options.every(nonempty)) {
        fail('quiz question ' + (i + 1) + ' is incomplete in ' + lang);
      }
    }
    const qAr = q.i18n.ar;
    const i18n = Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, {
      q: q.i18n[lang].question, o: clone(q.i18n[lang].options), e: q.i18n[lang].explanation
    }]));
    return { q: qAr.question, o: clone(qAr.options), a: q.correct_option, e: qAr.explanation, i18n };
  }) };
  return {
    format: LEGACY_PACKAGE_FORMAT, section_key, figure_name: ar.figure_name || ar.person,
    title: ar.title, subtitle: ar.subtitle,
    narrator_name: ar.narrator_name || ar.student_name || '',
    narrator_grade: ar.narrator_grade || ar.grade || '',
    student_name: ar.student_name || ar.narrator_name || '',
    grade: ar.grade || ar.narrator_grade || '',
    original_body: input.original_body,
    karma_text: textFromBlocks(ar.blocks, 'karma'),
    body: textFromBlocks(ar.blocks, 'narrator'),
    history_note: ar.history_note || '', images_note: ar.images_note || '',
    sources: input.sources.map(s => {
      const matches = s.title.match(/https:\/\/[^\s)\]>]+/gi) || [];
      let hostname = '';
      try { hostname = new URL(s.url).hostname; } catch {}
      const alreadyLegacyLine = matches.length === 1 && matches[0].replace(/[.,;:]+$/, '') === s.url && hostname === s.organization;
      return alreadyLegacyLine ? s.title : (s.title + ' — [org:' + encodeOrganizationMarker(s.organization) + '] — ' + s.url);
    }).join('\n'),
    cover: imageToLegacy(input.cover),
    images: input.images.map(imageToLegacy),
    visual_design, map_location: input.map_location === undefined ? null : clone(input.map_location),
    translations, question_bank
  };
}


/**
 * Make a compatibility projection for an admin-only unified story draft.
 * This projection is intentionally NOT publishable: the caller must store the
 * complete validated unified story package separately and block the legacy legacy publisher.
 * It keeps all quiz questions but flattens narrator/Karma block order only in
 * the legacy projection; the authoritative unified story package remains unchanged.
 */
export function storyToAdminDraft(input) {
  requireObject(input, 'unified story draft');
  const errors = validateStory(input);
  if (errors.length) fail('unified story validation failed: ' + errors.join('; '));
  const section_key = input.section === 'women' ? 'learning'
    : input.section === 'people' ? 'fame' : input.section;
  if (!['october','history','science','learning','fame','curriculum','islamic','readers'].includes(section_key)) {
    fail('unified story section has no admin draft mapping: ' + input.section);
  }
  const visual_design = REVERSE_VARIANT[input.design?.variant];
  if (!visual_design) fail('unified story design variant has no admin draft mapping: ' + input.design?.variant);
  function projectionImage(image) {
    requireObject(image, 'unified story draft image');
    const ar = image.i18n?.ar;
    if (!isObject(ar)) fail('unified story draft image is missing Arabic metadata');
    // The old admin schema predates photograph/document kinds. This mapping is
    // display-only; the exact original kind remains in the stored unified story package.
    const kind = ['photograph','document'].includes(image.kind) ? 'archival' : image.kind;
    if (!['archival','illustration','diagram','map'].includes(kind)) fail('Unsupported image kind in admin projection: ' + image.kind);
    const out = {
      ...('url' in image ? { url: image.url } : { path: image.path }),
      alt: ar.alt, caption: ar.caption, kind,
      source_name: image.source_name, source_url: image.source_url, rights: image.rights,
      i18n: Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, clone(image.i18n[lang])]))
    };
    return out;
  }
  const translations = {};
  for (const lang of LEGACY_LANGUAGES) {
    const src = input.i18n[lang];
    translations[lang] = {
      title: src.title, subtitle: src.subtitle,
      karma_text: textFromBlocks(src.blocks || [], 'karma'),
      body: textFromBlocks(src.blocks || [], 'narrator'),
      student_name: src.student_name || input.i18n.ar.student_name || '',
      grade: src.grade || input.i18n.ar.grade || '',
      history_note: src.history_note || '',
      images_note: src.images_note || ({en:'Image source and rights details are preserved in the unified story draft package and require review.',fr:'Les sources et les droits des images sont conservés dans le dossier unified story et doivent être vérifiés.',it:'Le fonti e i diritti delle immagini sono conservati nel pacchetto unified story e devono essere verificati.',de:'Bildquellen und Nutzungsrechte bleiben im unified story-Paket erhalten und müssen geprüft werden.'})[lang]
    };
  }
  const question_bank = { questions: input.quiz.map((q, i) => {
    const ar = q.i18n.ar;
    return {
      q: ar.question, o: clone(ar.options), a: q.correct_option, e: ar.explanation,
      i18n: Object.fromEntries(LEGACY_LANGUAGES.map(lang => [lang, {
        q: q.i18n[lang].question, o: clone(q.i18n[lang].options), e: q.i18n[lang].explanation
      }]))
    };
  }) };
  const sources = input.sources.map(source => {
    const title = source.i18n?.ar?.title || source.title;
    return title + ' — [org:' + encodeOrganizationMarker(source.organization) + '] — ' + source.url;
  }).join('\n');
  const ar = input.i18n.ar;
  return {
    format: LEGACY_PACKAGE_FORMAT, section_key,
    figure_name: ar.figure_name || ar.person || ar.title,
    title: ar.title, subtitle: ar.subtitle,
    narrator_name: ar.narrator_name || ar.student_name || 'كارما',
    narrator_grade: ar.narrator_grade || ar.grade || '',
    student_name: ar.student_name || ar.narrator_name || '',
    grade: ar.grade || ar.narrator_grade || '',
    original_body: input.original_body,
    karma_text: textFromBlocks(ar.blocks || [], 'karma'),
    body: textFromBlocks(ar.blocks || [], 'narrator'),
    history_note: ar.history_note || '',
    sources,
    images_note: ar.images_note || 'بيانات المصدر والحقوق التفصيلية محفوظة في حزمة unified story وتحتاج إلى مراجعة.',
    cover: projectionImage(input.cover),
    images: input.images.map(projectionImage),
    visual_design, map_location: input.map_location === undefined ? null : clone(input.map_location),
    translations, question_bank
  };
}

// Canonical semantic aliases; legacy names remain exported for old integrations.

