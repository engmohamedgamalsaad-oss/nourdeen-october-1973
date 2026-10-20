/* Collision-safe story IDs and generated reader preview. No real network or Supabase writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
function loadBundle(fetchMock) {
  const context = { window: {}, fetch: fetchMock };
  vm.runInNewContext(source, context, { filename: 'story-template-bundle.js' });
  return context.window.KHStoryBundle;
}
async function main() {
  const heads = [];
  const bundle = loadBundle(async url => {
    if (String(url).startsWith('../stories/index.json')) {
      return { ok: true, status: 200, json: async () => [{ id: '001' }, { id: '003' }] };
    }
    heads.push(String(url));
    if (String(url).includes('/stories/002/index.html')) return { ok: true, status: 200 };
    return { ok: false, status: 404 };
  });
  assert.equal(await bundle.nextId(), '004', 'must skip indexed IDs and an unindexed existing page');
  assert.ok(heads.some(url => url.includes('/stories/002/index.html')), 'must check legacy story folders, not trust index alone');

  const sectionHeads = [];
  const sectionCollision = loadBundle(async url => {
    if (String(url).startsWith('../stories/index.json')) {
      return { ok: true, status: 200, json: async () => [{ id: '001' }, { id: '003' }] };
    }
    sectionHeads.push(String(url));
    if (String(url).includes('/stories/history/002/index.html')) return { ok: true, status: 200 };
    return { ok: false, status: 404 };
  });
  assert.equal(await sectionCollision.nextId(), '004', 'must skip an existing category page');
  assert.ok(sectionHeads.some(url => url.includes('/stories/history/002/index.html')), 'must check category folders too');

  const brokenNetwork = loadBundle(async url => {
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
    karma_text: 'كارما تسأل سؤالًا تجريبيًا.',
    sources: 'مصدر أول https://example.org/a\nمصدر ثان https://example.org/b',
    translations: { en: { title: 'Preview test' }, fr: {}, it: {}, de: {} },
    question_bank_json: { questions: [] }
  });
  assert.match(html, /اختبار معاينة القارئ/);
  assert.match(html, /stories\/history\/005\/theme\.css/);
  assert.match(html, /data:image\/svg\+xml;charset=utf-8,/);
  assert.match(html, /معاينة خاصة غير منشورة/);
  assert.doesNotMatch(html, /assets\/shared\/reactions\.js/);
  assert.doesNotMatch(html, /assets\/shared\/story-quiz\.js/);
  console.log('Passed collision-safe ID allocation and generated preview checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
