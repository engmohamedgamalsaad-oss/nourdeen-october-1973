import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from '../validate-story.mjs';

const langs = ['ar', 'en', 'fr', 'it', 'de'];
const image = () => ({
  url: 'https://example.org/image.jpg',
  kind: 'archival',
  source_name: 'Archive',
  source_url: 'https://example.org/source',
  rights: 'CC BY 4.0',
  i18n: Object.fromEntries(langs.map(l => [l, {
    alt: 'alt ' + l,
    caption: 'caption ' + l,
    source_name: 'source ' + l,
    rights: 'rights ' + l
  }]))
});
function fixture() {
  const i18n = Object.fromEntries(langs.map(l => [l, {
    title: 'title ' + l,
    subtitle: 'subtitle ' + l,
    summary: 'subtitle ' + l,
    student_name: 'student ' + l,
    narrator_name: 'narrator ' + l,
    figure_name: 'figure ' + l,
    person: 'person ' + l,
    grade: 'grade ' + l,
    narrator_grade: 'narrator grade ' + l,
    history_note: 'historical note ' + l,
    images_note: 'image note ' + l,
    blocks: [
      { type: 'paragraph', speaker: 'karma', text: 'opening ' + l },
      { type: 'paragraph', speaker: 'narrator', text: 'story ' + l },
      { type: 'did_you_know', speaker: 'narrator', text: 'fact ' + l }
    ]
  }]));
  const quiz = Array.from({ length: 5 }, (_, i) => ({
    id: 'question-' + (i + 1),
    correct_option: 1,
    i18n: Object.fromEntries(langs.map(l => [l, {
      question: 'question ' + l,
      options: ['one', 'two', 'three', 'four'].map(x => x + ' ' + l),
      explanation: 'why ' + l
    }]))
  }));
  return {
    format: 'KHALEDOON_STORY_V2',
    slug: 'sample-story',
    section: 'october',
    design: { variant: 'military-history', accent: '#d6ad55' },
    original_body: 'Submitted original',
    i18n,
    cover: image(),
    images: [{ ...image(), id: 'image-1' }, { ...image(), id: 'image-2' }],
    sources: [
      { title: 'Reference A', organization: 'Archive A', url: 'https://example.org/reference-a' },
      { title: 'Reference B', organization: 'Archive B', url: 'https://example.org/reference-b' }
    ],
    quiz,
    map_location: null
  };
}

test('accepts complete five-language package', () => assert.deepEqual(validateStory(fixture()), []));

test('requires the summary to match the subtitle for the current admin compatibility projection', () => {
  const s = fixture();
  s.i18n.fr.summary = 'Résumé distinct';
  assert(validateStory(s).some(x => x.includes('i18n.fr.summary must equal subtitle')));
});

test('rejects inline image placement and image kinds the current admin cannot preserve', () => {
  const s = fixture();
  s.i18n.en.blocks[1].image_after = 'image-1';
  s.images[0].kind = 'document';
  const e = validateStory(s);
  assert(e.some(x => x.includes('image_after')));
  assert(e.some(x => x.includes('images[0].kind invalid')));
});

test('preserves optional legacy metadata independently in each available locale', () => {
  const s = fixture();
  delete s.i18n.de.grade;
  delete s.i18n.fr.images_note;
  assert.deepEqual(validateStory(s), []);
  s.i18n.de.grade = '';
  s.i18n.fr.images_note = null;
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.de.grade must be non-empty when provided')));
  assert(e.some(x => x.includes('i18n.fr.images_note must be a string when provided')));
});

test('allows stories that have no legacy metadata and preserves explicitly empty notes', () => {
  const s = fixture();
  for (const lang of langs) {
    for (const key of ['student_name', 'narrator_name', 'grade', 'narrator_grade', 'history_note', 'images_note', 'figure_name', 'person']) {
      delete s.i18n[lang][key];
    }
  }
  assert.deepEqual(validateStory(s), []);
  for (const lang of langs) {
    s.i18n[lang].history_note = '';
    s.i18n[lang].images_note = '';
  }
  assert.deepEqual(validateStory(s), []);
});

