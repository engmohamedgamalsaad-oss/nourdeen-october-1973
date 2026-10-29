import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStory, validateLocalImagePaths } from '../validate-story.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const langs = ['ar', 'en', 'fr', 'it', 'de'];
const load = async () => JSON.parse(await readFile(path.join(root, 'stories/science/016/data.v2.json'), 'utf8'));

test('Mosharafa package is valid and uses only local images', async () => {
  const story = await load();
  assert.deepEqual(validateStory(story), []);
  assert.deepEqual(await validateLocalImagePaths(story, root), []);
  assert.equal(story.cover.kind, 'illustration');
  assert.ok(!story.cover.url, 'cover must be a local file, not a remote hotlink');
});

test('every language has scene headings, a science note and a timeline', async () => {
  const story = await load();
  const counts = langs.map(l => story.i18n[l].blocks.length);
  assert.equal(new Set(counts).size, 1, 'all languages need the same block structure');
  for (const l of langs) {
    const blocks = story.i18n[l].blocks;
    assert.ok(blocks.filter(b => b.heading && /^(?!$)/.test(b.heading)).length >= 7, l + ' scene headings');
    assert.equal(blocks.filter(b => b.type === 'science_note').length, 1, l + ' science note');
    const tl = blocks.filter(b => b.type === 'timeline');
    assert.equal(tl.length, 1, l + ' timeline');
    assert.ok(tl[0].text.split('\n').length >= 8, l + ' timeline rows');
  }
});

test('validator rejects a malformed timeline and an empty heading', async () => {
  const story = await load();
  const bad = structuredClone(story);
  const tl = bad.i18n.en.blocks.find(b => b.type === 'timeline');
  tl.text = 'no separator here';
  assert.ok(validateStory(bad).some(e => e.includes('timeline')));
  const bad2 = structuredClone(story);
  bad2.i18n.fr.blocks[0].heading = '  ';
  assert.ok(validateStory(bad2).some(e => e.includes('heading')));
});

test('quiz has at least five questions with five-language text', async () => {
  const story = await load();
  assert.ok(story.quiz.length >= 5);
  for (const q of story.quiz) for (const l of langs) {
    assert.ok(q.i18n[l].question && q.i18n[l].explanation && q.i18n[l].options.length === 4);
  }
});
