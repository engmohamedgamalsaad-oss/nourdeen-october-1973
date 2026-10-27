import test from 'node:test';
import assert from 'node:assert/strict';
import { v1ToV2, v2ToV1 } from '../adapters/v1-v2.mjs';
import { validateStory } from '../validate-story.mjs';
import legacyWorkflow from '../../khaledoon/assets/story-workflow.js';

const langs = ['en', 'fr', 'it', 'de'];
function image(label) {
  return {
    url: 'https://images.example/' + label + '.jpg',
    alt: label + ' alt ar', caption: label + ' caption ar',
    kind: 'illustration', source_name: label + ' source ar',
    source_url: 'https://archive.example/' + label,
    rights: 'Illustration rights ar',
    i18n: Object.fromEntries(langs.map(lang => [lang, {
      alt: label + ' alt ' + lang, caption: label + ' caption ' + lang,
      source_name: label + ' source ' + lang, rights: 'Illustration rights ' + lang
    }]))
  };
}
function fixture() {
  const translations = Object.fromEntries(langs.map(lang => [lang, {
    student_name: 'Student ' + lang, grade: 'Grade ' + lang,
    title: 'Title ' + lang, subtitle: 'Subtitle ' + lang,
    karma_text: 'Karma asks a question ' + lang + '.',
    body: [1, 2, 3].map(n => ({ en: 'Did you know?', fr: 'Le saviez-vous ?', it: 'Lo sapevi?', de: 'Wusstest du?' })[lang] + ' Verified fact ' + n + ' ' + lang + '.').join('\n\n'),
    history_note: 'Historical note ' + lang, images_note: 'Image rights note ' + lang
  }]));
  const questions = Array.from({ length: 5 }, (_, i) => ({
    q: 'Question ' + i + ' ar', o: ['A ar', 'B ar', 'C ar', 'D ar'], a: i % 4, e: 'Explanation ar',
    i18n: Object.fromEntries(langs.map(lang => [lang, {
      q: 'Question ' + i + ' ' + lang, o: ['A','B','C','D'].map(x => x + ' ' + lang),
      e: 'Explanation ' + lang
    }]))
  }));
  return {
    format: 'KH_STORY_PACKAGE_V1', section_key: 'history', figure_name: 'Historical figure',
    title: 'Title ar', subtitle: 'Subtitle ar', narrator_name: 'Narrator', narrator_grade: 'Grade 7',
    student_name: 'Student ar', grade: 'Grade ar',
    original_body: '  Original submitted wording\nkept exactly.  ',
    karma_text: 'Karma asks a question ar.',
    body: ['هل تعلم؟ حقيقة موثقة أولى.', 'هل تعلم؟ حقيقة موثقة ثانية.', 'هل تعلم؟ حقيقة موثقة ثالثة.'].join('\n\n'),
    history_note: 'Historical note ar', images_note: 'Image rights note ar',
    sources: 'Reference A https://archive.example/a\nReference B https://museum.example/b',
    cover: image('cover'), images: [image('one'), image('two')],
    visual_design: 'military-history', map_location: null,
    translations, question_bank: { questions }
  };
}

test('maps the actual admin prompt section keys fame/learning through V2 and back', () => {
  const fame = fixture();
  fame.section_key = 'fame';
  const fameV2 = v1ToV2(fame, { slug: 'fame-section-story' });
  assert.equal(fameV2.section, 'people');
  assert.equal(v2ToV1(fameV2).section_key, 'fame');

  const learning = fixture();
  learning.section_key = 'learning';
  const learningV2 = v1ToV2(learning, { slug: 'learning-section-story' });
  assert.equal(learningV2.section, 'women');
  assert.equal(v2ToV1(learningV2).section_key, 'learning');

  const knowledgeAlias = fixture();
  knowledgeAlias.section_key = 'knowledge';
  assert.throws(
    () => v1ToV2(knowledgeAlias, { slug: 'knowledge-section-story' }),
    /unsupported section_key: knowledge/
  );
});

