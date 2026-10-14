'use strict';
/* Static regression checks for the homepage-only language flow. Uses Node built-ins only. */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const shared = 'assets/shared/home-language-only.js';
const mustLoad = [
  'khaledoon/collections/curriculum.html',
  'khaledoon/collections/history.html',
  'khaledoon/collections/knowledge.html',
  'khaledoon/collections/october.html',
  'khaledoon/collections/people.html',
  'khaledoon/collections/science.html',
  'preview/collections/fame.html',
  'preview/collections/history.html',
  'preview/collections/learning.html',
  'preview/collections/october.html',
  'preview/collections/participation.html',
  'preview/collections/science.html',
  'khaledoon-preview.html',
  'read.html',
  'quiz.html',
  'submit.html',
  'october.html',
  'october/index.html',
  'o/index.html',
  'khaledoon/submit.html',
  ...['001','002','003','004','005','006','007'].map(id => `stories/${id}/index.html`),
  ...['october/001','october/002','october/003','october/004','history/005','history/006','science/007'].map(id => `stories/${id}/index.html`)
];
const failures = [];
function read(rel) {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  catch (e) { failures.push(`Missing file: ${rel}`); return ''; }
}
const sharedSource = read(shared);
if (!sharedSource.includes("['ar','en','fr','it']")) failures.push('Shared script supported-language allowlist changed unexpectedly.');
if (!sharedSource.includes("localStorage.getItem('kh-lang')")) failures.push('Shared script does not read the homepage language key.');
if (!sharedSource.includes('history.replaceState')) failures.push('Shared script does not remove stale lang query overrides.');

for (const rel of mustLoad) {
  const html = read(rel);
  const marker = 'home-language-only.js';
  const at = html.indexOf(marker);
  if (at < 0) { failures.push(`Language script not included: ${rel}`); continue; }
  const tagStart = html.lastIndexOf('<script', at);
  const tagEnd = html.indexOf('>', at);
  const tag = html.slice(tagStart, tagEnd + 1);
  const srcMatch = tag.match(/src=["']([^"']*home-language-only\.js)["']/);
  if (!srcMatch) { failures.push(`Invalid script tag: ${rel}`); continue; }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), srcMatch[1].split('?')[0]));
  if (resolved !== shared) failures.push(`Wrong script path in ${rel}: ${srcMatch[1]} resolves to ${resolved}`);
  const translationAt = html.search(/(?:i18n(?:-extra)?\.js|translations\.js|page\.js)/i);
  if (translationAt >= 0 && at > translationAt) failures.push(`Language script must precede translation scripts: ${rel}`);
}
const home = read('index.html');
if (home.includes('home-language-only.js')) failures.push('Homepage must keep its language chooser visible.');
if (home.includes('khaledoon-de.js')) failures.push('German-only homepage overlay must stay disabled until full German coverage.');
if (failures.length) {
  console.error('Homepage language-flow checks FAILED:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  console.log(`Homepage language-flow checks passed (${mustLoad.length} entry points; AR/EN/FR/IT; German remains gated).`);
}
