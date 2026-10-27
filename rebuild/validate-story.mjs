import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const LANGUAGES = ['ar', 'en', 'fr', 'it', 'de'];
const sections = new Set(['october', 'history', 'science', 'women', 'people', 'curriculum', 'islamic', 'readers']);
const variants = new Set(['military-history', 'ancient-civilization', 'science-lab', 'women-leadership', 'arts-culture', 'islamic-heritage', 'curriculum', 'reader-story', 'portrait-biography']);
const kinds = new Set(['archival', 'photograph', 'illustration', 'map', 'document']);
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
    out.push(label + '.id must be a stable lowercase ID');
  }
}
export function validateStory(s) {
  const out = [];
  const topKeys = ['format', 'slug', 'section', 'design', 'original_body', 'i18n', 'cover', 'images', 'sources', 'quiz'];
  if (!keysCheck(s, topKeys, topKeys, 'story', out)) return out;
  if (s.format !== 'KHALEDOON_STORY_V2') out.push('format must be KHALEDOON_STORY_V2');
  if (typeof s.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug)) out.push('slug must be lowercase kebab-case');
  if (!sections.has(s.section)) out.push('section is unsupported');
  if (keysCheck(s.design, ['variant', 'accent'], ['variant', 'accent'], 'design', out)) {
    if (!variants.has(s.design.variant)) out.push('design.variant missing or unsupported');
    if (typeof s.design.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.design.accent)) out.push('design.accent must be a six-digit hex color');
  }
  if (!nonempty(s.original_body)) out.push('original_body must preserve submitted source text');
  if (isObject(s.i18n)) {
    languageObjectCheck(s.i18n, 'i18n', out);
    for (const lang of LANGUAGES) {
      const t = s.i18n[lang];
      if (!keysCheck(t, ['title', 'subtitle', 'summary', 'blocks'], ['title', 'subtitle', 'summary', 'blocks'], 'i18n.' + lang, out)) continue;
      for (const key of ['title', 'subtitle', 'summary']) if (!nonempty(t[key])) out.push('i18n.' + lang + '.' + key + ' required');
      if (!Array.isArray(t.blocks) || t.blocks.length < 3) out.push('i18n.' + lang + '.blocks needs at least 3 blocks');
      for (const [i, b] of (Array.isArray(t.blocks) ? t.blocks : []).entries()) {
        const label = 'i18n.' + lang + '.blocks[' + i + ']';
        if (!keysCheck(b, ['type', 'speaker', 'text'], ['type', 'speaker', 'text', 'image_after'], label, out)) continue;
        if (!['paragraph', 'did_you_know'].includes(b.type)) out.push(label + '.type invalid');
        if (!['karma', 'narrator'].includes(b.speaker)) out.push(label + '.speaker invalid');
        if (!nonempty(b.text)) out.push(label + '.text required');
        if (Object.hasOwn(b, 'image_after') && !nonempty(b.image_after)) out.push(label + '.image_after must be a non-empty image ID when provided');
      }
    }
  } else out.push('i18n must be an object');

  imageCheck(s.cover, 'cover', out);
  if (!Array.isArray(s.images) || s.images.length < 2) out.push('images must contain at least 2 images');
  const imageIds = new Set();
  for (const [i, im] of (Array.isArray(s.images) ? s.images : []).entries()) {
    imageCheck(im, 'images[' + i + ']', out);
    if (!/^[a-z0-9-]+$/.test(im?.id || '')) out.push('images[' + i + '].id must be a stable lowercase ID');
    if (imageIds.has(im?.id)) out.push('images[' + i + '].id duplicated');
    if (im?.id) imageIds.add(im.id);
  }
  for (const lang of LANGUAGES) for (const [i, b] of (Array.isArray(s.i18n?.[lang]?.blocks) ? s.i18n[lang].blocks : []).entries()) {
    if (b?.image_after && !imageIds.has(b.image_after)) out.push('i18n.' + lang + '.blocks[' + i + '].image_after references missing image "' + b.image_after + '"');
  }

  if (!Array.isArray(s.sources) || !s.sources.length) out.push('at least one source required');
  for (const [i, src] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    const label = 'sources[' + i + ']';
    if (!keysCheck(src, ['title', 'organization', 'url'], ['title', 'organization', 'url', 'accessed_at'], label, out)) continue;
    for (const key of ['title', 'organization']) if (!nonempty(src[key])) out.push(label + '.' + key + ' required');
    if (!https(src.url)) out.push(label + '.url must be HTTPS');
    if (Object.hasOwn(src, 'accessed_at') && typeof src.accessed_at !== 'string') out.push(label + '.accessed_at must be a string');
  }

  if (!Array.isArray(s.quiz) || s.quiz.length !== 5) out.push('quiz must contain exactly 5 questions');
  const ids = new Set();
  for (const [i, q] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
    const label = 'quiz[' + i + ']';
    if (!keysCheck(q, ['id', 'correct_option', 'i18n'], ['id', 'correct_option', 'i18n'], label, out)) continue;
    if (typeof q.id !== 'string' || !/^[a-z0-9-]+$/.test(q.id)) out.push(label + '.id must be a lowercase stable ID');
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
export async function validateLocalImagePaths(story, root) {
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
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  const filename = process.argv[2];
  if (!filename) { console.error('Usage: node rebuild/validate-story.mjs <story.json>'); process.exitCode = 2; }
  else try {
    const story = JSON.parse(await readFile(filename, 'utf8'));
    const problems = [...validateStory(story), ...await validateLocalImagePaths(story, process.cwd())];
    if (problems.length) { console.error('Rejected (' + problems.length + '):\n- ' + problems.join('\n- ')); process.exitCode = 1; }
    else console.log('Story contract passed.');
  } catch (e) { console.error('Unable to read/parse JSON: ' + e.message); process.exitCode = 2; }
}
