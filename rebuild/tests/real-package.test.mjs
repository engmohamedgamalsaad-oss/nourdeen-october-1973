import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const langs = ['ar', 'en', 'fr', 'it', 'de'];
const arabicScript = /[\\u0600-\\u06FF]/;

async function loadJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

test('real October V2 draft keeps source metadata localized without Arabic fallback', async () => {
  const story = await loadJson('rebuild/story-packages/october-sea-men.v2.json');
  assert.equal(story.format, 'KHALEDOON_STORY_V2');
  assert.equal(story.section, 'october');
  assert.equal(story.quiz.length, 23, '20 legacy questions plus 3 supplemental questions must be preserved');

  for (const source of story.sources) {
    assert.match(source.url, /^https:\\/\\//);
    for (const lang of langs) {
      assert.ok(source.i18n?.[lang]?.title?.trim(), 'source title missing for ' + lang + ': ' + source.url);
      assert.ok(source.i18n?.[lang]?.organization?.trim(), 'source organization missing for ' + lang + ': ' + source.url);
      if (lang !== 'ar') {
        assert.equal(arabicScript.test(source.i18n[lang].title), false, 'Arabic fallback in source title (' + lang + '): ' + source.url);
        assert.equal(arabicScript.test(source.i18n[lang].organization), false, 'Arabic fallback in source organization (' + lang + '): ' + source.url);
      }
    }
  }

  assert.notEqual(story.sources.find(s => s.url.includes('Map_of_Bab-el-Mandeb'))?.i18n?.en?.title,
                  story.sources.find(s => s.url.includes('Bridge-October-war-1973'))?.i18n?.en?.title,
                  'map and Suez crossing image must not share copy-pasted titles');
});

test('real October draft records localized image credits and direct licence links', async () => {
  const story = await loadJson('rebuild/story-packages/october-sea-men.v2.json');
  const images = [story.cover, ...story.images];
  for (const image of images) {
    assert.match(image.source_url, /^https:\\/\\//);
    assert.ok(image.rights?.trim(), 'image rights statement is required');
    for (const lang of langs) {
      const localized = image.i18n?.[lang];
      assert.ok(localized?.alt?.trim(), 'image alt text missing for ' + lang);
      assert.ok(localized?.caption?.trim(), 'image caption missing for ' + lang);
      assert.ok(localized?.source_name?.trim(), 'localized image credit missing for ' + lang);
      assert.ok(localized?.rights?.trim(), 'localized rights statement missing for ' + lang);
    }
  }
  const eilat = images.find(image => image.source_url?.endsWith('/File:INSEilat.jpg'));
  assert.ok(eilat, 'Eilat photograph record is required');
  assert.match(eilat.rights, /https:\\/\\/creativecommons\\.org\\/licenses\\/by-sa\\/3\\.0\\//);
  const map = images.find(image => image.source_url?.endsWith('/File:Map_of_Bab-el-Mandeb.png'));
  assert.ok(map, 'Bab el-Mandeb map record is required');
  assert.match(map.rights, /https:\\/\\/creativecommons\\.org\\/licenses\\/by-sa\\/3\\.0\\//);
  assert.match(map.rights, /https:\\/\\/www\\.openstreetmap\\.org\\/copyright/);
});
