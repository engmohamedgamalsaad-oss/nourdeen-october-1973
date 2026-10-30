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
/* Stories whose text lives inside index.html: each language must appear in all
   three inline translation tables (story text, UI labels, and reaction/status text). */
const inlineStoryFiles = [
  // No active story page keeps private inline locale dictionaries; V2 stories
  // are checked from their data.v2.json package below.
];
const v2StoryFiles = [
  'stories/science/007/data.v2.json',
  'stories/people/008/data.v2.json',
  'stories/people/009/data.v2.json'
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

/* Story cover SVGs are decorative artwork only. Keep titles, captions, and all
   language-specific UI text in HTML/translation data, never embedded in SVG. */
function findStoryCoverSvgs(dir) {
  const absolute = path.join(process.cwd(), dir);
  let entries;
  try { entries = fs.readdirSync(absolute, { withFileTypes: true }); }
  catch (e) { problems.push('Cannot scan story assets directory: ' + dir); return []; }
  return entries.flatMap(entry => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return findStoryCoverSvgs(relative);
    return entry.isFile() && /^(cover|cover-popup)\.svg$/i.test(entry.name) ? [relative] : [];
  });
}
for (const file of findStoryCoverSvgs('stories')) {
  const svg = read(file);
  if (/<text\b/i.test(svg)) {
    problems.push(file + ': cover SVG must not contain embedded <text> elements; keep headings in localized HTML.');
  }
  if (/[\u0600-\u06FF]/.test(svg)) {
    problems.push(file + ': cover SVG contains Arabic text or attributes; keep localization in HTML/translation data.');
  }
}

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

for (const file of inlineStoryFiles) {
  const source = read(file);
  for (const lang of required) {
    const pattern = new RegExp("(^|[^A-Za-z0-9_])['\"]?" + lang + "['\"]?\\s*:\\s*\\{", 'g');
    const found = (source.match(pattern) || []).length;
    if (found < 3) {
      problems.push(file + ': locale "' + lang + '" appears in ' + found + ' of the 3 inline translation tables.');
    }
  }
}
for (const file of v2StoryFiles) {
  try {
    const story = JSON.parse(read(file));
    for (const lang of required) {
      const data = story.i18n && story.i18n[lang];
      if (!data || !String(data.title || '').trim() || !String(data.subtitle || '').trim() ||
          !String(data.summary || '').trim() || !Array.isArray(data.blocks) || data.blocks.length < 3) {
        problems.push(file + ': missing required V2 story translations for "' + lang + '".');
      }
    }
    console.log(file + ': inspected V2 story content in all five locales.');
  } catch (e) {
    problems.push(file + ': could not parse V2 package: ' + e.message);
  }
}

for (const file of translationMaps) {
  let source = read(file);
  // German-only additions are checked separately below; do not mistake prose containing "en:" for a locale field.
  source = source.replace(/var germanStoryText = \{[\s\S]*?\};/, '');
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

/* German-only additions for expanded story text must not fall back to Arabic. */
{
  const source = read('assets/shared/story-body-i18n.js');
  const match = source.match(/var germanStoryText = (\{[\s\S]*?\});/);
  if (!match) {
    problems.push('assets/shared/story-body-i18n.js: missing germanStoryText map.');
  } else {
    try {
      const entries = Object.entries(JSON.parse(match[1]));
      if (entries.length < 50) problems.push('germanStoryText: expected at least 50 entries, found ' + entries.length + '.');
      const bad = entries.filter(([key, value]) => typeof value !== 'string' || !value.trim() || /\bundefined\b/.test(value) || /[\u0600-\u06FF]/.test(value));
      if (bad.length) problems.push('germanStoryText: ' + bad.length + ' empty, invalid, or Arabic-valued entries.');
      const sourcePages = [
        'stories/october/001/index.html', 'stories/october/002/index.html',
        'stories/october/003/index.html', 'stories/october/004/index.html',
        'stories/history/005/index.html', 'stories/history/006/index.html',
        'stories/science/007/legacy-original.html',
        'stories/science/007/data.v2.json',
        // V2 story prose is stored in JSON data; the old page is retained as a legacy archive.
        'stories/history/005/data.v2.json', 'stories/history/006/data.v2.json',
        // This legacy German source paragraph is retained in the Orabi translation module.
        'stories/history/006/translations.js'
      ].map(read).join('\n');
      const missingSources = entries.filter(([key]) => !sourcePages.includes(key));
      if (missingSources.length) problems.push('germanStoryText: ' + missingSources.length + ' keys do not match source text in stories 001–003.');
      if (!bad.length && !missingSources.length) console.log('germanStoryText: verified ' + entries.length + ' German additions for October stories 001–003.');
    } catch (e) {
      problems.push('germanStoryText: could not parse the map: ' + e.message);
    }
  }
}

if (problems.length) {
  console.error('\nLOCALIZATION COVERAGE: FAIL (' + problems.length + ' issue(s))');
  for (const problem of problems) console.error('- ' + problem);
  process.exitCode = 1;
} else {
  console.log('\nLOCALIZATION COVERAGE: PASS — all required locale declarations and flat-map entries are present.');
}
