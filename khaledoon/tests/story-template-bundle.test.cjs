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
    body: 'هل تعلم؟ معلومة تجريبية أولى.\n\nهل تعلم؟ معلومة تجريبية ثانية.\n\nهل تعلم؟ معلومة تجريبية ثالثة.',
    karma_text: 'كارما تسأل سؤالًا تجريبيًا.',
    sources: 'مصدر أول https://example.org/a\nمصدر ثان https://example.org/b',
    cover: { path: 'stories/history/preview/cover.jpg', alt: 'غلاف تجريبي', caption: 'تعليق الغلاف التجريبي', kind: 'illustration', source_name: 'مصدر الغلاف', source_url: 'https://example.org/cover-source', rights: 'رسم توضيحي', i18n: { en: { alt: 'Preview cover', caption: 'Preview cover caption', source_name: 'Preview cover source', rights: 'Illustration' }, fr: { alt: 'Couverture test', caption: 'Légende de couverture', source_name: 'Source de couverture test', rights: 'Illustration' }, it: { alt: 'Copertina di prova', caption: 'Didascalia di copertina', source_name: 'Fonte della copertina di prova', rights: 'Illustrazione' }, de: { alt: 'Testtitelbild', caption: 'Bildunterschrift des Titelbilds', source_name: 'Quelle des Testtitelbilds', rights: 'Illustration' } } },
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
  const coverUrl = 'https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/stories/history/preview/cover.jpg';
  assert.equal(html.split(coverUrl).length - 1, 3, 'the same cover path must feed og:image, the hero, and the intro modal');
  assert.match(html, /Preview cover/, 'cover alt translation must be included in the generated language dictionary');
  assert.match(html, /Preview cover caption/, 'cover caption translation must be included in the generated language dictionary');
  assert.match(html, /Preview cover source/, 'cover source-name translation must be included in the generated language dictionary');
  assert.match(html, /Illustration/, 'cover rights translation must be included in the generated language dictionary');
  assert.match(html, /Source link/, 'the gallery source-link label must be translated in English');
  assert.match(html, /Lien vers la source/, 'the gallery source-link label must be translated in French');
  assert.match(html, /Link alla fonte/, 'the gallery source-link label must be translated in Italian');
  assert.match(html, /Quellenlink/, 'the gallery source-link label must be translated in German');
  assert.match(html, /Rights information is incomplete/, 'fallback rights warning must have a localized English form');
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
  const validDraft = function () {
    const langs = ['en','fr','it','de'];
    const translations = Object.fromEntries(langs.map(function (lang) {
      return [lang, {
        student_name:'Student '+lang, grade:'Grade '+lang, title:'Story '+lang,
        subtitle:'Subtitle '+lang, karma_text:'Karma voice '+lang,
        body:[({en:'Did you know?',fr:'Le saviez-vous ?',it:'Lo sapevi?',de:'Wusstest du?'})[lang]+' Fact one with a verified detail.',({en:'Did you know?',fr:'Le saviez-vous ?',it:'Lo sapevi?',de:'Wusstest du?'})[lang]+' Fact two with a second verified detail.',({en:'Did you know?',fr:'Le saviez-vous ?',it:'Lo sapevi?',de:'Wusstest du?'})[lang]+' Fact three with a third verified detail.'].join('\n\n'),
        history_note:'History note '+lang, images_note:'Image rights note '+lang
      }];
    }));
    const imageI18n = function (label) {
      return Object.fromEntries(langs.map(function (lang) {
        return [lang,{alt:label+' alt '+lang,caption:label+' caption '+lang,source_name:'Source '+lang,rights:'License '+lang}];
      }));
    };
    return {
      section_key:'history', title:'عنوان اختبار', subtitle:'نبذة اختبارية',
      figure_name:'شخصية اختبار', karma_text:'كارما تسأل سؤالًا تجريبيًا.',
      body:'هل تعلم؟ هذه حقيقة موثقة أولى داخل بطاقة معرفة.\n\nهل تعلم؟ هذه حقيقة موثقة ثانية داخل بطاقة معرفة.\n\nهل تعلم؟ هذه حقيقة موثقة ثالثة داخل بطاقة معرفة.',
      history_note:'معلومة تاريخية موثقة', images_note:'ملاحظات الصور وحقوقها',
      sources:'Source A https://example.org/source-a\nSource B https://example.net/source-b',
      cover:{url:'https://images.example.org/cover.jpg',alt:'غلاف اختبار',caption:'تعليق الغلاف',kind:'illustration',source_name:'مصدر الغلاف',source_url:'https://example.org/cover-source',rights:'ترخيص موضح',
        i18n:Object.fromEntries(langs.map(function(lang){return [lang,{alt:'Cover alt '+lang,caption:'Cover caption '+lang,source_name:'Cover source '+lang,rights:'Illustration '+lang}]}))},
      translations:translations,
      images:[
        {url:'https://images.example.org/a.jpg',alt:'وصف الصورة أ',caption:'الصورة أ',kind:'illustration',source_name:'المصدر أ',source_url:'https://example.org/a',rights:'ترخيص موضح',i18n:imageI18n('Image A')},
        {url:'https://images.example.org/b.jpg',alt:'وصف الصورة ب',caption:'الصورة ب',kind:'diagram',source_name:'المصدر ب',source_url:'https://example.org/b',rights:'ترخيص موضح',i18n:imageI18n('Image B')}
      ],
      question_bank_json:{questions:Array.from({length:5},function(_,i){return {
        q:'السؤال '+i,o:['أ','ب'],a:0,e:'تفسير الإجابة',
        i18n:Object.fromEntries(langs.map(function(lang){return [lang,{q:'Question '+i+' '+lang,o:['Option A','Option B'],e:'Explanation '+lang}]}))
      }})}
    };
  };
  const goodDraft = validDraft();
  assert.equal(bundle.validate(goodDraft).ok, true, 'fully localized bundle data should pass');
  const tooManyImages = JSON.parse(JSON.stringify(goodDraft));
  tooManyImages.images = tooManyImages.images.concat(tooManyImages.images, tooManyImages.images, tooManyImages.images);
  assert.ok(bundle.validate(tooManyImages).missing.some(function (m) { return m.includes('لا تتجاوز خمس صور'); }), 'template validator must reject more than five gallery images');
  const invalidExtraImage = JSON.parse(JSON.stringify(goodDraft));
  invalidExtraImage.images.push(Object.assign({}, invalidExtraImage.images[0], {url:'javascript:alert(1)'}));
  assert.ok(bundle.validate(invalidExtraImage).missing.some(function (m) { return /الصورة 3: url/.test(m); }), 'every gallery image must have a safe URL, even if two other images are valid');
  const ambiguousCover = JSON.parse(JSON.stringify(goodDraft));
  ambiguousCover.cover.path = 'stories/history/preview/cover.jpg';
  assert.ok(bundle.validate(ambiguousCover).missing.some(function (m) { return m.includes('مصدرًا واحدًا فقط'); }), 'template validator must reject simultaneous cover url and path');
  const missingFactCards = JSON.parse(JSON.stringify(goodDraft));
  missingFactCards.body = 'A narrator paragraph without the required knowledge cards.';
  assert.ok(bundle.validate(missingFactCards).missing.some(function (m) { return m.includes('ثلاث فقرات «هل تعلم؟»'); }), 'the template validator must reject stories without three fact-card paragraphs');
  const previewHtml = bundle.renderPreviewHtml(goodDraft);
  assert.equal((previewHtml.match(/class="story-fact-card"/g) || []).length, 3, 'the generated story should render three distinct knowledge cards');
  const badCover = JSON.parse(JSON.stringify(goodDraft));
  badCover.cover.i18n.de.alt = 'غلاف لم تتم ترجمته';
  assert.ok(bundle.validate(badCover).missing.some(function (m) { return m.includes('بيانات الغلاف المترجمة'); }), 'Arabic cover alt must be rejected');
  const badCoverCredit = JSON.parse(JSON.stringify(goodDraft));
  badCoverCredit.cover.i18n.fr.rights = 'حقوق الغلاف بالعربية';
  assert.ok(bundle.validate(badCoverCredit).missing.some(function (m) { return m.includes('بيانات الغلاف المترجمة'); }), 'Arabic cover rights must be rejected');
  const badBody = JSON.parse(JSON.stringify(goodDraft));
  badBody.translations.fr.body += ' نص عربي متروك';
  assert.ok(bundle.validate(badBody).missing.some(function (m) { return m.includes('حقل body'); }), 'Arabic in a translated story body must be rejected');
  const badQuiz = JSON.parse(JSON.stringify(goodDraft));
  badQuiz.question_bank_json.questions[0].i18n.it.q = 'سؤال لم تتم ترجمته';
  assert.ok(bundle.validate(badQuiz).missing.some(function (m) { return m.includes('ترجمة IT'); }), 'Arabic in translated quiz text must be rejected');
  console.log('Passed collision-safe ID allocation, generated preview, and strict translation validation checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
