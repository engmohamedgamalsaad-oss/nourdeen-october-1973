import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const builder = path.join(root, 'rebuild/build-story.mjs');
const langs = ['ar', 'en', 'fr', 'it', 'de'];

function fixture() {
  const image = (id) => ({
    id, url: 'https://example.org/' + id + '.jpg', kind: 'illustration',
    source_name: 'Project illustration', source_url: 'https://example.org/credits/' + id,
    rights: 'Original illustrative asset; sample fixture only',
    i18n: Object.fromEntries(langs.map(lang => [lang, {
      alt: 'alt ' + lang, caption: 'caption ' + lang,
      source_name: 'source ' + lang, rights: 'rights ' + lang
    }]))
  });
  const i18n = Object.fromEntries(langs.map(lang => [lang, {
    title: 'Title ' + lang, subtitle: 'Subtitle ' + lang, summary: 'Summary ' + lang,
    blocks: [
      { type: 'paragraph', speaker: 'karma', text: 'Karma notices something. ' + lang },
      { type: 'paragraph', speaker: 'narrator', text: 'The narrator explains the context. ' + lang },
      { type: 'paragraph', speaker: 'karma', text: 'Karma reflects on what she learned. ' + lang }
    ],
    history_note: 'Sample historical note in ' + lang
  }]));
  const quiz = Array.from({ length: 5 }, (_, i) => ({
    id: 'question-' + (i + 1), correct_option: 0,
    i18n: Object.fromEntries(langs.map(lang => [lang, {
      question: 'Question ' + (i + 1) + ' ' + lang,
      options: ['A ' + lang, 'B ' + lang, 'C ' + lang, 'D ' + lang],
      explanation: 'Explanation ' + lang
    }]))
  }));
  return {
    format: 'KHALEDOON_STORY', slug: 'test-story', section: 'people',
    design: { variant: 'arts-culture', accent: '#b8874b' },
    original_body: 'Exact sample source text.',
    i18n, cover: image('cover'), images: [image('inside-1'), image('inside-2')],
    sources: ['A', 'B'].map((name, i) => ({ title: 'Sample source ' + name, organization: 'Example', url: 'https://example.org/source-' + name.toLowerCase(), i18n: Object.fromEntries(langs.map(lang => [lang, { title: 'Sample source ' + name, organization: 'Example' }])) })),
    quiz, map_location: null
  };
}

test('build-story creates a unified story page and package, then refuses to overwrite them', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'kh-story-build-'));
  try {
    const input = path.join(temp, 'story.json');
    await writeFile(input, JSON.stringify(fixture()), 'utf8');
    const run = spawnSync(process.execPath, [builder, input, '987'], { cwd: temp, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const pagePath = path.join(temp, 'stories/people/987/index.html');
    const dataPath = path.join(temp, 'stories/people/987/story.json');
    await access(pagePath); await access(dataPath);
    const page = await readFile(pagePath, 'utf8');
    const saved = JSON.parse(await readFile(dataPath, 'utf8'));
    const baseCss = await readFile(new URL('../reader-base.css', import.meta.url), 'utf8');
    assert.match(page, /data-story-slug="987"/);
    assert.match(page, /data-design="arts-culture"/);
    assert.match(page, /data-section="people"/);
    assert.match(page, /data-start-only/);
    assert.match(page, /data-disable-story-extras/);
    assert.match(page, /id="intro-start"/);
    assert.match(page, /id="intro-cover-fallback"/);
    assert.match(page, /id="reaction-like"/);
    assert.match(page, /id="share-whatsapp"/);
    assert.match(page, /id="print-story"/);
    assert.match(page, /id="image-lightbox"/);
    assert.match(page, /reader\.js\?v=20261101-story-reader-1/);
    assert.match(page, /reader-base\.css\?v=20261101-story-reader-1/, 'generated page must use the shared reader base stylesheet');
    assert.ok(baseCss.includes('Marhey,Cairo,Arial,sans-serif'), 'shared headings need a sans-serif fallback when web fonts are unavailable');
    assert.match(page, /data-story-path="story\.json"/);
    assert.doesNotMatch(page, /name="robots" content="noindex,nofollow"/, 'a story page built for eventual approved publication must not remain noindex');
    assert.match(page, /id="map-section"/);
    assert.match(page, /id="theme-toggle"/);
    assert.ok(baseCss.includes('body[data-design=ancient-civilization]'), 'shared stylesheet must map the design variants');
    assert.equal(saved.format, 'KHALEDOON_STORY');
    assert.equal(saved.original_body, 'Exact sample source text.');
    const second = spawnSync(process.execPath, [builder, input, '987'], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Refusing to overwrite existing/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
