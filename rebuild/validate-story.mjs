export const LANGUAGES = ['ar', 'en', 'fr', 'it', 'de'];
const sections = new Set(['october', 'history', 'science', 'women', 'people', 'curriculum', 'islamic', 'readers']);
const variants = new Set(['military-history', 'ancient-civilization', 'science-lab', 'women-leadership', 'arts-culture', 'islamic-heritage', 'curriculum', 'reader-story', 'portrait-biography']);
const kinds = new Set(['archival', 'illustration', 'map', 'diagram', 'photograph', 'document']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const https = x => typeof x === 'string' && /^https:\/\//i.test(x);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

function keysCheck(value, required, allowed, label, out) {
  if (!isObject(value)) {
    out.push(label + ': object required');
    return false;
  }
  for (const key of required) if (!Object.hasOwn(value, key)) out.push(label + '.' + key + ' required');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) out.push(label + ': unexpected property "' + key + '"');
  return true;
}
function languageObjectCheck(value, label, out) {
  keysCheck(value, LANGUAGES, LANGUAGES, label, out);
}
function imageCheck(im, label, out) {
  const allowed = ['url', 'path', 'kind', 'source_name', 'source_url', 'rights', 'i18n', 'id'];
  if (!keysCheck(im, ['kind', 'source_name', 'source_url', 'rights', 'i18n'], allowed, label, out)) return;
  const hasUrl = Object.hasOwn(im, 'url');
  const hasPath = Object.hasOwn(im, 'path');
  if (hasUrl === hasPath) out.push(label + ': provide exactly one HTTPS url or local path');
  if (hasUrl && !https(im.url)) out.push(label + '.url must be HTTPS');
  if (hasPath && (typeof im.path !== 'string' ||
      !/^(assets\/images|images|stories)\/[^.\s][^\s]*$/.test(im.path) ||
      im.path.split('/').some(part => !part || part === '.' || part === '..') ||
      im.path.includes('\\') || im.path.startsWith('/'))) {
    out.push(label + ': unsafe local path');
  }
  if (!kinds.has(im.kind)) out.push(label + ': invalid kind');
  if (!nonempty(im.source_name)) out.push(label + ': source_name required');
  if (!https(im.source_url)) out.push(label + ': source_url must be HTTPS');
  if (!nonempty(im.rights)) out.push(label + ': rights required');
  if (!isObject(im.i18n)) {
    out.push(label + '.i18n must be an object');
    return;
  }
  languageObjectCheck(im.i18n, label + '.i18n', out);
  for (const lang of LANGUAGES) {
    const t = im.i18n[lang];
    if (!keysCheck(t, ['alt', 'caption', 'source_name', 'rights'], ['alt', 'caption', 'source_name', 'rights'], label + '.i18n.' + lang, out)) continue;
    for (const key of ['alt', 'caption', 'source_name', 'rights']) {
      if (!nonempty(t[key])) out.push(label + '.i18n.' + lang + '.' + key + ' required');
    }
  }
  if (Object.hasOwn(im, 'id') && !/^[a-z0-9-]+$/.test(im.id || '')) {
    out.push(label + '.id must be a lowercase stable ID');
  }
}
export function validateStory(s) {
  const out = [];
  const topRequired = ['format', 'slug', 'section', 'design', 'original_body', 'i18n', 'cover', 'images', 'sources', 'quiz'];
  const topAllowed = [...topRequired, 'map_location'];
  if (!keysCheck(s, topRequired, topAllowed, 'story', out)) return out;
  if (s.format !== 'KHALEDOON_STORY') out.push('format must be KHALEDOON_STORY; normalize transitional inputs before validation');
  if (typeof s.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug)) out.push('slug must be lowercase kebab-case');
  if (!sections.has(s.section)) out.push('section is unsupported');
  if (keysCheck(s.design, ['variant', 'accent'], ['variant', 'accent'], 'design', out)) {
    if (!variants.has(s.design.variant)) out.push('design.variant missing or unsupported');
    if (typeof s.design.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.design.accent)) out.push('design.accent must be a six-digit hex color');
  }
  if (!nonempty(s.original_body)) out.push('original_body must preserve submitted source text');

  // map_location is optional; null explicitly means no verified location.
  // A non-null location must carry translated place labels and a verifiable source.
  if (Object.hasOwn(s, 'map_location') && s.map_location !== null) {
    const m = s.map_location;
    const allowedMapKeys = ['lat', 'lng', 'place', 'place_label', 'source_name', 'source_url', 'approximate'];
    if (!isObject(m)) out.push('map_location must be null or an object');
    else {
      for (const key of Object.keys(m)) if (!allowedMapKeys.includes(key)) out.push('map_location: unexpected property "' + key + '"');
      if (typeof m.lat !== 'number' || !Number.isFinite(m.lat) || m.lat < -90 || m.lat > 90) out.push('map_location.lat must be a valid latitude');
      if (typeof m.lng !== 'number' || !Number.isFinite(m.lng) || m.lng < -180 || m.lng > 180) out.push('map_location.lng must be a valid longitude');
      for (const field of ['place', 'place_label', 'source_name']) {
        if (field !== 'place' && (m[field] === undefined || m[field] === null)) continue;
        if (!isObject(m[field])) { out.push('map_location.' + field + ' must be translated into all five languages'); continue; }
        languageObjectCheck(m[field], 'map_location.' + field, out);
        for (const lang of LANGUAGES) {
          if (!nonempty(m[field][lang])) out.push('map_location.' + field + '.' + lang + ' required');
          else if (lang !== 'ar' && /[\u0600-\u06FF]/.test(m[field][lang])) out.push('map_location.' + field + '.' + lang + ' must not contain Arabic fallback');
        }
        for (const key of Object.keys(m[field])) if (!LANGUAGES.includes(key)) out.push('map_location.' + field + ': unsupported locale "' + key + '"');
      }
      if (m.source_url !== undefined && !https(m.source_url)) out.push('map_location.source_url must be HTTPS');
      if ((m.source_name === undefined) !== (m.source_url === undefined)) out.push('map_location.source_name and source_url must be provided together; the V2 publishing gate requires both.');
      if (m.approximate !== undefined && typeof m.approximate !== 'boolean') out.push('map_location.approximate must be boolean');
    }
  }
  if (isObject(s.i18n)) {
    languageObjectCheck(s.i18n, 'i18n', out);
    for (const lang of LANGUAGES) {
      const t = s.i18n[lang];
      if (!keysCheck(t, ['title', 'subtitle', 'summary', 'blocks'], ['title', 'subtitle', 'summary', 'blocks', 'student_name', 'narrator_name', 'grade', 'narrator_grade', 'history_note', 'images_note', 'figure_name', 'person'], 'i18n.' + lang, out)) continue;
      for (const key of ['title', 'subtitle', 'summary']) if (!nonempty(t[key])) out.push('i18n.' + lang + '.' + key + ' required');
      if (!Array.isArray(t.blocks) || t.blocks.length < 3) out.push('i18n.' + lang + '.blocks needs at least 3 blocks');
      for (const [i, b] of (Array.isArray(t.blocks) ? t.blocks : []).entries()) {
        const label = 'i18n.' + lang + '.blocks[' + i + ']';
        if (!keysCheck(b, ['type', 'speaker', 'text'], ['type', 'speaker', 'text', 'image_after', 'heading'], label, out)) continue;
        if (!['paragraph', 'did_you_know', 'science_note', 'timeline'].includes(b.type)) out.push(label + '.type invalid');
        if (Object.hasOwn(b, 'heading') && !nonempty(b.heading)) out.push(label + '.heading must be a non-empty string when provided');
        if (b.type === 'timeline' && !(typeof b.text === 'string' && b.text.split('\n').every(line => /\S.*\s—\s\S/.test(line)))) out.push(label + '.text must be lines of "year — event" for a timeline');
        if (!['karma', 'narrator'].includes(b.speaker)) out.push(label + '.speaker invalid');
        if (!nonempty(b.text)) out.push(label + '.text required');
        if (Object.hasOwn(b, 'image_after') && !nonempty(b.image_after)) out.push(label + '.image_after must be a non-empty image ID when provided');
      }
    }
  } else out.push('i18n must be an object');

  // Optional legacy metadata is preserved per locale. A missing translation is
  // not a validation error and must never be invented just to fill the schema.
  const preservedFields = ['student_name', 'narrator_name', 'grade', 'narrator_grade', 'history_note', 'images_note', 'figure_name', 'person'];
  for (const field of preservedFields) {
    const presentSomewhere = LANGUAGES.some(lang => isObject(s.i18n?.[lang]) && Object.hasOwn(s.i18n[lang], field));
    if (!presentSomewhere) continue;
    for (const lang of LANGUAGES) {
      const locale = s.i18n?.[lang];
      if (!isObject(locale) || !Object.hasOwn(locale, field)) {
        out.push('i18n.' + lang + '.' + field + ' required in every locale when used');
        continue;
      }
      if (['history_note', 'images_note'].includes(field)) {
        if (typeof locale[field] !== 'string') out.push('i18n.' + lang + '.' + field + ' must be a string when provided');
      } else if (!nonempty(locale[field])) {
        out.push('i18n.' + lang + '.' + field + ' must be non-empty when provided');
      }
    }
  }

  imageCheck(s.cover, 'cover', out);
  if (!Array.isArray(s.images) || s.images.length < 2) out.push('images must contain at least 2 images');
  const imageIds = new Set();
  for (const [i, im] of (Array.isArray(s.images) ? s.images : []).entries()) {
    imageCheck(im, 'images[' + i + ']', out);
    // Gallery images must carry a stable ID (image_after refers to it); the cover has none.
    if (imageIds.has(im?.id)) out.push('images[' + i + '].id duplicated');
    if (im?.id) imageIds.add(im.id);
  }
  for (const lang of LANGUAGES) for (const [i, b] of (Array.isArray(s.i18n?.[lang]?.blocks) ? s.i18n[lang].blocks : []).entries()) {
    if (b?.image_after && !imageIds.has(b.image_after)) out.push('i18n.' + lang + '.blocks[' + i + '].image_after references missing image "' + b.image_after + '"');
  }

  if (!Array.isArray(s.sources) || s.sources.length < 2) out.push('at least two sources required');
  const sourceUrls = new Set();
  for (const [i, src] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    const label = 'sources[' + i + ']';
    if (!keysCheck(src, ['title', 'organization', 'url', 'i18n'], ['title', 'organization', 'url', 'i18n', 'accessed_at'], label, out)) continue;
    for (const key of ['title', 'organization']) if (!nonempty(src[key])) out.push(label + '.' + key + ' required');
    if (!https(src.url)) out.push(label + '.url must be HTTPS');
    if (!isObject(src.i18n)) out.push(label + '.i18n must be an object with all five locales');
    else {
      languageObjectCheck(src.i18n, label + '.i18n', out);
      for (const lang of LANGUAGES) {
        const localized = src.i18n[lang], locLabel = label + '.i18n.' + lang;
        if (!keysCheck(localized, ['title', 'organization'], ['title', 'organization'], locLabel, out)) continue;
        for (const key of ['title', 'organization']) if (!nonempty(localized[key])) out.push(locLabel + '.' + key + ' required');
      }
    }
    if (https(src.url) && sourceUrls.has(src.url)) out.push(label + '.url must be distinct from other source URLs');
    if (https(src.url)) sourceUrls.add(src.url);
    if (Object.hasOwn(src, 'accessed_at') && !nonempty(src.accessed_at)) out.push(label + '.accessed_at must be a non-empty string when provided');
  }

  if (!Array.isArray(s.quiz) || s.quiz.length < 5) out.push('quiz must contain at least 5 questions');
  const ids = new Set();
  for (const [i, q] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
    const label = 'quiz[' + i + ']';
    if (!keysCheck(q, ['id', 'correct_option', 'i18n'], ['id', 'correct_option', 'i18n'], label, out)) continue;
    if (typeof q.id !== 'string' || !/^[a-z0-9-]+$/.test(q.id)) out.push(label + '.id must be a stable lowercase ID');
    if (ids.has(q.id)) out.push(label + '.id duplicated');
    if (q.id) ids.add(q.id);
    if (!Number.isInteger(q.correct_option) || q.correct_option < 0 || q.correct_option > 3) out.push(label + '.correct_option must be 0..3');
    if (!isObject(q.i18n)) { out.push(label + '.i18n must be an object'); continue; }
    languageObjectCheck(q.i18n, label + '.i18n', out);
    for (const lang of LANGUAGES) {
      const t = q.i18n[lang], tLabel = label + '.i18n.' + lang;
      if (!keysCheck(t, ['question', 'options', 'explanation'], ['question', 'options', 'explanation'], tLabel, out)) continue;
      if (!nonempty(t.question)) out.push(tLabel + '.question required');
      if (!Array.isArray(t.options) || t.options.length !== 4 || !t.options.every(nonempty)) out.push(tLabel + '.options must contain 4 non-empty choices');
      if (!nonempty(t.explanation)) out.push(tLabel + '.explanation required');
    }
  }
  return out;
}

