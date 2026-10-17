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
  'stories/october/004/i18n.js'
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
/* The engine now reads the list from KH_LANG and keeps a fallback array:
   var allowed=(window.KH_LANG&&...)?...:['ar','en','fr','it','de'];
   Both the fallback array and the shared KH_LANG list must contain exactly the required languages. */
const allowedMatch = engine.match(/var\s+allowed\s*=[^;]*?:\s*\[([^\]]+)\]/);
const allowed = allowedMatch
  ? [...allowedMatch[1].matchAll(/['"]([a-z]{2})['"]/g)].map(m => m[1])
  : [];
const sharedLang = read('assets/shared/home-language-only.js');
const sharedMatch = sharedLang.match(/var\s+SUPPORTED\s*=\s*\[([^\]]+)\]/);
const sharedAllowed = sharedMatch
  ? [...sharedMatch[1].matchAll(/['"]([a-z]{2})['"]/g)].map(m => m[1])
  : [];
if (required.some(lang => !sharedAllowed.includes(lang)) ||
    sharedAllowed.some(lang => !required.includes(lang))) {
  problems.push('assets/shared/home-language-only.js SUPPORTED must be exactly: ' + required.join(', '));
}
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
  // These source maps store Arabic as the key and translations in flat locale objects.
  const objects = (source.match(/\{[^{}]*\}/gs) || []).filter(object => /['\"]?en['\"]?\s*:/.test(object));
  let missing = 0;
  for (const object of objects) {
    for (const lang of ['en', 'fr', 'it', 'de']) {
      if (!new RegExp("['\"]?" + lang + "['\"]?\\s*:").test(object)) {
        missing++;
        if (missing <= 8) {
          problems.push(file + ': a translation entry is missing locale "' + lang + '".');
        }
        break;
      }
    }
  }
  if (missing > 8) problems.push(file + ': ' + (missing - 8) + ' additional incomplete entries (details truncated).');
  console.log(file + ': inspected ' + objects.length + ' flat translation entries.');
}

if (problems.length) {
  console.error('\nLOCALIZATION COVERAGE: FAIL (' + problems.length + ' issue(s))');
  for (const problem of problems) console.error('- ' + problem);
  process.exitCode = 1;
} else {
  console.log('\nLOCALIZATION COVERAGE: PASS — all required locale declarations and flat-map entries are present.');
}
