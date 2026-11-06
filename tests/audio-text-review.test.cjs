const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../khaledoon/assets/audio-text-review.js');

function packageFixture(section = 'science') {
  const i18n = {};
  for (const lang of review.LANGS) {
    i18n[lang] = {
      blocks: [
        { speaker: 'narrator', text: lang === 'ar' ? 'الجملة الأولى.' : 'First sentence.' },
        { speaker: 'karma', text: lang === 'ar' ? 'أنا كارما؟' : 'I am Karma?' }
      ]
    };
  }
  return { format: 'KHALEDOON_STORY', slug: 'sample-story', section, i18n };
}

test('collects all spoken blocks in the five supported languages', () => {
  const items = review.collectSegments(packageFixture());
  assert.equal(items.length, 10);
  assert.deepEqual(new Set(items.map(item => item.lang)), new Set(review.LANGS));
});

test('diagnostics mark Arabic for human dialect review without changing text', () => {
  const pkg = packageFixture();
  const items = review.diagnose(pkg);
  const arabic = items.filter(item => item.lang === 'ar');
  assert.equal(arabic.length, 2);
  assert.ok(arabic.every(item => item.flags.includes('human_egyptian_dialect_review_required')));
  assert.equal(arabic[0].original_text, pkg.i18n.ar.blocks[0].text);
});

test('validates exact one-to-one review coverage and requires human approval', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: true
  }));
  const result = review.validateResult({ format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments }, pkg);
  assert.equal(result.ok, true);
  assert.equal(result.total, 10);
  assert.equal(result.applied, false);
  assert.equal(result.requires_human_approval, true);
});

test('rejects missing, duplicate, or altered original segments', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: true
  }));
  segments.pop();
  segments.push({ ...segments[0], original_text: 'altered source' });
  const result = review.validateResult({ format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments }, pkg);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('النص الأصلي تغيّر')));
  assert.ok(result.errors.some(error => error.includes('غير موجود في التقرير')));
});

test('adds exact Arabic dictionary suggestions to the existing review report without approval', () => {
  const pkg = packageFixture();
  pkg.i18n.ar.blocks[0].text = 'وتذكر الدراسات المنشورة ذلك.';
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: true
  }));
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const dictionary = {
    schema_version: 1,
    entries: [{
      id: 'studies',
      match: 'وتذكر الدراسات',
      spoken: 'وَتَذْكُرُ الدِّرَاسَاتُ'
    }]
  };
  const outcome = review.applyDictionarySuggestions(report, pkg, dictionary);
  const arabic = outcome.report.segments.find(item => item.lang === 'ar' && item.block_index === 0);
  assert.equal(arabic.original_text, 'وتذكر الدراسات المنشورة ذلك.');
  assert.equal(arabic.proposed_audio_text, 'وَتَذْكُرُ الدِّرَاسَاتُ المنشورة ذلك.');
  assert.equal(arabic.issue_type, 'pronunciation');
  assert.equal(arabic.needs_human_review, true);
  assert.equal(arabic.suggestion_source, 'ar-EG-pronunciation-dictionary');
  assert.deepEqual(outcome.applied, [{ lang: 'ar', block_index: 0, entry_id: 'studies' }]);
  assert.equal(outcome.requires_human_approval, true);
  assert.equal(outcome.applied_to_story, false);
  assert.equal(outcome.report.segments.find(item => item.lang === 'en' && item.block_index === 0).proposed_audio_text, 'First sentence.');
});

test('exports a dictionary candidate only when the administrator explicitly approves it', () => {
  const pkg = packageFixture();
  pkg.i18n.ar.blocks[0].text = 'وتذكر الدراسات المنشورة ذلك.';
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: true
  }));
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const dictionary = {
    schema_version: 1,
    entries: [{
      id: 'studies',
      match: 'وتذكر الدراسات',
      spoken: 'وَتَذْكُرُ الدِّرَاسَاتُ'
    }]
  };
  const outcome = review.applyDictionarySuggestions(report, pkg, dictionary);
  const approved = review.buildApprovedAudioPronunciation(outcome.report, pkg, ['ar:0']);
  const rejected = review.buildApprovedAudioPronunciation(outcome.report, pkg, []);
  assert.equal(approved.approved_audio_text_rewrites.ar['0'], 'وَتَذْكُرُ الدِّرَاسَاتُ المنشورة ذلك.');
  assert.equal(approved.blocks['0'], 'وَتَذْكُرُ الدِّرَاسَاتُ المنشورة ذلك.');
  assert.equal(rejected.blocks['0'], undefined);
  assert.equal(rejected.review.segments.find(item => item.lang === 'ar' && item.block_index === 0).decision, 'approved_original');
});

