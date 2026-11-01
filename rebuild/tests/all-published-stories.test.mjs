import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStory, validateLocalImagePaths } from '../validate-story.mjs';
import { validateStyle } from '../validate-style.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const languages = ['ar', 'en', 'fr', 'it', 'de'];
const exists = async file => { try { await access(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };

async function findStoryPackages(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // October is intentionally frozen and remains outside this migration audit.
      if (dir === path.join(root, 'stories') && entry.name === 'october') continue;
      found.push(...await findStoryPackages(full));
    } else if (entry.isFile() && entry.name === 'story.json') {
      found.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return found.sort();
}

test('every non-October story package and published reader uses the canonical contract', async () => {
  const index = JSON.parse(await readFile(path.join(root, 'stories/index.json'), 'utf8'));
  const places = JSON.parse(await readFile(path.join(root, 'stories/places.json'), 'utf8'));
  const published = index.filter(item => item?.published === true && item.section !== 'october');
  const packagePaths = await findStoryPackages(path.join(root, 'stories'));
  assert.ok(packagePaths.length >= published.length, 'every published non-October story must have a canonical package');

  for (const item of published) {
    const base = String(item.path || '').replace(/\/+$/, '');
    assert.ok(base.startsWith('stories/') && !base.includes('..'), 'unsafe or missing indexed story path: ' + item.id);
    assert.ok(packagePaths.includes(base + '/story.json'), 'published story ' + item.id + ' is missing story.json');
    assert.ok(await exists(path.join(root, base, 'index.html')), 'published story ' + item.id + ' is missing index.html');
  }

  const styleDebt = [];
  for (const relative of packagePaths) {
    const story = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
    const structural = [
      ...validateStory(story),
      ...await validateLocalImagePaths(story, root)
    ];
    assert.deepEqual(structural, [], relative + ' must pass the canonical story contract and local image checks');
    assert.equal(story.format, 'KHALEDOON_STORY', relative + ' must use the canonical format');
    assert.deepEqual(Object.keys(story.i18n).sort(), [...languages].sort(), relative + ' must contain all five languages');
    assert.ok(Array.isArray(story.images) && story.images.length >= 2, relative + ' must retain its image gallery');
    assert.ok(Array.isArray(story.quiz) && story.quiz.length >= 5, relative + ' must retain its quiz');
    const arCount = story.i18n.ar.blocks.length;
    for (const lang of languages) {
      assert.equal(story.i18n[lang].blocks.length, arCount, relative + ' block count differs in ' + lang);
      assert.ok(story.i18n[lang].history_note?.trim(), relative + ' history_note missing in ' + lang);
    }

    const folder = path.dirname(path.join(root, relative));
    assert.equal(await exists(path.join(folder, 'data.v2.json')), false, relative + ' must not retain the old package filename');
    const pagePath = path.join(folder, 'index.html');
    if (await exists(pagePath)) {
      const html = await readFile(pagePath, 'utf8');
      assert.match(html, /data-kh-story-reader/, relative + ' must use the canonical reader marker');
      assert.match(html, /data-story-path="story\.json"/, relative + ' must load story.json');
      assert.doesNotMatch(html, /data-kh-v2-reader|data-story-path="data\.v2\.json"/, relative + ' must not depend on the old reader marker or filename');
    }

    const id = String(relative.match(/\/(\d{3})\/story\.json$/)?.[1] || '');
    if (published.some(item => String(item.id).padStart(3, '0') === id)) {
      const place = places[id];
      assert.ok(place && Number.isFinite(place.lat) && Number.isFinite(place.lng), relative + ' published story needs its verified map point');
      assert.ok(place.source_url?.startsWith('https://'), relative + ' map point needs an HTTPS source');
      for (const lang of languages) assert.ok(place.place?.[lang]?.trim(), relative + ' map place missing in ' + lang);
    }

    const editorial = validateStyle(story);
    if (editorial.length) styleDebt.push({ story: relative, issues: editorial });
  }

  // The editorial style rules are deliberately run against every package.
  // Existing findings are reported, not silently waived or auto-rewritten.
  if (styleDebt.length) {
    console.warn('EXISTING EDITORIAL STYLE FINDINGS (manual, source-backed review required):');
    for (const item of styleDebt) console.warn(JSON.stringify(item));
  }
  assert.ok(packagePaths.length > 0, 'no non-October story packages were discovered');
});
