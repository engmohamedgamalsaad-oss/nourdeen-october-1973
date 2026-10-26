import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
export const LANGUAGES = ['ar','en','fr','it','de'];
const sections = new Set(['october','history','science','women','people','curriculum','islamic','readers']);
const variants = new Set(['military-history','ancient-civilization','science-lab','women-leadership','arts-culture','islamic-heritage','curriculum','reader-story','portrait-biography']);
const kinds = new Set(['archival','photograph','illustration','map','document']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const https = x => typeof x === 'string' && /^https:\/\//i.test(x);
function imageCheck(im, label, out) {
  if (!im || typeof im !== 'object') { out.push(label + ': image object required'); return; }
  const urlOk = https(im.url), pathOk = nonempty(im.path);
  if (urlOk === pathOk) out.push(label + ': provide exactly one HTTPS url or local path');
  if (pathOk && (!/^(assets\/images|images|stories)\/[^.\s][^\s]*$/.test(im.path) || im.path.includes('..') || im.path.includes('\\'))) out.push(label + ': unsafe local path');
  if (!kinds.has(im.kind)) out.push(label + ': invalid kind');
  if (!nonempty(im.source_name)) out.push(label + ': source_name required');
  if (!https(im.source_url)) out.push(label + ': source_url must be HTTPS');
  if (!nonempty(im.rights)) out.push(label + ': rights required');
  for (const lang of LANGUAGES) for (const key of ['alt','caption','source_name','rights']) {
    if (!nonempty(im.i18n?.[lang]?.[key])) out.push(label + '.i18n.' + lang + '.' + key + ' required');
  }
}
export function validateStory(s) {
  const out = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['story must be an object'];
  if (s.format !== 'KHALEDOON_STORY_V2') out.push('format must be KHALEDOON_STORY_V2');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug || '')) out.push('slug must be lowercase kebab-case');
  if (!sections.has(s.section)) out.push('section is unsupported');
  if (!variants.has(s.design?.variant)) out.push('design.variant missing or unsupported');
  if (!/^#[0-9a-f]{6}$/i.test(s.design?.accent || '')) out.push('design.accent must be a six-digit hex color');
  if (!nonempty(s.original_body)) out.push('original_body must preserve submitted source text');
  for (const lang of LANGUAGES) {
    const t = s.i18n?.[lang];
    if (!t) { out.push('i18n.' + lang + ' required'); continue; }
    for (const key of ['title','subtitle','summary']) if (!nonempty(t[key])) out.push('i18n.' + lang + '.' + key + ' required');
    if (!Array.isArray(t.blocks) || t.blocks.length < 3) out.push('i18n.' + lang + '.blocks needs at least 3 blocks');
    for (const [i,b] of (Array.isArray(t.blocks) ? t.blocks : []).entries()) {
      if (!['paragraph','did_you_know'].includes(b?.type)) out.push(`i18n.${lang}.blocks[${i}].type invalid`);
      if (!['karma','narrator'].includes(b?.speaker)) out.push(`i18n.${lang}.blocks[${i}].speaker invalid`);
      if (!nonempty(b?.text)) out.push(`i18n.${lang}.blocks[${i}].text required`);
    }
  }
  imageCheck(s.cover,'cover',out);
  if (!Array.isArray(s.images) || s.images.length < 2) out.push('images must contain at least 2 images');
  for (const [i,im] of (Array.isArray(s.images) ? s.images : []).entries()) imageCheck(im,'images['+i+']',out);
  if (!Array.isArray(s.sources) || !s.sources.length) out.push('at least one source required');
  for (const [i,src] of (Array.isArray(s.sources) ? s.sources : []).entries()) {
    for (const key of ['title','organization']) if (!nonempty(src?.[key])) out.push(`sources[${i}].${key} required`);
    if (!https(src?.url)) out.push(`sources[${i}].url must be HTTPS`);
  }
  if (!Array.isArray(s.quiz) || s.quiz.length !== 5) out.push('quiz must contain exactly 5 questions');
  const ids = new Set();
  for (const [i,q] of (Array.isArray(s.quiz) ? s.quiz : []).entries()) {
    if (!nonempty(q?.id)) out.push(`quiz[${i}].id required`);
    if (ids.has(q?.id)) out.push(`quiz[${i}].id duplicated`);
    if (q?.id) ids.add(q.id);
    if (!Number.isInteger(q?.correct_option) || q.correct_option < 0 || q.correct_option > 3) out.push(`quiz[${i}].correct_option must be 0..3`);
    for (const lang of LANGUAGES) {
      const t = q?.i18n?.[lang];
      if (!nonempty(t?.question)) out.push(`quiz[${i}].i18n.${lang}.question required`);
      if (!Array.isArray(t?.options) || t.options.length !== 4 || !t.options.every(nonempty)) out.push(`quiz[${i}].i18n.${lang}.options must contain 4 choices`);
      if (!nonempty(t?.explanation)) out.push(`quiz[${i}].i18n.${lang}.explanation required`);
    }
  }
  return out;
}
export async function validateLocalImagePaths(story, root) {
  const out = [], all = [story?.cover, ...(Array.isArray(story?.images) ? story.images : [])];
  const base = path.resolve(root);
  for (const [i,im] of all.entries()) if (im?.path) {
    const target = path.resolve(base, im.path);
    if (!target.startsWith(base + path.sep)) { out.push(`image[${i}] escapes story root`); continue; }
    try { await access(target); } catch { out.push(`image[${i}] file missing: ${im.path}`); }
  }
  return out;
}
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  const filename = process.argv[2];
  if (!filename) { console.error('Usage: node rebuild/validate-story.mjs <story.json>'); process.exitCode = 2; }
  else try {
    const story = JSON.parse(await readFile(filename,'utf8')), problems = validateStory(story);
    if (problems.length) { console.error('Rejected (' + problems.length + '):\n- ' + problems.join('\n- ')); process.exitCode = 1; }
    else console.log('Story contract passed.');
  } catch (e) { console.error('Unable to read/parse JSON: ' + e.message); process.exitCode = 2; }
}
