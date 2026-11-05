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
    needs_human_review: item.lang === 'ar'
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

test('refuses October and rejects invalid review JSON', () => {
  assert.throws(() => review.collectSegments(packageFixture('october')), /أكتوبر/);
  const result = review.validateResult('not json', packageFixture());
  assert.equal(result.ok, false);
});
