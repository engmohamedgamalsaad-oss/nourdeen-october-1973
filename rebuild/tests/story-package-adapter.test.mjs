import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyToStory, storyToLegacy } from '../adapters/story-package-adapter.mjs';

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
    body: ['Did you know? Verified fact one ' + lang + '.', 'Did you know? Verified fact two ' + lang + '.', 'Did you know? Verified fact three ' + lang + '.'].join('\n\n'),
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

test('V1 to V2 and back preserves original text, translated story streams, sources, images and quiz answers', () => {
  const v1 = fixture();
  const v2 = legacyToStory(v1, { slug: 'historical-figure' });
  assert.equal(v2.format, 'KHALEDOON_STORY');
  assert.equal(v2.original_body, v1.original_body);
  assert.equal(v2.sources[0].title, 'Reference A https://archive.example/a');
  assert.equal(v2.i18n.fr.blocks[0].speaker, 'karma');
  assert.equal(v2.i18n.fr.blocks[1].speaker, 'narrator');
  assert.equal(v2.i18n.fr.blocks.filter(b => b.type === 'did_you_know').length, 3);
  assert.equal(v2.quiz[3].correct_option, v1.question_bank.questions[3].a);
  assert.equal(v2.images[0].i18n.de.caption, v1.images[0].i18n.de.caption);
  const back = storyToLegacy(v2);
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
  assert.throws(() => legacyToStory(v1, { slug: 'historical-figure' }), /exactly one HTTPS URL/);
});

test('refuses V1 quizzes with fewer than four options rather than inventing choices', () => {
  const v1 = fixture();
  v1.question_bank.questions[0].o = ['A', 'B'];
  for (const lang of langs) v1.question_bank.questions[0].i18n[lang].o = ['A', 'B'];
  assert.throws(() => legacyToStory(v1, { slug: 'historical-figure' }), /four choices/);
});

test('refuses unknown visual variants and invalid source text', () => {
  const v1 = fixture();
  v1.visual_design = 'unmapped-design';
  assert.throws(() => legacyToStory(v1, { slug: 'historical-figure' }), /no lossless V2 mapping/);
  const v2 = legacyToStory(fixture(), { slug: 'historical-figure' });
  v2.i18n.en.blocks.push({ type: 'paragraph', speaker: 'karma', text: 'Late Karma line' });
  assert.throws(() => storyToLegacy(v2), /interleaves Karma/);
});


test('round-trips shared image kinds and rejects V2-only kinds at the V1 bridge', () => {
  const v2 = legacyToStory(fixture(), { slug: 'historical-figure' });
  v2.cover.kind = 'archival';
  v2.images[0].kind = 'map';
  const back = storyToLegacy(v2);
  assert.equal(back.cover.kind, 'archival');
  assert.equal(back.images[0].kind, 'map');
  const again = legacyToStory(back, { slug: 'historical-figure' });
  assert.equal(again.cover.kind, 'archival');
  assert.equal(again.images[0].kind, 'map');

  const unsupported = legacyToStory(fixture(), { slug: 'historical-figure' });
  unsupported.cover.kind = 'photograph';
  unsupported.images[0].kind = 'document';
  assert.throws(() => storyToLegacy(unsupported), /not supported by V1/);
});

test('requires a caller-supplied stable slug and preserves explicit no-location', () => {
  assert.throws(() => legacyToStory(fixture()), /stable slug/);
  const v2 = legacyToStory(fixture(), { slug: 'historical-figure' });
  assert.equal(v2.map_location, null);
  assert.equal(storyToLegacy(v2).map_location, null);
});
