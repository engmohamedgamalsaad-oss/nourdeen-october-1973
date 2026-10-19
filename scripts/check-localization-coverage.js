#!/usr/bin/env node
'use strict';

/*
 * Localization release gate for Khaledoon.
 * Run from the repository root: node scripts/check-localization-coverage.js
 * This intentionally fails until German translations are complete; it must
 * never treat Arabic fallback as a valid translation.
 */
const fs = require('node:fs');
const path = require('node:path');

const required = ['ar', 'en', 'fr', 'it', 'de'];
const storyFiles = [
  'stories/october/001/i18n.js',
  'stories/october/002/i18n.js',
  'stories/october/003/i18n.js',
  'stories/october/004/i18n.js',
  'stories/history/005/translations.js'
];
const translationMaps = [
  'assets/shared/story-body-i18n.js',
  'assets/i18n/story-common.js'
];
const problems = [];
const read = p => {
  try { return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
  catch (e) { problems.push('Missing/unreadable file: ' + p); return ''; }
};

const engine = read('assets/shared/i18n.js');
const languageConfig = read('assets/shared/home-language-only.js');
const supportedMatch = languageConfig.match(/var\s+SUPPORTED\s*=\s*\[([^\]]+)\]/);
const supported = supportedMatch
  ? [...supportedMatch[1].matchAll(/['"]([a-z]{2})['"]/g)].map(m => m[1])
  : [];
if (required.some(lang => !supported.includes(lang)) ||
    supported.some(lang => !required.includes(lang))) {
  problems.push('Shared language selector must support exactly: ' + required.join(', '));
}
if (!engine.includes('window.KH_LANG.supported')) {
  problems.push('Translation engine must use the shared language registry.');
}

for (const file of storyFiles) {
  const source = read(file);
  for (const lang of required) {
    if (!new RegExp("register\\(['\\\"]" + lang + "['\\\"]").test(source)) {
      problems.push(file + ': missing I18N.register(' + lang + ', ...).');
    }
  }
}

for (const file of translationMaps) {
  const source = read(file);
  /*
   * Both shared maps put one locale object on each line. Match those entry
   * objects directly instead of matching every brace pair in the whole file:
   * the old nested-brace regex counted inner fragments as separate entries
   * and reported false missing translations.
   */
  const entries = [...source.matchAll(/^\s*(?:"(?:\\.|[^"\\])*"|[^\s:]+)\s*:\s*\{([^{}\n]*)\}/gm)]
    .map(match => match[1])
    .filter(value => /\ben["']?\s*:/.test(value));
  let missing = 0;
  for (const entry of entries) {
    const absent = ['en', 'fr', 'it', 'de'].filter(lang =>
      !new RegExp(`(?:^|[,\\s])["']?${lang}["']?\\s*:`).test(entry)
    );
    if (absent.length) {
      missing++;
      if (missing <= 8) {
        problems.push(file + ': a translation entry is missing locale(s) ' + absent.join(', ') + '.');
      }
    }
  }
  if (missing > 8) problems.push(file + ': ' + (missing - 8) + ' additional incomplete entries (details truncated).');
  console.log(file + ': inspected ' + entries.length + ' translation entries; ' + missing + ' incomplete.');
}

// Story 006 stores locale rows in StoryI18N rather than I18N.register.
const urabi = read('stories/history/006/translations.js');
if (!(urabi.includes('"de":') || urabi.includes("'de':"))) {
  problems.push('stories/history/006/translations.js: missing German translation map.');
} else {
  function extractObjectAfter(source, marker) {
    const at = source.indexOf(marker);
    const start = at < 0 ? -1 : source.indexOf('{', at + marker.length);
    if (start < 0) return '';
    let depth = 0, quote = '', escaped = false;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
    }
    return '';
  }
  let rows = null;
  try { rows = JSON.parse(extractObjectAfter(urabi, 'var rows=')); } catch (e) {}
  if (!rows) problems.push('stories/history/006/translations.js: German translation rows are not parseable.');
  else {
    const expectedCount = Object.keys(rows.en || {}).length;
    for (const lang of required.slice(1)) {
      const count = rows[lang] ? Object.keys(rows[lang]).length : -1;
      if (count !== expectedCount) problems.push('stories/history/006/translations.js: ' + lang + ' has ' + count + ' entries; expected ' + expectedCount + '.');
    }
    console.log('stories/history/006/translations.js: locale key counts ' + JSON.stringify(Object.fromEntries(Object.entries(rows).map(([lang, map]) => [lang, Object.keys(map).length]))));
  }
}

// Ahmed Zewail's story uses separate T and EXTRA dictionaries, not I18N.register.
const zewail = read('stories/science/007/index.html');
const zewailT = zewail.slice(zewail.indexOf('const T='), zewail.indexOf('const EXTRA='));
const zewailExtra = zewail.slice(zewail.indexOf('const EXTRA='));
if (!/["']de["']\s*:\s*\{/.test(zewailT)) {
  problems.push('stories/science/007/index.html: missing German story text dictionary.');
}
if (!/["']de["']\s*:\s*\{/.test(zewailExtra)) {
  problems.push('stories/science/007/index.html: missing German sources/accessibility dictionary.');
}
function localeKeyCounts(block) {
  const matches = [...block.matchAll(/(?:^|[,{])\s*["']?(ar|en|fr|it|de)["']?\s*:\s*\{/g)];
  const result = {};
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : block.length;
    result[matches[i][1]] = [...block.slice(start, end).matchAll(/(?:^|,)\s*["']?[A-Za-z_$][\w$]*["']?\s*:/g)].length;
  }
  return result;
}
const tCounts = localeKeyCounts(zewailT);
const tExpected = tCounts.ar;
for (const lang of required) {
  if (tCounts[lang] === undefined) problems.push('stories/science/007/index.html: T dictionary missing ' + lang + '.');
  else if (tCounts[lang] !== tExpected) problems.push('stories/science/007/index.html: T dictionary key count differs for ' + lang + ' (' + tCounts[lang] + ' vs ' + tExpected + ').');
}
console.log('stories/science/007/index.html: T locale key counts ' + JSON.stringify(tCounts));

const extraMatch = zewail.match(/const EXTRA=(\{[\s\S]*?\});/);
let extraMap = null;
try { if (extraMatch) extraMap = JSON.parse(extraMatch[1]); } catch (e) {}
if (!extraMap) {
  problems.push('stories/science/007/index.html: EXTRA dictionary is not valid JSON-like locale data.');
} else {
  const expectedCount = extraMap.ar ? Object.keys(extraMap.ar).length : 0;
  const counts = {};
  for (const lang of required) {
    counts[lang] = extraMap[lang] ? Object.keys(extraMap[lang]).length : undefined;
    if (counts[lang] === undefined) problems.push('stories/science/007/index.html: EXTRA dictionary missing ' + lang + '.');
    else if (counts[lang] !== expectedCount) problems.push('stories/science/007/index.html: EXTRA dictionary key count differs for ' + lang + ' (' + counts[lang] + ' vs ' + expectedCount + ').');
  }
  console.log('stories/science/007/index.html: EXTRA locale key counts ' + JSON.stringify(counts));
}


/* German UI coverage: shared homepage, collection pages, October archive, reader and quiz. */
const germanUiSource = read('khaledoon/assets/khaledoon-de.js');
const germanUiKeys = new Set([...germanUiSource.matchAll(/^"((?:\\.|[^"\\])*)"\s*:/gm)].map(match => {
  try { return JSON.parse('"' + match[1] + '"'); } catch (e) { return match[1]; }
}));
function requireGermanKey(key, sourceName) {
  if (key && key !== 'ar' && !germanUiKeys.has(key)) problems.push(sourceName + ': missing German UI translation for "' + key + '".');
}
const homeJs = read('khaledoon/assets/khaledoon.js');
const homeRows = homeJs.slice(homeJs.indexOf('var R=['), homeJs.indexOf('var D={};R.forEach'));
for (const match of homeRows.matchAll(/\[\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g)) {
  let key = match[2];
  if (match[1] === '"') { try { key = JSON.parse('"' + key + '"'); } catch (e) {} }
  requireGermanKey(key, 'khaledoon/assets/khaledoon.js');
}
const homeExtra = read('khaledoon/assets/khaledoon-i18n-extra.js');
for (const match of homeExtra.matchAll(/\[\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g)) {
  let key = match[2];
  if (match[1] === '"') { try { key = JSON.parse('"' + key + '"'); } catch (e) {} }
  requireGermanKey(key, 'khaledoon/assets/khaledoon-i18n-extra.js');
}
const pageI18n = read('khaledoon/assets/khaledoon-pages-i18n.js');
const pageRows = pageI18n.slice(pageI18n.indexOf('var R=['), pageI18n.indexOf('];\nvar D='));
for (const line of pageRows.split('\n').filter(line => line.trim().startsWith("['"))) {
  const match = line.match(/^\s*\['((?:\\.|[^'\\])*)'/);
  if (match) requireGermanKey(match[1].replace(/\\'/g, "'"), 'khaledoon/assets/khaledoon-pages-i18n.js');
}
for (const file of ['read.html', 'quiz.html']) {
  const source = read(file);
  for (const match of source.matchAll(/\bL\(\s*'((?:\\.|[^'\\])*)'/g)) {
    requireGermanKey(match[1].replace(/\\'/g, "'"), file);
  }
}
const octoberHome = read('assets/i18n/home.js');
const arabicHome = octoberHome.slice(octoberHome.indexOf("window.I18N.register('ar'"), octoberHome.indexOf("window.I18N.register('en'"));
for (const match of arabicHome.matchAll(/\b[A-Za-z0-9_]+\s*:\s*'((?:\\.|[^'\\])*)'/g)) {
  requireGermanKey(match[1].replace(/\\'/g, "'"), 'assets/i18n/home.js');
}
for (const file of [
  'index.html', 'read.html', 'quiz.html', 'khaledoon/submit.html',
  'khaledoon/collections/history.html', 'khaledoon/collections/science.html',
  'khaledoon/collections/curriculum.html', 'khaledoon/collections/people.html',
  'khaledoon/collections/knowledge.html', 'khaledoon/collections/october.html'
]) {
  const source = read(file);
  if (!source.includes('khaledoon-de.js')) problems.push(file + ': missing shared German UI dictionary script.');
  if (file === 'read.html' || file === 'quiz.html') {
    const germanScript = source.indexOf('khaledoon/assets/khaledoon-de.js');
    const sharedI18n = source.indexOf('assets/shared/i18n.js');
    const inlineScript = source.indexOf('<script>', sharedI18n);
    if (germanScript < 0 || sharedI18n < 0 || inlineScript < 0 || germanScript > inlineScript) {
      problems.push(file + ': German dictionary must load before the inline renderer uses L(...).');
    }
  }
}
console.log('German UI dictionary: ' + germanUiKeys.size + ' keys inspected across homepage, sections, October archive, reader and quiz.');

if (problems.length) {
  console.error('\nLOCALIZATION COVERAGE: FAIL (' + problems.length + ' issue(s))');
  for (const problem of problems) console.error('- ' + problem);
  process.exitCode = 1;
} else {
  console.log('\nLOCALIZATION COVERAGE: PASS — all required locale declarations and flat-map entries are present.');
}
