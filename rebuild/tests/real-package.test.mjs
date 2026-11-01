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
  assert.ok(story.i18n.ar.blocks.length >= 11, 'Arabic story block count below the established minimum');
  assert.equal(story.quiz.length, 10, 'keep the ten questions already translated in all five languages');
  assert.equal(story.sources.length, 3);
  assert.equal(story.images.length, 2);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 11, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
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
  assert.ok(story.i18n.ar.blocks.length >= 14, 'Arabic story block count below the established minimum');
  assert.equal(story.quiz.length, 10);
  assert.equal(story.sources.length, 3);
  assert.equal(story.images.length, 2);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 14, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
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
    assert.ok(story.i18n[lang].blocks.length >= 9, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
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

test('Naguib Mahfouz V2 package validates with Karma narration, archival photos, five-language quiz, and Cairo map point', async () => {
  const story = await loadJson('stories/people/009/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Naguib Mahfouz V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'people');
  assert.equal(story.design.variant, 'portrait-biography');
  assert.equal(story.i18n.ar.grade, 'الأول الإعدادي');
  assert.equal(story.i18n.ar.narrator_name, 'كارما');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.equal(story.images.length, 3);
  assert.equal(story.quiz.length, 6);
  assert.equal(story.sources.length, 5);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 13, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  assert.ok(story.map_location && Number.isFinite(story.map_location.lat) && Number.isFinite(story.map_location.lng));
  const page = await readFile(path.join(root, 'stories/people/009/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});

test('Sameera Moussa V2 package validates with five-language science narrative, cautious history notes, and sourced archival photos', async () => {
  const story = await loadJson('stories/women/010/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Sameera Moussa V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'women');
  assert.equal(story.design.variant, 'women-leadership');
  assert.equal(story.images.length, 3);
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 4);
  assert.ok(story.i18n.ar.blocks.length >= 14, 'Arabic story block count below the established minimum');
  assert.match(story.i18n.ar.history_note, /الاغتيال/);
  assert.match(story.i18n.ar.images_note, /الملكية العامة في مصر/);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 14, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/women/010/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});

test('Amr ibn al-As V2 package validates with child narration, historical uncertainty notes, and credited mosque photographs', async () => {
  const story = await loadJson('stories/islamic/011/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Amr ibn al-As V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'islamic');
  assert.equal(story.design.variant, 'islamic-heritage');
  assert.equal(story.i18n.ar.student_name, 'نوردين محمد');
  assert.equal(story.i18n.ar.grade, 'الصف الاول الاعدادى');
  assert.equal(story.i18n.ar.narrator_name, 'كارما');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.equal(story.images.length, 4);
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 3);
  assert.ok(story.i18n.ar.blocks.length >= 8, 'Arabic story block count below the established minimum');
  assert.match(story.i18n.ar.history_note, /مكان دفنه/);
  assert.match(story.i18n.ar.images_note, /CC BY 2\.0/);
  assert.match(story.i18n.ar.images_note, /CC BY-SA 3\.0/);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 8, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/islamic/011/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});

test('Farouk El-Baz V2 package validates with Karma narration, NASA image credits, and an official Zagazig map source', async () => {
  const story = await loadJson('stories/science/012/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Farouk El-Baz V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'science');
  assert.equal(story.design.variant, 'science-lab');
  assert.equal(story.i18n.ar.student_name, 'نوردين محمد');
  assert.equal(story.i18n.ar.narrator_name, 'كارما');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.equal(story.i18n.ar.grade, undefined, 'generic narrator label is not treated as a school grade');
  assert.equal(story.images.length, 3);
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 5);
  assert.ok(story.i18n.ar.blocks.length >= 9, 'Arabic story block count below the established minimum');
  assert.match(story.i18n.ar.history_note, /لجنة/);
  assert.match(story.i18n.ar.images_note, /NASA/);
  assert.ok(story.sources.some(source => source.url === 'https://www.asu.edu.eg/736/news'));
  assert.ok(story.map_location && Number.isFinite(story.map_location.lat) && Number.isFinite(story.map_location.lng));
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 9, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/science/012/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});

test('Hatshepsut story package validates five-language history, image rights, and the scrolling language header', async () => {
  const story = await loadJson('stories/women/013/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Hatshepsut V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'women');
  assert.equal(story.design.variant, 'women-leadership');
  assert.equal(story.i18n.ar.student_name, 'مليكة محمد جمال');
  assert.equal(story.i18n.ar.grade, 'الصف الأول الابتدائي');
  assert.equal(story.i18n.ar.narrator_name, 'كارما');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.equal(story.images.length, 4);
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 6);
  assert.ok(story.i18n.ar.blocks.length >= 8, 'Arabic story block count below the established minimum');
  assert.match(story.i18n.ar.history_note, /القرن الأفريقي/);
  assert.match(story.i18n.ar.history_note, /السكري والسرطان/);
  assert.match(story.i18n.ar.images_note, /CC BY 4\.0/);
  assert.match(story.i18n.ar.images_note, /CC0/);
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 8, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const image of [story.cover, ...story.images]) {
      assert.ok(image.i18n[lang].alt?.trim(), 'image alt missing in ' + lang);
      assert.ok(image.i18n[lang].caption?.trim(), 'image caption missing in ' + lang);
      if (lang !== 'ar') assert.doesNotMatch(image.i18n[lang].alt, /[\u0600-\u06FF]/, 'Arabic fallback in image alt for ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  for (const lang of ['it', 'de']) {
    assert.doesNotMatch(story.i18n[lang].blocks[3].text, /Somalia/);
  }
  const page = await readFile(path.join(root, 'stories/women/013/index.html'), 'utf8');
  const readerCss = await readFile(path.join(root, 'rebuild/reader-base.css'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /data-lang="ar"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
  assert.match(readerCss, /header\{position:static/, 'language header scrolls away with the story instead of staying fixed');
});

test('Abu Bakr al-Khwarizmi V2 package validates identity distinction, five-language quiz, and rights-safe image handling', async () => {
  const story = await loadJson('stories/history/014/data.v2.json');
  const errors = [
    ...validateStory(story),
    ...await validateLocalImagePaths(story, root)
  ];
  assert.deepEqual(errors, [], 'Abu Bakr al-Khwarizmi V2 package must pass the actual V2 contract and local-image checks');
  assert.equal(story.section, 'history');
  assert.equal(story.design.variant, 'portrait-biography');
  assert.equal(story.i18n.ar.student_name, 'كارما محمد');
  assert.equal(story.i18n.ar.grade, 'الصف الثالث الابتدائي');
  assert.equal(story.i18n.ar.narrator_name, 'كارما');
  assert.equal(story.i18n.ar.narrator_grade, 'الصف الثالث الابتدائي');
  assert.ok(story.images.length >= 2, 'at least two documented images are included while historical scan rights remain unverified');
  assert.ok(story.images.some(image => image.id === 'khwarizmi-letter-writing' && image.kind === 'illustration'));
  assert.equal(story.quiz.length, 5);
  assert.equal(story.sources.length, 5);
  assert.ok(story.i18n.ar.blocks.length >= 12, 'Arabic story block count below the established minimum');
  assert.match(story.i18n.ar.history_note, /لا ينبغي الخلط/);
  assert.match(story.i18n.ar.history_note, /تقريبية/);
  assert.match(story.i18n.ar.images_note, /طبعة 1880/);
  assert.match(story.i18n.ar.images_note, /حقوق إعادة استخدامها/);
  assert.ok(story.map_location && Number.isFinite(story.map_location.lat) && Number.isFinite(story.map_location.lng));
  for (const lang of langs) {
    assert.ok(story.i18n[lang].blocks.length >= 12, 'story block count below the established minimum in ' + lang);
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, 'story block count differs from Arabic in ' + lang);
    assert.ok(story.i18n[lang].history_note?.trim(), 'historical note missing in ' + lang);
    assert.ok(story.i18n[lang].images_note?.trim(), 'image rights note missing in ' + lang);
    for (const question of story.quiz) {
      assert.ok(question.i18n[lang].question?.trim(), 'quiz question missing in ' + lang);
      assert.equal(question.i18n[lang].options.length, 4, 'quiz options incomplete in ' + lang);
    }
    for (const image of [story.cover, ...story.images]) {
      assert.ok(image.i18n[lang].alt?.trim(), 'image alt missing in ' + lang);
      assert.ok(image.i18n[lang].caption?.trim(), 'image caption missing in ' + lang);
    }
    for (const source of story.sources) {
      assert.ok(source.i18n[lang].title?.trim(), 'source title missing in ' + lang);
      assert.ok(source.i18n[lang].organization?.trim(), 'source organization missing in ' + lang);
    }
  }
  const page = await readFile(path.join(root, 'stories/history/014/index.html'), 'utf8');
  assert.match(page, /data-kh-v2-reader/);
  assert.match(page, /data-story-path="data\.v2\.json"/);
  assert.match(page, /khaledoon-story-map-link\.js/);
});