test('preserves the reader-suggestion section and legacy discovery design', () => {
  const v1 = fixture();
  v1.section_key = 'readers';
  v1.visual_design = 'discovery';
  const v2 = v1ToV2(v1, { slug: 'reader-submitted-story' });
  assert.equal(v2.section, 'readers');
  assert.equal(v2.design.variant, 'reader-story');
  const back = v2ToV1(v2);
  assert.equal(back.section_key, 'readers');
  assert.equal(back.visual_design, 'discovery');
});

test('round-trip fixture passes the actual current V1 admin package validator before and after conversion', () => {
  const v1 = fixture();
  const before = legacyWorkflow.validateStoryPackage(v1);
  assert.equal(before.ok, true, before.errors.join('\n'));

  const v2 = v1ToV2(v1, { slug: 'historical-figure' });
  const back = v2ToV1(v2);
  const after = legacyWorkflow.validateStoryPackage(back);
  assert.equal(after.ok, true, after.errors.join('\n'));
});

test('V1 to V2 and back preserves original text, translated story streams, sources, images and quiz answers', () => {
  const v1 = fixture();
  const v2 = v1ToV2(v1, { slug: 'historical-figure' });
  assert.equal(v2.format, 'KHALEDOON_STORY_V2');
  assert.equal(v2.original_body, v1.original_body);
  assert.equal(v2.sources[0].title, 'Reference A https://archive.example/a');
  assert.equal(v2.i18n.fr.blocks[0].speaker, 'karma');
  assert.equal(v2.i18n.fr.blocks[1].speaker, 'narrator');
  assert.equal(v2.i18n.fr.blocks.filter(b => b.type === 'did_you_know').length, 3);
  assert.equal(v2.quiz[3].correct_option, v1.question_bank.questions[3].a);
  assert.equal(v2.images[0].i18n.de.caption, v1.images[0].i18n.de.caption);
  const back = v2ToV1(v2);
  assert.equal(back.original_body, v1.original_body);
  assert.equal(back.body, v1.body);
  assert.equal(back.karma_text, v1.karma_text);
  assert.equal(back.sources, v1.sources);
  assert.equal(back.cover.caption, v1.cover.caption);
  assert.equal(back.images[1].source_url, v1.images[1].source_url);
  assert.deepEqual(back.question_bank, v1.question_bank);
  for (const lang of langs) {
    assert.equal(back.translations[lang].body, v1.translations[lang].body);
    assert.equal(back.translations[lang].karma_text, v1.translations[lang].karma_text);
    assert.equal(back.translations[lang].grade, v1.translations[lang].grade);
  }
});

test('refuses ambiguous source lines rather than silently flattening source citations', () => {
  const v1 = fixture();
  v1.sources = 'One line https://archive.example/a and https://museum.example/b';
  assert.throws(() => v1ToV2(v1, { slug: 'historical-figure' }), /exactly one HTTPS URL/);
});

test('refuses V1 quizzes with fewer than four options rather than inventing choices', () => {
  const v1 = fixture();
  v1.question_bank.questions[0].o = ['A', 'B'];
  for (const lang of langs) v1.question_bank.questions[0].i18n[lang].o = ['A', 'B'];
  assert.throws(() => v1ToV2(v1, { slug: 'historical-figure' }), /four choices/);
});

test('refuses unknown visual variants and invalid source text', () => {
  const v1 = fixture();
  v1.visual_design = 'unmapped-design';
  assert.throws(() => v1ToV2(v1, { slug: 'historical-figure' }), /no lossless V2 mapping/);
  const v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  v2.i18n.en.blocks.push({ type: 'paragraph', speaker: 'karma', text: 'Late Karma line' });
  assert.throws(() => v2ToV1(v2), /interleaves Karma/);
});


