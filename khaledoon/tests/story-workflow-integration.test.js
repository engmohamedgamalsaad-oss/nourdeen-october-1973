/* Contract/integration checks for the story workflow. Run:
   node khaledoon/tests/story-workflow-integration.test.js
   No network, browser, or real Supabase writes are used. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var W = require('../assets/story-workflow.js');
var admin = fs.readFileSync('khaledoon/admin.html', 'utf8');
var builder = fs.readFileSync('khaledoon/story-builder.html', 'utf8');
var preview = fs.readFileSync('khaledoon/preview.html', 'utf8');
var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
var favicon = fs.readFileSync('khaledoon/assets/admin-favicon.svg', 'utf8');
var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok - ' + name); }
  catch (e) { console.error('FAIL - ' + name + '\n' + e.stack); process.exitCode = 1; }
}
function mockPatch(record, patch) {
  /* In-memory replacement for a Supabase PATCH; never calls fetch or a server. */
  return Object.assign({}, record, patch);
}
test('admin imports the workflow module and derives status counters', function () {
  assert.ok(admin.includes('src="assets/story-workflow.js?v=20261021-map-auto-1"'));
  assert.ok(admin.includes('window.KHWorkflow.counters(visibleAdminRecords,sitePageItems)'));
  assert.ok(admin.includes("itemState(i)===fStatus"));
  assert.ok(!admin.includes('handleStoryPreviewDecision'));
});
test('published admin records and published site pages are separate filters', function () {
  assert.ok(admin.includes("k==='published'?'سجلات الأدمن بحالة «منشورة»'"));
  assert.ok(admin.includes("chip(t,'صفحات الحكايات المنشورة فعليًا بالموقع ('+sitePageItems.length+')'"));
  assert.ok(admin.includes("fStatus==='published'?i._t!=='site'&&itemState(i)==='published'"));
  assert.ok(admin.includes("return i._t!=='site'&&itemState(i)===k"));
});
test('copied story prompts are compact, mode-specific, and include validated image fields', function () {
  assert.ok(admin.includes("function buildNewStoryPrompt(providerKey,mode)"));
  assert.ok(admin.includes("buildNewStoryPrompt(provider,'package')"));
  assert.ok(admin.includes("buildNewStoryPrompt(gateProvider.value)"));
  var fn = admin.slice(admin.indexOf('function buildNewStoryPrompt'), admin.indexOf('function renderNewStoryGate'));
  assert.ok(fn.includes("if(mode==='package')"));
  assert.ok(fn.includes('اللغات الخمس كاملة'));
  assert.ok(fn.includes('لا تدمج إلى الفرع المنشور'));
  assert.ok(!fn.includes('managedPromptSections(selectedProvider)'), 'copied prompt must not concatenate old long prompt libraries');
  assert.ok(admin.includes('STORY_DATA_QUALITY_GATE'));
  assert.ok(admin.includes('map_location:pkg.map_location===null?null:pkg.map_location'), 'verified map metadata must survive AI package import');
  assert.ok(admin.includes('images:it.images||(it.story_meta&&it.story_meta.images)||[]'));
  assert.ok(admin.includes('source_name,source_url,rights,i18n'));
});
test('unified v3 prompt is shared and legacy AI output is not copied into fresh prompts', function () {
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
  assert.ok(admin.includes('STORY_DATA_QUALITY_GATE'));
  assert.ok(!admin.includes("L.push(String(copyMeta.ai_package_raw))"), 'old AI output must not be pasted into a fresh prompt');
  assert.ok(admin.includes("assets/khaledoon-admin-texts.js?v=20261022-3"));
  var shared = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  assert.ok(shared.includes('الإصدار: 2026-10-22-v3'));
  assert.ok(shared.includes('استبدل أي نسخة قديمة به بالكامل'));
  assert.ok(shared.includes('لا تلصق البرومبت القديم فوقه'));
  assert.ok(shared.includes('ar/en/fr/it/de'));
  assert.ok(shared.includes('cover-popup'));
  assert.ok(shared.includes('prefers-reduced-motion'));
  assert.ok(shared.includes('source_name وsource_url وrights'));
  assert.ok(shared.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
  ['chatgpt','gemini','claude','deepseek'].forEach(function (provider) {
    assert.ok(shared.includes('"'+provider+'"'), 'missing provider instruction: '+provider);
  });
  var promptAdmin = fs.readFileSync('khaledoon/prompts-admin.html', 'utf8');
  assert.ok(promptAdmin.includes('<option value="gemini">Gemini</option>'));
});
test('story publishing safely links verified map locations without overwriting existing map entries', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  assert.ok(publisher.includes('path === "stories/index.json" || path === "stories/places.json"'));
  assert.ok(publisher.includes("file.path !== 'stories/places.json'"));
  assert.ok(publisher.includes('currentPlaces[storyId] = { ...place, lat, lng }'));
  assert.ok(publisher.includes("['ar','en','fr','it','de'].some"));
  assert.ok(publisher.includes('map_marker_added: mapMarkerAdded'));
  var mapBundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
  assert.ok(mapBundle.includes('if(mapLocation===null){mapData[id]=null;}'), 'explicit no-location must reach the server so stale markers are removed');
  assert.ok(admin.includes('map_linked:result.map_linked===true'));
  assert.ok(admin.includes("result.map_message?String(result.map_message)+' ':'"));
  assert.ok(admin.includes('story-template-bundle.js?v=20261021-map-auto-2'));
  var shared = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  assert.ok(shared.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
  assert.ok(shared.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
});
test('approved stories can reopen reader preview and AI image data is preserved', function () {
  assert.ok(admin.includes('فتح معاينة القارئ'));
  assert.ok(admin.includes("images:Array.isArray(pkg.images)?pkg.images:[]"));
  assert.ok(admin.includes("visual_design:String(pkg.visual_design||'')"));
  assert.ok(admin.includes("preview_source_url:'',translations:translations"));
  assert.ok(admin.includes('static_story_path:null,bundle_downloaded:false,prepared_page_url:\'\''));
  assert.ok(preview.includes("params.get('table')==='submitted_stories'?'submitted_stories':'khaledoon_submissions'"));
  assert.ok(preview.includes("record_type:legacy?'legacy':'modern'"));
  assert.ok(preview.includes('if(!Array.isArray(d.images))d.images='));
  assert.ok(preview.includes('d.visual_design=firstText'));
});
test('review preview displays submitted images and portrait design styling', function () {
  assert.ok(preview.includes('function renderReviewImages(d)'));
  assert.ok(preview.includes('renderReviewImages(d);'));
  assert.ok(preview.includes('pub-image-grid'));
  assert.ok(preview.includes('تعذر تحميل ملف الصورة من الرابط'));
  assert.ok(bundle.includes('story-design-portrait-biography .hero h1'));
  assert.ok(bundle.includes('story-design-portrait-biography .story-visual-gallery'));
  assert.ok(bundle.includes('prefers-reduced-motion'));
});
test('admin uses its actual crimson book favicon asset', function () {
  assert.ok(admin.includes('type="image/svg+xml" href="/nourdeen-october-1973/khaledoon/assets/admin-favicon.svg"'));
  assert.ok(favicon.includes('viewBox="0 0 64 64"'));
  assert.ok(favicon.includes('fill="#8f1728"'));
  assert.ok(favicon.includes('<path'));
});
test('admin links submissions to static pages by explicit identifier only', function () {
  assert.ok(admin.includes('window.KHWorkflow.linkedSite(it,vStories)'));
  assert.ok(!admin.includes('norm(s.title)===t'));
  assert.ok(admin.includes('items=visibleRecords.concat(sitePageItems)'));
  assert.ok(admin.includes('window.KHWorkflow.linkedSite(record,sitePageItems)'));
});
test('published stories cannot be deleted and deleting drafts never hides static pages', function () {
  assert.ok(admin.includes("if(it._t!=='site'&&it.status!=='published')"));
  assert.ok(admin.includes("if(it&&it.status==='published'){say('err','ممنوع حذف سجل حكاية منشورة من هذه القائمة؛ استخدم «إخفاء» فقط.');return}"));
  var removeItemBlock = admin.slice(admin.indexOf('async function removeItem'), admin.indexOf('async function remove(it,btn)'));
  var removeBlock = admin.slice(admin.indexOf('async function remove(it,btn)'), admin.indexOf('function copyKey'));
  assert.ok(!removeItemBlock.includes('await hideStaticStoryBeforeDelete(it)'));
  assert.ok(!removeBlock.includes('await hideStaticStoryBeforeDelete(it)'));
  assert.ok(!admin.includes('hideStaticStoryBeforeDelete'));
  assert.ok(admin.includes("if(it.status!=='published'){delBtn.type='button';bar.appendChild(delBtn)}else{delBtn.hidden=true;delBtn.disabled=true}"));
  assert.ok(admin.includes("if(it._t!=='site'&&it.status!=='published')"));
  assert.ok(admin.includes('var visibleRecords=adminRecords.filter(function(record){return !linkedPublished[String(record.id)]})'));
  assert.ok(admin.includes("function storyFor(it){if(it&&it._t==='site')return vStories.find(function(s){return String(s.id)===String(it.id)})||it;return window.KHWorkflow.linkedSite(it,vStories)}"));
});
test('admin validates every translated field and every quiz translation before AI import', function () {
  assert.ok(admin.includes('window.KHWorkflow.validateStoryPackage(pkg)'));
  assert.ok(admin.includes("if(!Object.prototype.hasOwnProperty.call(SEC,String(pkg.section_key||'')))"));
  assert.ok(admin.includes('window.KHAIJsonRepair.parse(sourceRaw)'));
  assert.ok(admin.includes('!pkg.format&&pkg.section_key&&pkg.translations&&pkg.question_bank&&Array.isArray(pkg.images)'), 'recognizable complete packages without the format marker should be normalized safely');
  assert.ok(admin.includes('أول خاصية في كائن JSON الجذر يجب أن تكون حرفيًا'));
  assert.ok(admin.includes('يُسمح بسياج الكود الخارجي وحده'));
  assert.ok(admin.includes('من صفر إلى خمس صور موثقة'));
  assert.ok(admin.includes('لا تجعل الصور غير المتاحة سببًا لاختلاق معلومات أو روابط'));
  assert.ok(admin.includes('تعذر قراءة JSON حتى بعد محاولة إصلاح التنسيق تلقائيًا'));
  assert.ok(admin.includes('section_key واحدة من october, science, learning, fame, history, curriculum, islamic, readers'));
});
test('manual builder merges metadata and protects original body', function () {
  assert.ok(builder.includes('Object.assign({},currentMeta||{})'));
  assert.ok(builder.includes('(currentRecord&&currentRecord.original_body)||d.original_body'));
  assert.ok(builder.includes('window.KHWorkflow.markPreviewSent(meta,new Date())'));
  assert.ok(!builder.includes('kh-story-preview-decision'));
});
test('preview requires rejection reason and calls workflow transitions', function () {
  assert.ok(preview.includes('id="rejectionReason"'));
  assert.ok(preview.includes('window.KHWorkflow.markPreviewRejected(meta,rejectionReason,new Date())'));
  assert.ok(preview.includes('window.KHWorkflow.markApproved(meta'));
  assert.ok(preview.includes('تم اعتماد المعاينة وحفظ القرار والتحقق منه.'));
  assert.ok(preview.includes('رفض المعاينة'));
});
test('reader-template preview keeps translations and disables reaction writes', function () {
  assert.ok(bundle.includes('renderPreviewHtml:renderPreviewHtml'));
  assert.ok(bundle.includes("translatedRows(d,'preview')"));
  assert.ok(bundle.includes('reactions.js'));
  assert.ok(bundle.includes('معاينة خاصة غير منشورة'));
});
test('story pages support distinct visual designs and source-attributed image galleries', function () {
  assert.doesNotThrow(function () { new Function(bundle); }, 'story template bundle must parse as JavaScript');
  assert.ok(bundle.includes('visualDesignKey(d,section)'));
  assert.ok(bundle.includes("story-design-'+design+'"));
  assert.ok(bundle.includes('story-visual-gallery'));
  assert.ok(bundle.includes('source_url'));
  assert.ok(bundle.includes('story-image-card'));
  assert.ok(bundle.includes('صور مرتبطة بالحكاية'));
  assert.ok(bundle.includes('صورة أرشيفية'));
});
test('rendered story preview applies all nine designs and includes attributed images', function () {
  var vm = require('vm');
  var sandbox = { window: {}, console: console, TextEncoder: TextEncoder, Blob: Blob, URL: URL };
  vm.runInNewContext(bundle, sandbox, { filename: 'story-template-bundle.js' });
  var api = sandbox.window.KHStoryBundle;
  assert.ok(api && typeof api.renderPreviewHtml === 'function');
  var designs = ['timeline','science-lab','ancient-civilization','military-history','journey-map','portrait-biography','women-leadership','arts-culture','discovery'];
  designs.forEach(function (design) {
    var html = api.renderPreviewHtml({
      section_key: 'history', visual_design: design, title: 'حكاية اختبار', subtitle: 'معاينة التصميم',
      figure_name: 'شخصية اختبار', narrator_name: 'كارما', narrator_grade: 'الصف السادس',
      karma_text: 'لماذا تختلف الحكايات؟', body: 'هذا نص تجريبي طويل بما يكفي لعرض معاينة التصميم المخصص لكل حكاية.',
      sources: 'المصدر الأول https://example.org/source-a\nالمصدر الثاني https://example.org/source-b',
      images: [
        {url:'https://images.example/a.jpg',alt:'وصف الصورة الأولى',caption:'الصورة الأولى',kind:'illustration',source_name:'المصدر أ',source_url:'https://example.org/image-a',rights:'ترخيص توضيحي'},
        {url:'https://images.example/b.jpg',alt:'وصف الصورة الثانية',caption:'الصورة الثانية',kind:'diagram',source_name:'المصدر ب',source_url:'https://example.org/image-b',rights:'ترخيص توضيحي'}
      ],
      question_bank_json: {questions: []}
    });
    assert.ok(html.includes('class="story-design-' + design + '"'), 'missing design class: ' + design);
    assert.ok(html.includes('story-visual-gallery'), 'missing image gallery: ' + design);
    assert.ok(html.includes('https://images.example/a.jpg'), 'missing first image: ' + design);
    assert.ok(html.includes('https://example.org/image-a'), 'missing image source link: ' + design);
    assert.ok(html.includes('ترخيص توضيحي'), 'missing image rights: ' + design);
    assert.ok(html.includes('معاينة خاصة غير منشورة'), 'preview safety banner missing: ' + design);
  });
});
test('AI story package validation requires a design profile and at least two documented images', function () {
  assert.ok(W.validateStoryPackage({
    section_key:'science', figure_name:'مثال', title:'عنوان', subtitle:'نبذة',
    narrator_name:'راوي', narrator_grade:'الصف السادس', karma_text:'كارما',
    history_note:'سياق', sources:'المصدر الأول https://example.org/source-a\nالمصدر الثاني https://example.net/source-b', images_note:'حقوق الصور', original_body:'هذا هو النص الأصلي الكامل الذي وصل من صاحب الحكاية دون أي تعديل أو حذف.',
    body:'هذا نص الراوي الذي يتجاوز خمسين حرفًا لتلبية شرط التحقق في الاختبار.',
    visual_design:'science-lab', map_location:null,
    images:[
      {url:'https://images.example/a.jpg',alt:'صورة أ',caption:'أ',kind:'illustration',source_name:'المصدر أ',source_url:'https://source.example/a',rights:'ترخيص موضح',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Image A',caption:'Caption A'}]}))},
      {url:'https://images.example/b.jpg',alt:'صورة ب',caption:'ب',kind:'diagram',source_name:'المصدر ب',source_url:'https://source.example/b',rights:'ترخيص موضح',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Image B',caption:'Caption B'}]}))}
    ],
    translations:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{student_name:'Name',grade:'Grade',title:'Title',subtitle:'Subtitle',karma_text:'Karma',body:'Narrator',history_note:'History',images_note:'Images'}]})),
    question_bank:{questions:Array.from({length:5},function(_,i){return {q:'Q'+i,o:['A','B'],a:0,e:'Explain',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{q:'Q'+i,o:['A','B'],e:'Explain'}]}))}})}
  }).ok);
  assert.ok(bundle.includes('أضف صورتين على الأقل'));
});
test('Gemini is available in every admin story prompt flow with full story requirements', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.equal(admin.split("['gemini','Gemini']").length-1,4);
  assert.ok(admin.includes("gemini:mode==='package'?'أخرج كائن JSON واحدًا صالحًا للاستيراد فقط"));
  assert.ok(texts.includes('var STORY_PROVIDER_PROMPTS ='));
  assert.ok(texts.includes('"gemini":"## تعليمات تشغيل خاصة بـ Gemini'));
  ['original_body','كارما طفلة فضولية','الألمانية','خمسة أسئلة','source_url','visual_design','WhatsApp وFacebook','معاينة خاصة','موافقة صاحب المشروع الصريحة','لا تدّعِ بحثًا أو تنزيلًا أو اختبارًا لم يحدث فعلًا'].forEach(function(term){assert.ok(texts.includes(term),'Gemini prompt missing '+term)});
});
test('admin project instructions and AI provider prompts require custom layouts and image rights', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.ok(texts.includes('## التصميم المتخصص لكل حكاية والصور الفعلية'));
  assert.ok(texts.includes('visual_design'));
  assert.ok(texts.includes('source_url'));
  assert.ok(texts.includes('لا تستخدم قالبًا بصريًا واحدًا متكررًا لكل الحكايات.'));
});
['manual','AI'].forEach(function (mode) {
  test(mode + ' path: save, reject, resend, approve, failed verification, publish', function () {
    var original = 'النص الأصلي الثابت الذي لا يجوز تغييره';
    var record = { id: mode, status: 'pending', original_body: original,
      body: 'نسخة تحريرية', consent: true, admin_notes: 'ملاحظة محفوظة',
      story_meta: { source_mode: mode, manual_builder: mode === 'manual',
        preview_review: { decision: 'sent' } } };
    var totalBefore = 1;
    record.story_meta = W.markPreviewRejected(record.story_meta, 'أضف مصدرًا موثوقًا', new Date('2026-10-20T10:00:00Z'));
    record = mockPatch(record, { status: 'pending', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'preview_rejected');
    assert.equal(record.story_meta.preview_review.reason, 'أضف مصدرًا موثوقًا');
    assert.equal(record.original_body, original);
    assert.equal(record.consent, true);
    assert.equal(record.admin_notes, 'ملاحظة محفوظة');
    record.story_meta = W.markPreviewSent(record.story_meta, new Date('2026-10-20T10:01:00Z'));
    record = mockPatch(record, { story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'preview_sent');
    record.story_meta = W.markApproved(record.story_meta, { static_story_id: '099', static_story_path: 'stories/history/099/' }, new Date('2026-10-20T10:02:00Z'));
    record = mockPatch(record, { status: 'review', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'awaiting_publish');
    record.story_meta = W.markPublishCheckFailed(record.story_meta, 'HTTP 404', new Date('2026-10-20T10:03:00Z'));
    record = mockPatch(record, { story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'awaiting_publish');
    assert.equal(record.story_meta.preview_review.publish_error.reason, 'HTTP 404');
    assert.equal(W.canMarkPublished(record, { ok: false }).ok, false);
    assert.equal(W.canMarkPublished(record, { ok: true }).ok, true);
    record.story_meta = W.markPublished(record.story_meta, new Date('2026-10-20T10:04:00Z'));
    record = mockPatch(record, { status: 'published', story_meta: record.story_meta });
    assert.equal(W.stateOf(record).state, 'published');
    assert.equal(record.original_body, original);
    assert.equal(W.group([record]).published.length, 1);
    assert.equal(W.ORDER.reduce(function (n, s) { return n + W.group([record])[s].length; }, 0), totalBefore);
  });
});
test('AI import failures preserve pasted text and preview records the provider', function () {
  assert.ok(admin.includes('window.KHAIJsonRepair.parse(sourceRaw)'));
  assert.ok(admin.includes('تعذر قراءة JSON حتى بعد محاولة إصلاح التنسيق تلقائيًا'));
  assert.ok(admin.includes('var pastedRaw=aiPaste.value,sourceRaw=pastedRaw.trim(),pkg,raw=pastedRaw'));
  assert.ok(admin.includes('aiJsonWasRepaired'));
  assert.ok(admin.includes('assets/ai-json-repair.js?v=20261021-3'));
  assert.ok(admin.includes("ai_imported_provider_label"));
  assert.ok(admin.includes("var hw=el('span','hidebtn-wrap')"));
  assert.ok(admin.includes('hw.title=reason'));
  assert.ok(admin.includes("if(it.status==='published'){nextMeta.pending_draft=Object.assign({},payload)"));
  assert.ok(admin.includes("if(lastReview.decision==='rejected'&&lastReview.reason)"));
  assert.ok(admin.includes("aiPreviewPopup.location.href='preview.html?story=1&submission='"));
  assert.ok(admin.includes("['gemini','Gemini']"));
  assert.ok(preview.includes('id="aiVersionBadge"'));
  assert.ok(preview.includes("aiMeta.ai_imported_provider_label"));
  assert.ok(preview.includes('هذه معاينة غير منشورة'));
});
test('unified v3 prompt requires safe automatic map linkage for verified locations', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  assert.ok(texts.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
  assert.ok(texts.includes('لا تخترع إحداثيات أو روابط، ولا تغيّر سجلات قديمة أو بيانات التفاعلات.'));
  assert.ok(publisher.includes("path === \"stories/index.json\" || path === \"stories/places.json\""));
  assert.ok(publisher.includes('currentPlaces[storyId] = { ...place, lat, lng }'));
  assert.ok(publisher.includes('delete currentPlaces[storyId]'));
});

test('verified map_location is carried from AI import into bundle and merged safely on publish', function () {
  var workflow = fs.readFileSync('khaledoon/assets/story-workflow.js','utf8');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js','utf8');
  var edge = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  assert.ok(workflow.includes("hasOwnProperty.call(pkg, 'map_location')"));
  assert.ok(workflow.includes('اسم المكان في map_location مطلوب باللغات الخمس'));
  assert.ok(admin.includes('map_location:pkg.map_location===null?null:pkg.map_location'));
  assert.ok(admin.includes('draft.map_location=meta.map_location'));
  assert.ok(bundle.includes("files.push({path:'stories/places.json'"));
  assert.ok(bundle.includes('hasMapMeta'));
  assert.ok(bundle.includes('تعذر قراءة stories/places.json'));
  assert.ok(edge.includes('stories/places.json is required so publishing can synchronize the interactive map automatically'));
  assert.ok(edge.includes('delete currentPlaces[storyId]'));
  assert.ok(edge.includes('currentPlaces[storyId] = { ...place, lat, lng }'));
  assert.ok(edge.includes('map_linked: mapMarkerAdded'));
  assert.ok(!edge.includes('map_linked: true, map_marker_added: mapMarkerAdded'));
});

test('story i18n lookup supports source-first and language-first dictionaries', function () {
  var vm = require('vm');
  var engine = fs.readFileSync('assets/shared/story-i18n.js','utf8');
  var match = engine.match(/function findTranslation\(source, lang\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'translation lookup helper must exist');
  var sourceFirst = { 'مرحبا': { en: 'Hello', fr: 'Bonjour' } };
  var languageFirst = { en: { 'مرحبا': 'Hello' }, fr: { 'مرحبا': 'Bonjour' }, de: { 'مرحبا': 'Hallo' } };
  function lookup(dictionary, lang) {
    var context = { translations: dictionary };
    return vm.runInNewContext(match[0] + '; findTranslation("مرحبا", "' + lang + '")', context);
  }
  assert.equal(lookup(sourceFirst, 'en').en, 'Hello');
  assert.equal(lookup(languageFirst, 'fr').fr, 'Bonjour');
  assert.equal(lookup(languageFirst, 'de').de, 'Hallo');
  assert.equal(lookup(languageFirst, 'en').en, 'Hello');
});

test('unified v3 story prompt requires complete five-language verification', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.ok(promptTexts.includes('الإصدار: 2026-10-22-v3'));
  assert.ok(promptTexts.includes('## 6) اللغات الخمس — اكتمال حقيقي'));
  assert.ok(promptTexts.includes('ar/en/fr/it/de'));
  assert.ok(promptTexts.includes('اختبر التبديل بين اللغات ثم الرجوع إلى لغة أخرى'));
  assert.ok(admin.includes('STORY_PAGE_PROMPT'));
});

test('unified v3 prompt requires sourced images and a rendered image gallery', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js','utf8');
  assert.ok(promptTexts.includes('## 4) الغلاف والصور — من البداية حتى آخر مشهد'));
  assert.ok(promptTexts.includes('source_name وsource_url وrights'));
  assert.ok(promptTexts.includes('ظهور الصورة في نتائج البحث ليس إذنًا باستخدامها.'));
  assert.ok(bundle.includes('function imageGalleryHtml(d)'));
  assert.ok(bundle.includes("'+gallery+'"));
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
});


test('AI JSON import repair handles common copy/paste formatting damage without changing source text', function () {
  var repair = require('../assets/ai-json-repair.js');
  var raw = 'Introductory text\\n```json\\n{"format":"KH_STORY_PACKAGE_V1","title":"T\\\\*itle","body":"line one\\nline two","items":[1,2,],}\\n```';
  var parsed = repair.parse(raw);
  assert.equal(parsed.value.format, 'KH_STORY_PACKAGE_V1');
  assert.equal(parsed.value.title, 'T*itle');
  assert.equal(parsed.value.body, 'line one\nline two');
  assert.equal(parsed.repaired, true);
  assert.ok(raw.includes('T\\\\*itle'), 'the pasted source remains unchanged');
});
test('AI JSON import selects the complete story package when pasted text contains duplicate objects or stray tags', function () {
  var repair = require('../assets/ai-json-repair.js');
  var raw = '{"format":"OTHER","title":"short"}\\n</escape>\\n{"format":"KH_STORY_PACKAGE_V1","title":"complete package","body":"longer valid body"}';
  var parsed = repair.parse(raw);
  assert.equal(parsed.value.format, 'KH_STORY_PACKAGE_V1');
  assert.equal(parsed.value.title, 'complete package');
  assert.equal(parsed.repaired, true);
  assert.ok(parsed.notes.some(function (note) { return note.indexOf('أكبر كائن مكتمل وصالح') >= 0; }));
});
test('AI import validates the package before saving and preserves pasted content on parse failure', function () {
  assert.ok(admin.indexOf('window.KHAIJsonRepair.parse(sourceRaw)') < admin.indexOf('window.KHWorkflow.validateStoryPackage(pkg)'));
  assert.ok(admin.includes('تعذر قراءة JSON حتى بعد محاولة إصلاح التنسيق تلقائيًا'));
  assert.ok(admin.includes('احتفظ بالناتج في المربع وحاول مرة أخرى.'));
  assert.ok(admin.includes("localStorage.setItem(aiPasteStorageKey,aiPaste.value)"));
  assert.ok(admin.includes('تم إصلاح تنسيق JSON في نسخة الاستيراد فقط؛ النص الملصوق محفوظ كما هو.'));
});

test('v3 prompt architecture uses one master prompt and concise provider instructions', function () {
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var workflow = fs.readFileSync('docs/khaledoon-story-production-workflow.md','utf8');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptAdmin = fs.readFileSync('khaledoon/prompts-admin.html','utf8');
  assert.ok(promptTexts.includes('الإصدار: 2026-10-22-v3'));
  assert.ok(promptTexts.includes('var STORY_PAGE_PROMPT ='));
  assert.ok(promptTexts.includes('var STORY_PROVIDER_PROMPTS ='));
  ['ChatGPT','Gemini','Claude','DeepSeek'].forEach(function(provider) {
    assert.ok(promptTexts.includes('## تعليمات تشغيل خاصة بـ ' + provider), 'missing concise provider instruction: '+provider);
  });
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
  assert.ok(admin.includes('تعليمات الأداة المختارة'));
  assert.ok(!admin.includes("STORY_WORKFLOW = khAppendPromptOnce(STORY_WORKFLOW"));
  assert.ok(promptAdmin.includes('assets/khaledoon-admin-texts.js?v=20261022-prompts-v3'));
  assert.ok(admin.includes('khaledoon-admin-texts.js?v=20261022-3'));
  assert.ok(workflow.includes('التنفيذ التلقائي لكل الحكايات ولكل أدوات الذكاء الاصطناعي'));
  assert.ok(admin.includes('PROJECT_INSTRUCTIONS'));
});

console.log('\n' + passed + ' integration checks passed' + (process.exitCode ? ', with failures' : ''));
