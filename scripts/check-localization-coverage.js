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
  'stories/history/005/translations.js',
  'stories/history/006/translations.js'
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
const allowedMatch = engine.match(/var\s+allowed\s*=\s*\[([^\]]+)\]/);
const allowed = allowedMatch
  ? [...allowedMatch[1].matchAll(/['"]([a-z]{2})['"]/g)].map(m => m[1])
  : [];
if (required.some(lang => !allowed.includes(lang)) ||
    allowed.some(lang => !required.includes(lang))) {
  problems.push('Language engine must explicitly allow exactly: ' + required.join(', '));
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
    .filter(value => /(?:^|[,\\s])(?:["']?en["']?)\\s*:/.test(value));
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

// Ahmed Zewail's story uses its own T/EXTRA locale objects, not I18N.register.
const zewail = read('stories/science/007/index.html');
if (!/(?:["']de["']\\s*:\\s*\\{)/.test(zewail)) {
  problems.push('stories/science/007/index.html: missing German story dictionary.');
} else {
  console.log('stories/science/007/index.html: German dictionary declaration found (content parity still needs review).');
}

if (problems.length) {
  console.error('\nLOCALIZATION COVERAGE: FAIL (' + problems.length + ' issue(s))');
  for (const problem of problems) console.error('- ' + problem);
  process.exitCode = 1;
} else {
  console.log('\nLOCALIZATION COVERAGE: PASS — all required locale declarations and flat-map entries are present.');
}