test('accepts explicit no-location and validates fully localized verified map locations', () => {
  const s = fixture();
  assert.deepEqual(validateStory(s), []);
  s.map_location = {
    lat: 29.98,
    lng: 31.13,
    place: { ar: 'القاهرة', en: 'Cairo', fr: 'Le Caire', it: 'Il Cairo', de: 'Kairo' }
  };
  assert.deepEqual(validateStory(s), []);
  s.map_location.place.de = 'القاهرة';
  s.map_location.lat = 120;
  const e = validateStory(s);
  assert(e.some(x => x.includes('map_location.lat must be a valid latitude')));
  assert(e.some(x => x.includes('map_location.place.de must not contain Arabic fallback')));
});

test('preserves localized figure identity when only some locales have a verified value', () => {
  const s = fixture();
  delete s.i18n.fr.figure_name;
  assert.deepEqual(validateStory(s), []);
  s.i18n.fr.figure_name = '';
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.fr.figure_name must be non-empty when provided')));
});

test('rejects missing translations and image rights', () => {
  const s = fixture();
  delete s.i18n.de;
  delete s.images[0].i18n.fr.rights;
  delete s.quiz[0].i18n.it.explanation;
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.de')));
  assert(e.some(x => x.includes('images[0].i18n.fr.rights')));
  assert(e.some(x => x.includes('quiz[0].i18n.it.explanation')));
});

test('rejects unsafe paths, invalid source URL, and quiz count', () => {
  const s = fixture();
  s.cover = { ...image(), url: undefined, path: '../private.jpg' };
  s.sources[0].url = 'javascript:alert(1)';
  s.cover.source_url = 'javascript:alert(1)';
  s.quiz.pop();
  const e = validateStory(s);
  assert(e.some(x => x.includes('unsafe local path')));
  assert(e.some(x => x.includes('cover.url must be HTTPS')));
  assert(e.some(x => x.includes('cover: source_url')));
  assert(e.some(x => x.includes('sources[0].url')));
  assert(e.some(x => x.includes('exactly 5')));
});

test('requires two distinct source URLs', () => {
  const s = fixture();
  s.sources[1].url = s.sources[0].url;
  const errors = validateStory(s);
  assert(errors.some(x => x.includes('must be distinct from other source URLs')));
});

test('rejects duplicate quiz IDs and malformed design color', () => {
  const s = fixture();
  s.quiz[1].id = s.quiz[0].id;
  s.design.accent = 'gold';
  const e = validateStory(s);
  assert(e.some(x => x.includes('duplicated')));
  assert(e.some(x => x.includes('six-digit hex')));
});

test('rejects duplicate image IDs and broken inline image references', () => {
  const s = fixture();
  s.images[1].id = 'photo-one';
  s.i18n.en.blocks[1].image_after = 'missing-image';
  const e = validateStory(s);
  assert(e.some(x => x.includes('images[1].id duplicated')));
  assert(e.some(x => x.includes('references missing image')));
});

test('rejects unexpected properties and malformed stable IDs', () => {
  const s = fixture();
  s.i18n.en.unexpected = true;
  s.sources[0].unexpected = true;
  s.quiz[0].id = 'Question 1';
  s.cover.id = 'Cover ID';
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.en: unexpected property')));
  assert(e.some(x => x.includes('sources[0]: unexpected property')));
  assert(e.some(x => x.includes('quiz[0].id must be a lowercase stable ID')));
  assert(e.some(x => x.includes('cover.id must be a stable lowercase ID')));
});

test('checks local image existence and rejects traversal and missing files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'khaledoon-story-'));
  try {
    await mkdir(path.join(root, 'stories', 'sample'), { recursive: true });
    await writeFile(path.join(root, 'stories', 'sample', 'cover.jpg'), 'test image');
    const s = fixture();
    s.cover = { ...image(), url: undefined, path: 'stories/sample/cover.jpg' };
    s.images[0] = { ...image(), id: 'photo-one', url: undefined, path: 'stories/sample/missing.jpg' };
    s.images[1] = { ...image(), id: 'photo-two', url: undefined, path: '../outside.jpg' };
    const e = await validateLocalImagePaths(s, root);
    assert(e.some(x => x.includes('file missing: stories/sample/missing.jpg')));
    assert(e.some(x => x.includes('escapes story root')));
    const good = await validateLocalImagePaths({ cover: s.cover, images: [] }, root);
    assert.deepEqual(good, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