/**
 * Validate whether a canonical story package can pass through the
 * temporary legacy-shaped admin preview projection without losing canonical fields.
 * Keep these constraints out of validateStory(): they are not V2 contract rules.
 */
export function validateForAdminBridge(s) {
  const out = [...validateStory(s)];
  if (!isObject(s)) return out;
  if (!Array.isArray(s.quiz) || s.quiz.length !== 5) out.push('bridge: legacy admin round-trip supports exactly 5 quiz questions');
  if (!Array.isArray(s.images) || s.images.length < 2 || s.images.length > 5) out.push('bridge: legacy admin round-trip supports 2 to 5 images');
  for (const lang of LANGUAGES) {
    const t = s.i18n?.[lang];
    if (!isObject(t)) continue;
    if (nonempty(t.subtitle) && nonempty(t.summary) && t.summary !== t.subtitle) {
      out.push('bridge: i18n.' + lang + '.summary differs from subtitle and V1 cannot preserve it');
    }
    for (const [i, block] of (Array.isArray(t.blocks) ? t.blocks : []).entries()) {
      if (Object.hasOwn(block || {}, 'image_after')) {
        out.push('bridge: i18n.' + lang + '.blocks[' + i + '].image_after cannot be represented by the legacy projection');
      }
    }
  }
  for (const [i, image] of (Array.isArray(s.images) ? s.images : []).entries()) {
    if (/^[a-z0-9-]+$/.test(image?.id || '') && image.id !== 'image-' + (i + 1)) out.push('bridge: images[' + i + '].id must be image-' + (i + 1));
    if (['photograph', 'document'].includes(image?.kind)) {
      out.push('bridge: images[' + i + '].kind "' + image.kind + '" is not supported by the legacy projection');
    }
  }
  for (const [i, source] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    if (isObject(source) && Object.hasOwn(source, 'accessed_at')) {
      out.push('bridge: sources[' + i + '].accessed_at metadata has no legacy projection field');
    }
  }
  for (const [i, question] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
    if (question?.id !== 'question-' + (i + 1)) out.push('bridge: quiz[' + i + '].id must be question-' + (i + 1));
  }
  if (s.cover && ['photograph', 'document'].includes(s.cover.kind)) {
    out.push('bridge: cover.kind "' + s.cover.kind + '" is not supported by V1');
  }
  return out;
}

