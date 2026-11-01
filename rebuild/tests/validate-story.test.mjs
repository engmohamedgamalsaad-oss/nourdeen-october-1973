import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateStory, validateLocalImagePaths, validateForAdminBridge } from '../validate-story.mjs';

const langs = ['ar', 'en', 'fr', 'it', 'de'];
const source = (name) => ({
  title: 'Reference ' + name,
  organization: 'Archive',
  url: 'https://example.org/reference-' + name.toLowerCase(),
  i18n: Object.fromEntries(langs.map(l => [l, {
    title: 'Reference ' + name + ' ' + l,
    organization: 'Archive ' + l
  }]))
});
const image = () => ({
  url: 'https://example.org/image.jpg',
  kind: 'photograph',
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
    summary: 'summary ' + l,
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
      { type: 'paragraph', speaker: 'narrator', text: 'story ' + l, image_after: 'photo-one' },
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
    format: 'KHALEDOON_STORY',
    slug: 'sample-story',
    section: 'october',
    design: { variant: 'military-history', accent: '#d6ad55' },
    original_body: 'Submitted original',
    i18n,
    cover: image(),
    images: [{ ...image(), id: 'photo-one' }, { ...image(), id: 'photo-two' }],
    sources: [source('A'), source('B')],
    quiz,
    map_location: null
  };
}

test('accepts complete five-language package', () => assert.deepEqual(validateStory(fixture()), []));

test('preserves V1 metadata and requires every supplied metadata field in all locales', () => {
  const s = fixture();
  delete s.i18n.de.grade;
  delete s.i18n.fr.images_note;
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.de.grade required in every locale')));
  assert(e.some(x => x.includes('i18n.fr.images_note required in every locale')));
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

test('preserves localized figure identity and requires all locales when used', () => {
  const s = fixture();
  delete s.i18n.fr.figure_name;
  const e = validateStory(s);
  assert(e.some(x => x.includes('i18n.fr.figure_name required in every locale')));
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

test('requires at least five unified story quiz questions but keeps the V1 bridge lossless', () => {
  const tooFew = fixture();
  tooFew.quiz.pop();
  assert(validateStory(tooFew).some(x => x.includes('at least 5')));

  const six = fixture();
  six.quiz.push({ ...six.quiz[0], id: 'question-6' });
  assert.deepEqual(validateStory(six), []);
  assert(validateForAdminBridge(six).some(x => x.includes('supports exactly 5')));

  const sixImages = fixture();
  for (let i = 3; i <= 6; i++) sixImages.images.push({ ...sixImages.images[0], id: 'photo-' + i });
  assert.deepEqual(validateStory(sixImages), []);
  assert(validateForAdminBridge(sixImages).some(x => x.includes('supports 2 to 5 images')));

  const invalid = fixture();
  invalid.cover = { ...image(), url: undefined, path: '../private.jpg' };
  invalid.sources[0].url = 'javascript:alert(1)';
  invalid.cover.source_url = 'javascript:alert(1)';
  const errors = validateStory(invalid);
  assert(errors.some(x => x.includes('unsafe local path')));
  assert(errors.some(x => x.includes('cover.url must be HTTPS')));
  assert(errors.some(x => x.includes('cover: source_url')));
  assert(errors.some(x => x.includes('sources[0].url')));
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
  assert(e.some(x => x.includes('quiz[0].id must be a stable lowercase ID')));
  assert(e.some(x => x.includes('cover.id must be a lowercase stable ID')));
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


test('real October unified story package preserves all 20 archived legacy quiz questions plus three supplemental questions', async () => {
  const root = path.resolve(new URL('../..', import.meta.url).pathname);
  const pkg = JSON.parse(await readFile(path.join(root, 'rebuild/story-packages/october-sea-men.v2.json'), 'utf8'));
  const legacy = JSON.parse(await readFile(path.join(root, 'rebuild/story-packages/source-archives/october-sea-men-legacy-quiz-001.json'), 'utf8'));
  assert.equal(legacy.questions.length, 20);
  assert.equal(pkg.quiz.length, 23);
  for (let i = 0; i < 20; i++) {
    assert.equal(pkg.quiz[i].id, 'legacy-' + String(i + 1).padStart(2, '0'));
    assert.equal(pkg.quiz[i].i18n.ar.question, legacy.questions[i].q);
    assert.equal(pkg.quiz[i].correct_option, [1,2,0,3,1,1,2,3,0,3,1,3,0,1,3,1,2,3,0,1][i]);
    for (const lang of langs) {
      const question = pkg.quiz[i].i18n[lang];
      assert.ok(question.question.trim());
      assert.equal(question.options.length, 4);
      assert.ok(question.options.every(x => typeof x === 'string' && x.trim()));
      assert.ok(question.explanation.trim());
    }
  }
  assert.deepEqual(pkg.quiz.slice(20).map(q => q.id), ['strait-location', 'nabil-role', 'ketting-operation']);
  assert.ok(new Set(pkg.quiz.slice(0, 20).map(q => q.correct_option)).size > 1, 'correct answers should not all occupy one position');
});