test('safely blocks legacy packages with a null cover or missing image rights/locales', () => {
  const missingCover = fixture();
  missingCover.cover = null;
  assert.throws(
    () => v1ToV2(missingCover, { slug: 'historical-figure' }),
    /cover must be an object/
  );
  const verifiedCover = fixture().cover;
  const convertedWithCover = v1ToV2(missingCover, {
    slug: 'historical-figure',
    coverOverride: verifiedCover
  });
  assert.equal(convertedWithCover.cover.url, verifiedCover.url);
  assert.notEqual(convertedWithCover.cover.url, convertedWithCover.images[0].url);
  assert.notEqual(convertedWithCover.cover.url, convertedWithCover.images[1].url);
  assert.throws(() => v1ToV2(missingCover, {
    slug: 'historical-figure',
    coverOverride: missingCover.images[0]
  }), /duplicates a gallery image/);

  const existingCover = fixture();
  assert.throws(() => v1ToV2(existingCover, {
    slug: 'historical-figure',
    coverOverride: verifiedCover
  }), /only allowed when the legacy cover is missing or null/);

  const missingRights = fixture();
  delete missingRights.images[0].rights;
  assert.throws(
    () => v1ToV2(missingRights, { slug: 'historical-figure' }),
    /images\[0\]\.ar\.rights is required/
  );

  const missingLocale = fixture();
  delete missingLocale.images[0].i18n.de;
  assert.throws(
    () => v1ToV2(missingLocale, { slug: 'historical-figure' }),
    /images\[0\] is missing de image text/
  );
});

test('normalizes recognizable legacy prompt output without inventing absent Arabic metadata', () => {
  const v1 = fixture();
  const originalBody = v1.body;
  delete v1.format;
  delete v1.body;
  v1.current_body = originalBody;
  v1.question_bank = JSON.stringify(v1.question_bank);
  delete v1.student_name;

  const v2 = v1ToV2(v1, { slug: 'legacy-prompt-output' });
  assert.equal(v2.format, 'KHALEDOON_STORY_V2');
  assert.equal(v2.i18n.ar.blocks.filter(b => b.speaker === 'narrator').map(b => b.text).join('\n\n'), originalBody);
  assert.equal(v2.original_body, fixture().original_body);
  assert.equal(v2.quiz.length, 5);
  assert.equal(Object.hasOwn(v2.i18n.ar, 'student_name'), false,
    'do not invent an Arabic student_name when it is absent from the legacy package');
  for (const lang of langs) {
    assert.equal(v2.i18n[lang].student_name, 'Student ' + lang,
      'preserve known localized student_name values even when Arabic is missing');
  }
});

test('preserves sparse proposer names and does not mislabel narrator role text as a school grade', () => {
  const v1 = fixture();
  delete v1.student_name;
  v1.translations.en.student_name = 'Nourdeen Mohamed';
  v1.translations.fr.student_name = 'Nourdeen Mohamed';
  v1.translations.it.student_name = 'Nourdeen Mohamed';
  v1.translations.de.student_name = 'Nourdeen Mohamed';
  v1.grade = 'راوي الحكاية';
  v1.narrator_grade = 'راوي الحكاية';
  for (const lang of langs) {
    v1.translations[lang].grade = ({
      en: 'Story narrator',
      fr: "Narrateur de l'histoire",
      it: 'Narratore della storia',
      de: 'Erzähler der Geschichte'
    })[lang];
  }

  const v2 = v1ToV2(v1, { slug: 'metadata-safety-check' });
  assert.equal(Object.hasOwn(v2.i18n.ar, 'student_name'), false);
  for (const lang of langs) {
    assert.equal(v2.i18n[lang].student_name, 'Nourdeen Mohamed');
    assert.equal(Object.hasOwn(v2.i18n[lang], 'grade'), false);
    assert.equal(Object.hasOwn(v2.i18n[lang], 'narrator_grade'), false);
  }
  assert.deepEqual(validateStory(v2), []);
});

