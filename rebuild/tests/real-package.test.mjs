import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStory, validateLocalImagePaths } from '../validate-story.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const langs = ['ar', 'en', 'fr', 'it', 'de'];
const arabicScript = /[\u0600-\u06FF]/;

async function loadJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

test('real October V2 draft keeps source metadata localized without Arabic fallback', async () => {
  const story = await loadJson('rebuild/story-packages/october-sea-men.v2.json');
  assert.equal(story.format, 'KHALEDOON_STORY_V2');
  assert.equal(story.section, 'october');
  assert.equal(story.quiz.length, 23, '20 legacy questions plus 3 supplemental questions must be preserved');
  assert.equal(story.map_location.lat, 12.58333);
  assert.equal(story.map_location.lng, 43.41667);
  assert.ok(story.sources.some(source => source.url === 'https://www.marineregions.org/gazetteer.php?id=9080&p=details'),
    'map coordinates must be backed by the Marine Regions source record');
  for (const lang of langs) {
    assert.ok(story.map_location.place[lang]?.trim(), 'localized map place missing for ' + lang);
    if (lang !== 'ar') assert.equal(arabicScript.test(story.map_location.place[lang]), false, 'Arabic fallback in map place for ' + lang);
  }

  for (const source of story.sources) {
    assert.equal(source.url.startsWith('https://'), true);
    for (const lang of langs) {
      assert.ok(source.i18n?.[lang]?.title?.trim(), 'source title missing for ' + lang + ': ' + source.url);
      assert.ok(source.i18n?.[lang]?.organization?.trim(), 'source organization missing for ' + lang + ': ' + source.url);
      if (lang !== 'ar') {
        assert.equal(arabicScript.test(source.i18n[lang].title), false, 'Arabic fallback in source title (' + lang + '): ' + source.url);
        assert.equal(arabicScript.test(source.i18n[lang].organization), false, 'Arabic fallback in source organization (' + lang + '): ' + source.url);
      }
    }
  }

  assert.notEqual(
    story.sources.find(s => s.url.includes('Map_of_Bab-el-Mandeb'))?.i18n?.en?.title,
    story.sources.find(s => s.url.includes('Bridge-October-war-1973'))?.i18n?.en?.title,
    'map and Suez crossing image must not share copy-pasted titles'
  );
});

test('real October draft records localized image credits and direct licence links', async () => {
  const story = await loadJson('rebuild/story-packages/october-sea-men.v2.json');
  const images = [story.cover, ...story.images];
  for (const image of images) {
    assert.equal(image.source_url.startsWith('https://'), true);
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
  assert.ok(eilat.rights.includes('https://creativecommons.org/licenses/by-sa/3.0/'));
  const map = images.find(image => image.source_url?.endsWith('/File:Map_of_Bab-el-Mandeb.png'));
  assert.ok(map, 'Bab el-Mandeb map record is required');
  assert.ok(map.rights.includes('https://creativecommons.org/licenses/by-sa/3.0/'));
  assert.ok(map.rights.includes('https://www.openstreetmap.org/copyright'));
});

test('Ibn Sina V2 story package validates and preserves its five-language reading flow', async () => {
  const story = await loadJson('stories/history/005/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Ibn Sina V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'history');
  assert.equal(story.i18n.ar.blocks.length, 11);
  assert.equal(story.quiz.length, 10, 'keep the ten questions already translated in all five languages');
  assert.equal(story.sources.length, 3);
  assert.equal(story.images.length, 2);
  for (const lang of langs) {
    assert.equal(story.i18n[lang].blocks.length, 11, 'story blocks missing in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'editorial verification note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/history/005/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.doesNotMatch(page, /name="robots" content="noindex,nofollow"/, "approved story page must be indexable after publication");
  assert.match(page, /rebuild\/reader\.js/);
});

test('Ahmed Urabi V2 story package validates with five-language blocks, images, and quiz', async () => {
  const story = await loadJson('stories/history/006/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Ahmed Urabi V2 package must pass the V2 contract and local-image checks');
  assert.equal(story.section, 'history');
  assert.equal(story.i18n.ar.blocks.length, 14);
  assert.equal(story.quiz.length, 10);
  assert.equal(story.sources.length, 3);
  assert.equal(story.images.length, 2);
  for (const lang of langs) {
    assert.equal(story.i18n[lang].blocks.length, 14, 'story blocks missing in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/history/006/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.doesNotMatch(page, /name="robots" content="noindex,nofollow"/, "approved story page must be indexable after publication");
  assert.match(page, /rebuild\/reader\.js/);
});

test('Tawfiq al-Hakim V2 package validates with five-language text, archival image rights, sources, and quiz', async () => {
  const story = await loadJson('stories/people/008/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Tawfiq al-Hakim V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'people');
  assert.equal(story.design.variant, 'portrait-biography');
  assert.equal(story.i18n.ar.grade, 'الصف الأول الابتدائي');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.equal(story.images.length, 2);
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 7);
  for (const lang of langs) {
    assert.equal(story.i18n[lang].blocks.length, 9, 'story blocks missing in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/people/008/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});

