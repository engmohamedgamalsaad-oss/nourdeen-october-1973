/* Tests for the generated reader preview and collision-safe ID selection. No network or Supabase writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
const adminSource = fs.readFileSync('khaledoon/admin.html', 'utf8');
function loadBundle(fetchMock) {
  const context = { window: {}, fetch: fetchMock };
  vm.runInNewContext(source, context, { filename: 'story-template-bundle.js' });
  return context.window.KHStoryBundle;
}
function loadAiParser() {
  const start = adminSource.indexOf('function parseAiPackage(raw){');
  const end = adminSource.indexOf('\\n  function showAiRepair(raw,missing){', start);
  assert.ok(start >= 0 && end > start, 'AI package parser must exist in admin source');
  const fn = adminSource.slice(start, end).trim();
  return vm.runInNewContext('(' + fn + ')', {
    SEC: { october: 'october', history: 'history', science: 'science', learning: 'learning',
      women: 'women', fame: 'fame', people: 'people', curriculum: 'curriculum',
      islamic: 'islamic', readers: 'readers' }
  });
}
function validPackage() {
  const translations = {};
  for (const lang of ['en','fr','it','de']) translations[lang] = {
    title: 'Title ' + lang, subtitle: 'Subtitle ' + lang, karma_text: 'Karma ' + lang,
    body: 'Narrator text ' + lang, history_note: 'History ' + lang, images_note: 'Image rights ' + lang
  };
  const questions = [];
  for (let i = 0; i < 5; i++) {
    const i18n = {};
    for (const lang of ['en','fr','it','de']) i18n[lang] = {
      q: 'Question ' + i + ' ' + lang, o: ['A','B','C'], e: 'Explanation ' + lang
    };
    questions.push({ q: 'Question ' + i, o: ['A','B','C'], a: 0, e: 'Explanation', i18n });
  }
  return { format: 'KH_STORY_PACKAGE_V1', section_key: 'history', figure_name: 'Test figure',
    title: 'Valid test story', subtitle: 'Test subtitle', body: 'Narrator story body longer than fifty characters for validation.',
    karma_text: 'Karma asks a test question.', history_note: 'Historical context', sources: 'Source one https://example.org/1\\nSource two https://example.org/2',
    images_note: 'No archival image; illustrative cover only.', original_body: 'Original text',
    translations, question_bank: { questions } };
}
async function main() {
  let heads = [];
  const parseAiPackage = loadAiParser();
  const valid = validPackage();
  assert.equal(parseAiPackage(JSON.stringify(valid)).title, 'Valid test story', 'valid complete AI JSON must parse');
  assert.throws(() => parseAiPackage('{"format":"KH_STORY_PACKAGE_V1", broken}'), error => {
    assert.match(error.message, /JSON غير صحيحة/);
    assert.equal(error.aiRaw, '{"format":"KH_STORY_PACKAGE_V1", broken}');
    return true;
  }, 'broken JSON must return a repairable error and preserve the raw AI response');

  const bundle = loadBundle(async (url, options) => {
    if (String(url).startsWith('../stories/index.json')) {
      return { ok: true, status: 200, json: async () => [{ id: '001' }, { id: '003' }] };
    }
    heads.push(String(url));
    if (String(url).includes('/history/002/index.html')) return { ok: true, status: 200 };
    return { ok: false, status: 404 };
  });
  assert.equal(await bundle.nextId(), '004', 'must skip indexed IDs and an unindexed page, then choose the first available gap');
  assert.ok(heads.some(x => x.includes('/history/002/index.html')), 'must check page folders, not trust index alone');

  const brokenNetwork = loadBundle(async (url, options) => {
    if (String(url).startsWith('../stories/index.json')) return { ok: true, status: 200, json: async () => [] };
    throw new Error('mock network failure');
  });
  await assert.rejects(() => brokenNetwork.nextId(), /أوقفنا التجهيز لتجنب تكرار صفحة موجودة/);

  const badIndex = loadBundle(async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => badIndex.nextId(), /لم نخصص رقمًا لتجنب التكرار/);

  const html = bundle.renderPreviewHtml({
    section_key: 'history', title: 'اختبار معاينة القارئ', subtitle: 'نبذة اختبارية',
    figure_name: 'شخصية تجريبية', narrator_name: 'راوي تجريبي',
    body: 'هذا نص اختباري طويل بما يكفي لعرض شكل الحكاية في القالب المنشور.',
    karma_text: 'كارما تسأل سؤالًا تجريبيًا.', sources: 'مصدر أول https://example.org/a\nمصدر ثان https://example.org/b',
    translations: { en: { title: 'Preview test' }, fr: {}, it: {}, de: {} },
    question_bank_json: { questions: [] }
  });
  assert.match(html, /اختبار معاينة القارئ/);
  assert.match(html, /stories\/history\/005\/theme\.css/, 'preview should load the real reader theme');
  assert.match(html, /data:image\/svg\+xml;charset=utf-8,/, 'cover artwork must be present in preview without a missing file');
  assert.match(html, /معاينة خاصة غير منشورة/);
  assert.doesNotMatch(html, /assets\/shared\/reactions\.js/, 'preview must not enable live reactions');
  assert.doesNotMatch(html, /assets\/shared\/story-quiz\.js/, 'preview must not load a quiz that could write live data');
  console.log('Passed 6 template/ID/AI JSON checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