test('rejects a missing V1 format when the package does not have a recognizable legacy signature', () => {
  const v1 = fixture();
  delete v1.format;
  delete v1.images;
  assert.throws(() => v1ToV2(v1, { slug: 'not-recognizable' }), /recognizable legacy V1 package/);
});

test('round-trips legacy diagram kind and rejects V2 image kinds unsupported by the V1 importer', () => {
  const v1 = fixture();
  v1.images[0].kind = 'diagram';
  const v2 = v1ToV2(v1, { slug: 'historical-figure' });
  assert.equal(v2.images[0].kind, 'diagram');
  const back = v2ToV1(v2);
  assert.equal(back.images[0].kind, 'diagram');
  assert.equal(v1ToV2(back, { slug: 'historical-figure' }).images[0].kind, 'diagram');

  const photograph = v1ToV2(fixture(), { slug: 'historical-figure' });
  photograph.cover.kind = 'photograph';
  assert.throws(() => v2ToV1(photograph), /not supported by V1/);

  const document = v1ToV2(fixture(), { slug: 'historical-figure' });
  document.images[0].kind = 'document';
  assert.throws(() => v2ToV1(document), /has no valid V1 representation/);
});


test('rejects V2-only summary, inline-image, custom-design, and lossy text features', () => {
  const makeV2 = () => v1ToV2(fixture(), { slug: 'historical-figure' });

  let v2 = makeV2();
  v2.i18n.en.summary = 'A distinct summary that V1 cannot store';
  assert.throws(() => v2ToV1(v2), /admin-bridge validation failed:.*summary differs from subtitle/);

  v2 = makeV2();
  v2.i18n.ar.blocks[0].image_after = 'image-1';
  assert.throws(() => v2ToV1(v2), /image_after cannot be represented/);

  v2 = makeV2();
  v2.design.accent = '#123456';
  assert.throws(() => v2ToV1(v2), /custom V2 accent/);

  v2 = makeV2();
  v2.i18n.ar.blocks[0].text = '  Karma asks a question ar.';
  assert.throws(() => v2ToV1(v2), /text whitespace/);

  v2 = makeV2();
  v2.sources[0].organization = 'Different organization';
  assert.throws(() => v2ToV1(v2), /title already contains a URL that cannot be represented unambiguously/);
});


test('rejects whitespace-lossy V1 paragraphs rather than silently trimming them', () => {
  const v1 = fixture();
  v1.body = '  Leading spaces must not disappear.\n\nSecond paragraph.';
  assert.throws(() => v1ToV2(v1, { slug: 'historical-figure' }), /cannot be round-tripped exactly/);

  const v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  v2.sources[0].accessed_at = '2026-10-27';
  assert.throws(() => v2ToV1(v2), /accessed_at metadata has no lossless V1 field/);
});

test('rejects structurally incomplete V2 images and quiz instead of emitting invalid V1', () => {
  let v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  v2.images = [];
  assert.throws(() => v2ToV1(v2), /between two and five images/);

  v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  delete v2.quiz[0].i18n.de;
  assert.throws(() => v2ToV1(v2), /incomplete in de/);

  v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  v2.i18n.fr.blocks = [];
  assert.throws(() => v2ToV1(v2), /at least three story blocks/);
});

test('rejects packages outside the actual V1 source and gallery limits', () => {
  const oneSource = fixture();
  oneSource.sources = 'Only source https://archive.example/a';
  assert.throws(() => v1ToV2(oneSource, { slug: 'historical-figure' }), /at least two distinct source URLs/);

  const duplicateSources = fixture();
  duplicateSources.sources = 'Source A https://archive.example/a\nSource B https://archive.example/a';
  assert.throws(() => v1ToV2(duplicateSources, { slug: 'historical-figure' }), /at least two distinct source URLs/);

  const tooManyImages = fixture();
  tooManyImages.images.push(image('three'), image('four'), image('five'), image('six'));
  assert.throws(() => v1ToV2(tooManyImages, { slug: 'historical-figure' }), /between two and five gallery images/);

  const v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  v2.sources[1].url = v2.sources[0].url;
  v2.sources[1].title = 'Reference B https://archive.example/a';
  v2.sources[1].organization = 'archive.example';
  assert.throws(() => v2ToV1(v2), /at least two distinct sources/);
});