export async function validateLocalImagePaths(story, root) {
  const { realpath, stat } = await import('node:fs/promises');
  const path = await import('node:path');
  const out = [];
  const all = [story?.cover, ...(Array.isArray(story?.images) ? story.images : [])];
  let base;
  try { base = await realpath(root); }
  catch { return ['story root does not exist']; }
  for (const [i, im] of all.entries()) if (im?.path) {
    if (typeof im.path !== 'string') { out.push('image[' + i + '] path must be a string'); continue; }
    const target = path.resolve(base, im.path);
    if (!target.startsWith(base + path.sep)) { out.push('image[' + i + '] escapes story root'); continue; }
    try {
      const resolved = await realpath(target);
      if (!resolved.startsWith(base + path.sep)) { out.push('image[' + i + '] resolves outside story root'); continue; }
      if (!(await stat(resolved)).isFile()) out.push('image[' + i + '] is not a file: ' + im.path);
    } catch { out.push('image[' + i + '] file missing: ' + im.path); }
  }
  return out;
}
if (typeof process !== 'undefined' && process.argv?.[1]) {
  const nodePath = await import('node:path');
  if (import.meta.url === new URL('file://' + nodePath.default.resolve(process.argv[1])).href) {
    const filename = process.argv[2];
    if (!filename) { console.error('Usage: node rebuild/validate-story.mjs <story.json>'); process.exitCode = 2; }
    else try {
      const { readFile } = await import('node:fs/promises');
      const story = JSON.parse(await readFile(filename, 'utf8'));
      const problems = [...validateStory(story), ...await validateLocalImagePaths(story, process.cwd())];
      if (problems.length) { console.error('Rejected (' + problems.length + '):\n- ' + problems.join('\n- ')); process.exitCode = 1; }
      else console.log('Story contract passed.');
    } catch (e) { console.error('Unable to read/parse JSON: ' + e.message); process.exitCode = 2; }
  }
}