test('dictionary does not match partial words or overwrite an existing human review suggestion', () => {
  const pkg = packageFixture();
  pkg.i18n.ar.blocks[0].text = 'وتذكرت الدراسات المنشورة.';
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.lang === 'ar' && item.block_index === 0 ? 'صياغة راجعها الإنسان.' : item.original_text,
    issue_type: item.lang === 'ar' && item.block_index === 0 ? 'heavy_sentence' : 'none',
    reason: item.lang === 'ar' && item.block_index === 0 ? 'اقتراح سابق.' : '',
    needs_human_review: true
  }));
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const dictionary = {
    schema_version: 1,
    entries: [{ id: 'studies', match: 'وتذكر الدراسات', spoken: 'وَتَذْكُرُ الدِّرَاسَاتُ' }]
  };
  const outcome = review.applyDictionarySuggestions(report, pkg, dictionary);
  const arabic = outcome.report.segments.find(item => item.lang === 'ar' && item.block_index === 0);
  assert.equal(arabic.proposed_audio_text, 'صياغة راجعها الإنسان.');
  assert.equal(outcome.applied.length, 0);
});

test('rejects dictionary rules that change Arabic letters', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: true
  }));
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const dictionary = {
    schema_version: 1,
    entries: [{ id: 'unsafe', match: 'مركز', spoken: 'مراكز', before: 'في' }]
  };
  assert.throws(() => review.applyDictionarySuggestions(report, pkg, dictionary), /قاعدة قاموس غير آمنة/);
});

test('exports only the suggestions explicitly approved by the administrator', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.lang === 'ar' && item.block_index === 0
      ? 'صياغة صوتية أسهل.'
      : item.original_text,
    issue_type: item.lang === 'ar' && item.block_index === 0 ? 'heavy_sentence' : 'none',
    reason: item.lang === 'ar' && item.block_index === 0 ? 'تسهيل النطق.' : '',
    needs_human_review: true
  }));
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const patch = review.buildApprovedPatch(report, pkg, ['ar:0']);
  assert.equal(patch.status, 'approved_for_manual_application');
  assert.equal(patch.applied, false);
  assert.equal(patch.changes.length, 1);
  assert.equal(patch.changes[0].lang, 'ar');
  assert.equal(patch.changes[0].approved_audio_text, 'صياغة صوتية أسهل.');
  const empty = review.buildApprovedPatch(report, pkg, []);
  assert.equal(empty.changes.length, 0);
});

test('exports a complete five-language admin-approved audio pronunciation file', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => {
    const changed = item.block_index === 0;
    return {
      ...item,
      proposed_audio_text: changed ? (item.lang === 'ar' ? 'صياغة عربية أسهل.' : 'An easier spoken sentence.') : item.original_text,
      issue_type: changed ? 'heavy_sentence' : 'none',
      reason: changed ? 'تسهيل النطق.' : '',
      needs_human_review: true
    };
  });
  const report = { format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments };
  const file = review.buildApprovedAudioPronunciation(report, pkg, review.LANGS.map(lang => lang + ':0'));
  assert.equal(file.format, 'KHALEDOON_AUDIO_PRONUNCIATION_V1');
  assert.equal(file.review.status, 'approved_by_admin');
  assert.deepEqual(file.review.languages, review.LANGS);
  assert.equal(file.review.total_segments, 10);
  assert.equal(file.approved_audio_text_rewrites.ar['0'], 'صياغة عربية أسهل.');
  assert.equal(file.approved_audio_text_rewrites.en['0'], 'An easier spoken sentence.');
  assert.deepEqual(file.approved_audio_only_rewrites, ['0']);
  assert.deepEqual(file.blocks, { '0': 'صياغة عربية أسهل.' });
  assert.equal(file.review.segments.length, 10);
});

test('rejects a model report that attempts to waive human review', () => {
  const pkg = packageFixture();
  const segments = review.collectSegments(pkg).map(item => ({
    ...item,
    proposed_audio_text: item.original_text,
    issue_type: 'none',
    reason: '',
    needs_human_review: false
  }));
  const result = review.validateResult({ format: 'KHALEDOON_AUDIO_TEXT_REVIEW_V1', segments }, pkg);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('المراجعة البشرية مطلوبة دائمًا')));
});

test('refuses October and rejects invalid review JSON', () => {
  assert.throws(() => review.collectSegments(packageFixture('october')), /أكتوبر/);
  const result = review.validateResult('not json', packageFixture());
  assert.equal(result.ok, false);
});