test('requires a caller-supplied stable slug and preserves explicit no-location', () => {
  assert.throws(() => v1ToV2(fixture()), /stable slug/);
  const v2 = v1ToV2(fixture(), { slug: 'historical-figure' });
  assert.equal(v2.map_location, null);
  assert.equal(v2ToV1(v2).map_location, null);
});

test('adapter output satisfies the independent V2 story validator in both directions', async () => {
  const { validateStory } = await import('../validate-story.mjs');
  const v1 = fixture();
  const v2 = v1ToV2(v1, { slug: 'validator-compatibility-story' });
  assert.deepEqual(validateStory(v2), [], 'V1 → V2 output must satisfy the V2 validator');

  const back = v2ToV1(v2);
  assert.equal(legacyWorkflow.validateStoryPackage(back).ok, true,
    legacyWorkflow.validateStoryPackage(back).errors.join('\\n'));
  assert.deepEqual(validateStory(v1ToV2(back, { slug: 'validator-compatibility-story' })), [],
    'round-tripped V2 output must still satisfy the V2 validator');
});

test('round-trips normal V2 source titles and organization names through the V1 admin source field', () => {
  const v1 = fixture();
  const v2 = v1ToV2(v1, { slug: 'source-metadata-roundtrip' });
  v2.sources = [
    { title: 'Apollo 17 geology briefing', organization: 'NASA History Office] Research', url: 'https://history.nasa.gov/apollo17' },
    { title: 'Farouk El-Baz biography', organization: 'Boston University', url: 'https://www.bu.edu/earth/farouk-el-baz' }
  ];
  assert.deepEqual(validateStory(v2), []);
  const back = v2ToV1(v2);
  const legacyCheck = legacyWorkflow.validateStoryPackage(back);
  assert.equal(legacyCheck.ok, true, legacyCheck.errors.join('\n'));
  assert.ok(back.sources.includes('Apollo 17 geology briefing — [org:NASA%20History%20Office%5D%20Research] — https://history.nasa.gov/apollo17'));
  const v2Again = v1ToV2(back, { slug: 'source-metadata-roundtrip' });
  assert.deepEqual(v2Again.sources, v2.sources);
});


test('rejects missing figure identity instead of substituting the story title', () => {
  const v2 = v1ToV2(fixture(), { slug: 'missing-figure-identity' });
  delete v2.i18n.ar.figure_name;
  delete v2.i18n.ar.person;
  assert.throws(
    () => v2ToV1(v2),
    /figure_name or person is required.*title is not used as a substitute/
  );
});

test('v2ToV1 enforces contract validation when called without the admin pre-validator', () => {
  const v2 = v1ToV2(fixture(), { slug: 'adapter-validation-boundary' });
  v2.i18n.en.summary = 'A distinct summary';
  assert.throws(() => v2ToV1(v2), /V2 admin-bridge validation failed:.*summary differs from subtitle/);

  const invalidIds = v1ToV2(fixture(), { slug: 'adapter-invalid-ids' });
  invalidIds.images[0].id = 'photo-main';
  assert.throws(() => v2ToV1(invalidIds), /V2 admin-bridge validation failed:.*images\[0\]\.id must be image-1/);
});


test('rejects source titles with line breaks that the V1 line-based field cannot preserve', () => {
  const v2 = v1ToV2(fixture(), { slug: 'multiline-source-title' });
  v2.sources[0].title = 'First line\\nSecond line';
  assert.throws(() => v2ToV1(v2), /title cannot be represented safely in the single-line V1 source field/);
});
