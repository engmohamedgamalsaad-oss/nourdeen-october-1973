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
  assert.equal(typeof bundle.nextId, 'function', 'public story bundle must expose nextId for the builder and tests');
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
    images: [
      { url: 'https://images.example.org/portrait.jpg', alt: 'Portrait', caption: 'Portrait', kind: 'archival', source_name: 'Example Archive', source_url: 'https://example.org/source', rights: 'CC BY', i18n: { en: { alt: 'Portrait', caption: 'Portrait', source_name: 'Example Archive EN', rights: 'Public Domain' }, fr: { alt: 'Portrait', caption: 'Portrait', source_name: 'Archive Exemple', rights: 'Domaine public' }, it: { alt: 'Portrait', caption: 'Portrait', source_name: 'Archivio di esempio', rights: 'Pubblico dominio' }, de: { alt: 'Portrait', caption: 'Portrait', source_name: 'Beispielarchiv', rights: 'Gemeinfrei' } } },
      { url: 'https://images.example.org/related.jpg', alt: 'Related image', caption: 'Related image' }
    ],
    question_bank_json: { questions: [] }
  });
  assert.match(html, /اختبار معاينة القارئ/);
  assert.match(html, /<body class="story-design-[^"]+" data-story-slug="preview" data-section-accent="/, 'generated story body must include data-story-slug for shared language support');
  assert.match(html, /<header>[\s\S]*?<div class="language-switch" data-lang-switch role="group" aria-label="Language"><\/div><\/header>/, 'generated story must include the shared language switch in its static HTML header');
  assert.equal((html.match(/data-lang-switch/g) || []).length, 1, 'generated preview must contain exactly one language switch');
  assert.ok(html.indexOf('assets/shared/i18n.js') < html.indexOf('window.StoryI18N'), 'shared i18n script must load before the generated inline story translation dictionary');
  assert.match(html, /stories\/history\/preview\//);
  assert.match(html, /class="hero-art"/, 'preview should show the lead story image in the hero');
  assert.match(html, /story-visual-gallery/, 'preview should render a visible image gallery');
  assert.match(html, /Preview design profiles/, 'generated previews should carry approved visual design profiles');
  assert.match(html, /\.story-design-portrait-biography\{background:radial-gradient/, 'portrait biographies should use the approved literary design');
  assert.match(html, /\.story-design-arts-culture\{background:radial-gradient/, 'arts stories should use a dedicated visual identity');
  assert.match(html, /loading="eager"/, 'preview images should load immediately inside the sandboxed frame');
  assert.match(html, /https:\/\/images\.example\.org\/portrait\.jpg/, 'the lead image URL should be present in preview HTML');
  assert.match(html, /Example Archive EN/, 'image source names should be translated in the generated dictionary');
  assert.match(html, /Public Domain/, 'image usage rights should be translated in the generated dictionary');
  assert.match(html, /بيانات الحقوق غير مكتملة/, 'images with missing rights should remain visible with a clear warning');
  assert.doesNotMatch(html, /src="cover-popup\.svg"/, 'preview must not depend on a cover asset that is absent from the srcdoc');
  assert.match(html, /معاينة خاصة غير منشورة/);
  assert.match(html, /Shared story design contract/, 'generated pages must include the shared design contract');
  assert.match(html, /html\[data-theme="light"\] \.story/, 'generated pages must include light-theme story card rules');
  assert.match(html, /prefers-reduced-motion:reduce/, 'motion must respect reduced-motion preferences');
  assert.match(html, /#intro \.modal-card/, 'generated pages must include responsive intro modal rules');
  assert.doesNotMatch(html, /assets\/shared\/reactions\.js/);
  assert.doesNotMatch(html, /assets\/shared\/story-quiz\.js/);
  console.log('Passed collision-safe ID allocation and generated preview checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
