import test from 'node:test';
import assert from 'node:assert/strict';
import { v1ToV2, v2ToV1 } from '../adapters/v1-v2.mjs';
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
  assert.throws(() => v2ToV1(photograph), /has no valid V1 representation/);

  const document = v1ToV2(fixture(), { slug: 'historical-figure' });
  document.images[0].kind = 'document';
  assert.throws(() => v2ToV1(document), /has no valid V1 representation/);
});


test('rejects V2-only summary, inline-image, custom-design, and lossy text features', () => {
  const makeV2 = () => v1ToV2(fixture(), { slug: 'historical-figure' });

  let v2 = makeV2();
  v2.i18n.en.summary = 'A distinct summary that V1 cannot store';
  assert.throws(() => v2ToV1(v2), /summary differs from subtitle/);

  v2 = makeV2();
  v2.i18n.ar.blocks[0].image_after = 'image-1';
  assert.throws(() => v2ToV1(v2), /inline image placement/);

  v2 = makeV2();
  v2.design.accent = '#123456';
  assert.throws(() => v2ToV1(v2), /custom V2 accent/);

  v2 = makeV2();
  v2.i18n.ar.blocks[0].text = '  Karma asks a question ar.';
  assert.throws(() => v2ToV1(v2), /text whitespace/);

  v2 = makeV2();
  v2.sources[0].organization = 'Different organization';
  assert.throws(() => v2ToV1(v2), /cannot be represented losslessly/);
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


test('accepts legacy V1 packages without a separate cover or localized image attribution fields', async () => {
  const v1 = fixture();
  delete v1.cover;
  for (const image of v1.images) {
    for (const lang of langs) {
      delete image.i18n[lang].source_name;
      delete image.i18n[lang].rights;
    }
  }
  v1.map_location = {
    lat: 25.7383,
    lng: 32.6065,
    place: {
      ar: 'معبد حتشبسوت بالدير البحري - الأقصر، مصر',
      en: 'Mortuary Temple of Hatshepsut at Deir el-Bahari - Luxor, Egypt',
      fr: 'Temple funéraire de Hatshepsout à Deir el-Bahari - Louxor, Égypte',
      it: 'Tempio funerario di Hatshepsut a Deir el-Bahari - Luxor, Egitto',
      de: 'Totentempel der Hatschepsut in Deir el-Bahari - Luxor, Ägypten'
    },
    source_name: 'UNESCO World Heritage Centre',
    source_url: 'https://whc.unesco.org/en/list/87',
    approximate: false
  };

  const v2 = v1ToV2(v1, { slug: 'legacy-package-shape' });
  assert.equal(v2.cover.caption, v1.images[0].caption);
  assert.equal(v2.images[0].i18n.en.source_name, v1.images[0].source_name);
  assert.equal(v2.images[0].i18n.de.rights, v1.images[0].rights);
  assert.equal(v2.map_location.source_name, 'UNESCO World Heritage Centre');
  const { validateStory } = await import('../validate-story.mjs');
  assert.deepEqual(validateStory(v2), []);

  const back = v2ToV1(v2);
  assert.equal(back.cover.caption, v1.images[0].caption);
  assert.equal(back.map_location.source_url, v1.map_location.source_url);
  assert.equal(legacyWorkflow.validateStoryPackage(back).ok, true,
    legacyWorkflow.validateStoryPackage(back).errors.join('\\n'));
});
