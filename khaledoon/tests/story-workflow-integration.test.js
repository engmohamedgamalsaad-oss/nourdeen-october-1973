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
test('every admin submission row exposes edit and move actions, including closed review states', function () {
  assert.ok(admin.includes("var editBtn=el('button','btn ghost','تعديل')"));
  assert.ok(admin.includes("var moveBtn=el('button','btn ghost','نقل الحكاية')"));
  assert.ok(admin.includes("if(it._t!=='site'){\nvar actions=el('div','review-actions');"), 'editor and review data must remain available for records awaiting publication');
  assert.ok(admin.includes("editDetails.open=true"), 'edit action must open the existing story editor');
  assert.ok(admin.includes('forceEditOpen=true') && admin.includes('||forceEditOpen){'), 'edit must force-build the editor for already-published records');
  assert.ok(admin.includes("querySelector('details.review-data')"), 'edit must target the review/editor panel rather than the original-body details');
  assert.ok(admin.includes("meta.pending_draft=pending;patch={story_meta:meta}"), 'published story moves must remain drafts until reviewed');
  assert.ok(admin.includes('capabilityResult.supports_story_move!==true'), 'published moves must stop before packaging when the deployed publisher lacks move support');
  assert.ok(admin.includes('لم تتغير النسخة المنشورة'), 'blocked published moves must explicitly preserve the live story');
  assert.ok(admin.includes("moveSave.textContent='جارٍ حفظ النقل…'"));
});
test('publisher moves a story in a review PR and preserves the previous story URL with a redirect', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  assert.ok(publisher.includes('supports_story_move: true'), 'new publisher capability must explicitly advertise move support');
  assert.ok(publisher.includes('function contentForSafetyScan(file:'), 'legacy V1 publisher must inspect decoded file content');
  assert.ok(publisher.includes('new TextDecoder().decode(bytes)'), 'base64-encoded V2 markers must be decoded before the V1 artifact guard');
  assert.ok(publisher.includes('file.content.replace(/' + String.fromCharCode(92) + 's/g, "")'), 'base64 whitespace must be removed with a real whitespace regex before decoding');
  assert.ok(publisher.includes('contentForSafetyScan(file)'), 'V2 rejection must scan decoded content, not only the submitted base64 string');
  assert.ok(publisher.includes('2026-10-28-v2-draft-guard-1'), 'publisher capability version must identify the move-capable implementation');
  assert.ok(publisher.includes("let previousRoot = ''"));
  assert.ok(publisher.includes("oldTree.truncated"));
  assert.ok(publisher.includes('matchingIndices.length > 1'), 'ambiguous duplicate IDs must block a move');
  assert.ok(publisher.includes('prMarkerPrefix') && publisher.includes("includes(prMarkerPrefix)"), 'an open PR for the same story ID must block a concurrent move to another path');
  assert.ok(publisher.includes('Destination story page already exists outside the index'), 'an occupied destination must not be overwritten');
  assert.ok(publisher.includes("const oldIndexPath = previousRoot + 'index.html'"));
  assert.ok(publisher.includes("treeEntries.push({ path: entry.path, mode: '100644', type: 'blob', sha: null })"));
  assert.ok(publisher.includes("This story has moved."));
  assert.ok(publisher.includes("published_to_main: false"), 'moving a story must remain a review PR, never a direct main write');
});
test('admin imports the workflow module and derives status counters', function () {
  assert.ok(admin.includes('src="assets/story-workflow.js?v=20261026-cover-contract-1"'));
  assert.ok(admin.includes('window.KHWorkflow.counters(visibleAdminRecords,sitePageItems)'));
  assert.ok(admin.includes("itemState(i)===fStatus"));
  assert.ok(!admin.includes('handleStoryPreviewDecision'));
});
test('manual story builder inline JavaScript remains syntactically valid', function () {
  var match = builder.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match && match[1], 'manual story builder inline script must be present');
  new (require('vm').Script)(match[1], { filename: 'khaledoon/story-builder.html' });
});
test('manual story builder supports the unified cover, sourced-image, and map metadata contract', function () {
  assert.ok(builder.includes('id="cover_json"'), 'manual builder must collect the required cover object');
  assert.ok(builder.includes('id="images_json"'), 'manual builder must collect the required sourced image array');
  assert.ok(builder.includes("cover:parseJsonField('cover_json',currentMeta.cover||null)"), 'draft must parse cover JSON and preserve saved metadata');
  assert.ok(builder.includes("images:parseJsonField('images_json',currentMeta.images||[])"), 'draft must parse image JSON and preserve saved metadata');
  assert.ok(builder.includes("meta.cover=d.cover||meta.cover||null;meta.images=Array.isArray(d.images)?d.images:(meta.images||[])"), 'manual save must persist cover and image metadata');
  assert.ok(builder.includes('meta.cover_json=d.cover_json;meta.images_json=d.images_json;meta.map_location_json=d.map_location_json'), 'manual save must preserve in-progress JSON text, including incomplete drafts');
  assert.ok(builder.includes("if(read('images_json')&&!Array.isArray(d.images))"), 'invalid image JSON must stop preview validation');
  assert.ok(builder.includes("map_location_json:typeof m.map_location_json==='string'?m.map_location_json:(Object.prototype.hasOwnProperty.call(m,'map_location')?JSON.stringify(m.map_location,null,2):'')"), 'restoring a draft must preserve raw JSON and existing map location metadata');
  assert.ok(builder.includes("if(Object.prototype.hasOwnProperty.call(d,'map_location')&&(!d.map_location_json||d.map_location_json==='null'||(d.map_location&&typeof d.map_location==='object'&&!Array.isArray(d.map_location))))"), 'invalid map JSON must not overwrite a saved map location');
  assert.ok(builder.includes('function validateMapLocation(mapLoc,missing)'), 'manual builder must validate map coordinates, localized place/source names, and HTTPS source URL');
  assert.ok(builder.includes('async function verifyManualAssets(d)'), 'manual preview must verify that the cover and gallery images actually load');
  assert.ok(builder.includes('await verifyManualAssets(draft())'), 'manual preview must finish image checks before saving and opening the preview');
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
test('active admin prompt is synchronized with the unified v4 story contract', function () {
  var shared = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  var marker = 'var STORY_PAGE_PROMPT = ';
  var markerIndex = shared.indexOf(marker);
  assert.ok(markerIndex >= 0, 'active story prompt declaration must exist');
  var start = markerIndex + marker.length;
  var end = shared.indexOf('\nvar STORY_PROVIDER_PROMPTS =', start);
  assert.ok(end > start, 'active story prompt must be a single embedded string');
  var prompt = JSON.parse(shared.slice(start, end).replace(/;$/, ''));
  assert.ok(prompt.includes('الإصدار: 2026-10-23-v4'));
  var masterPrompt = fs.readFileSync('khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md','utf8').trim();
  assert.equal(prompt.trim(), masterPrompt, 'saved v4 master must exactly match the active admin prompt');
  assert.ok(prompt.includes('### عقد الغلاف الموحد — مصدر واحد لكل موضع'));
  assert.ok(prompt.includes('cover.i18n'));
  assert.ok(prompt.includes('ملفًا محليًا لم يُرفع'), 'prompt must forbid unpreviewable local cover files');
  assert.ok(prompt.includes('اللغات الأربع') && prompt.includes('en/fr/it/de'));
  assert.ok(prompt.includes('source_name') && prompt.includes('source_url') && prompt.includes('rights'));
  assert.ok(prompt.includes('source_name` كائنين مترجمين إلى `ar/en/fr/it/de`'), 'map source names must be localized in the active prompt');
  var admin = fs.readFileSync('khaledoon/admin.html', 'utf8');
  assert.ok(admin.includes('source_name كائنين مترجمين إلى ar/en/fr/it/de'), 'AI JSON schema must match the map source-name contract');
  assert.ok(prompt.includes('لا تدمج تغييرًا إلى الفرع المنشور قبل الموافقة الصريحة'));
  assert.ok(admin.includes("savedMain.indexOf('الإصدار: 2026-10-23-v4')>=0"), 'copy action must not treat v3 as current');
  assert.ok(admin.includes("raw.main.indexOf('الإصدار: 2026-10-23-v4')<0"), 'saved legacy prompts must migrate to v4');
  assert.ok(admin.includes("raw.workflow.indexOf('الإصدار: 2026-10-23-v4')<0"), 'saved legacy workflow guides must migrate to v4');
});
test('active v4 master prompt exactly matches the canonical master file', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  var canonical = fs.readFileSync('khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md', 'utf8');
  var prefix = 'var STORY_PAGE_PROMPT = ';
  var start = texts.indexOf(prefix) + prefix.length;
  var end = texts.indexOf(';\nvar STORY_PROVIDER_PROMPTS', start);
  assert.ok(start >= prefix.length && end > start, 'active STORY_PAGE_PROMPT string must be isolated');
  assert.equal(JSON.parse(texts.slice(start, end)), canonical, 'active prompt must not drift from canonical v4 master file');
});
test('embedded v4 provider prompts exactly match canonical provider files', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  var prefix = 'var STORY_PROVIDER_PROMPTS = ';
  var start = texts.indexOf(prefix) + prefix.length;
  var end = texts.indexOf(';\n\nfunction khAppendPromptOnce', start);
  assert.ok(start >= prefix.length && end > start, 'embedded provider prompt object must be isolated');
  var embedded = JSON.parse(texts.slice(start, end));
  var root = 'khaledoon/prompts/2026-10-23-unified-v4/';
  var files = { chatgpt: 'CHATGPT.md', claude: 'CLAUDE.md', gemini: 'GEMINI.md', deepseek: 'DEEPSEEK.md' };
  Object.keys(files).forEach(function (key) {
    var canonical = fs.readFileSync(root + files[key], 'utf8');
    assert.equal(String(embedded[key] || ''), canonical, key + ' embedded prompt must match the canonical v4 file');
  });
});
test('embedded project instructions exactly match the canonical project file', function () {
  var fs = require('node:fs');
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  var canonical = fs.readFileSync('PROJECT_INSTRUCTIONS.md', 'utf8');
  var prefix = 'var PROJECT_INSTRUCTIONS = ';
  var start = texts.indexOf(prefix) + prefix.length;
  var end = texts.indexOf(';\nvar STORY_WORKFLOW', start);
  assert.ok(start >= prefix.length && end > start, 'embedded PROJECT_INSTRUCTIONS string must be isolated');
  assert.equal(JSON.parse(texts.slice(start, end)), canonical, 'admin prompt must not drift from PROJECT_INSTRUCTIONS.md');
});
test('published story 012 and 014 headers have all four non-Arabic translations', function () {
  var science = fs.readFileSync('stories/science/012/translations.js', 'utf8');
  var history = fs.readFileSync('stories/history/014/translations.js', 'utf8');
  ['en','fr','it','de'].forEach(function (lang) {
    assert.ok(science.includes('supplementalTranslations.' + lang + '["خالدون عبر التاريخ · 012"]'), 'story 012 missing localized header for ' + lang);
    assert.ok(history.includes('supplementalTranslations.' + lang + '["خالدون عبر التاريخ · 014"]'), 'story 014 missing localized header for ' + lang);
  });
  ['en','fr','it','de'].forEach(function (lang) {
    assert.ok(history.includes('supplementalTranslations.' + lang + '["← التاريخ والحضارات"]'), 'story 014 missing localized breadcrumb for ' + lang);
  });
});
test('unified v4 prompt is shared and legacy AI output is not copied into fresh prompts', function () {
  var instructions = fs.readFileSync('PROJECT_INSTRUCTIONS.md','utf8');
  assert.ok(instructions.includes('cover.url` رابط صورة مباشر HTTPS'));
  assert.ok(instructions.includes('source_name` ككائن بالخمس لغات `{ar,en,fr,it,de}`'));
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
  assert.ok(admin.includes('STORY_DATA_QUALITY_GATE'));
  assert.ok(!admin.includes("L.push(String(copyMeta.ai_package_raw))"), 'old AI output must not be pasted into a fresh prompt');
  assert.ok(admin.includes("assets/khaledoon-admin-texts.js?v=20261029-unified-reader-prompt-2"));
  var shared = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  assert.ok(shared.includes('الإصدار: 2026-10-23-v4'));
  assert.ok(shared.includes('استبدل أي نسخة قديمة به بالكامل'));
  assert.ok(shared.includes('لا تلصق البرومبت القديم فوقه'));
  assert.ok(shared.includes('ar/en/fr/it/de'));
  assert.ok(shared.includes('cover-popup'));
  assert.ok(shared.includes('prefers-reduced-motion'));
  assert.ok(shared.includes('source_name') && shared.includes('source_url') && shared.includes('rights'), 'shared v4 prompt must retain source and rights fields');
  assert.ok(shared.includes('معرض من صورتين إلى خمس صور موثقة وصالحة'), 'quality gate must enforce the same two-to-five image limit as the validator');
  var masterPrompt = fs.readFileSync('khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md','utf8');
  assert.ok(masterPrompt.includes('من صورتين إلى خمس صور موثقة وصالحة'), 'canonical master prompt must agree with the gallery validator limit');
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
  assert.ok(publisher.includes('sourceNameIsLocalized'), 'publisher must preserve five-language map source names');
  assert.ok(publisher.includes('map_marker_added: mapMarkerAdded'));
  var mapBundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
  assert.ok(mapBundle.includes('if(mapLocation===null){mapData[id]=null;}'), 'explicit no-location must reach the server so stale markers are removed');
  assert.ok(mapBundle.includes('source_name:mapLocation.source_name'), 'bundle must preserve localized map source-name objects');
  assert.ok(mapBundle.includes('mapData[id].place_label=mapLocation.place_label'), 'bundle must preserve localized optional map labels');
  assert.ok(mapBundle.includes('تسمية المكان الاختيارية يجب أن تكون مترجمة'), 'bundle must reject untranslated optional map labels');
  assert.ok(admin.includes('map_linked:result.map_linked===true'));
  assert.ok(admin.includes("result.map_message?String(result.map_message)+' ':'"));
  assert.ok(admin.includes('story-template-bundle.js?v=20261027-source-clean-2'));
  var shared = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  assert.ok(shared.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
  assert.ok(shared.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
});
test('production publisher and deletion functions remain review-only until a PR is merged', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  assert.ok(publisher.includes('publisher_mode: "draft_pr"'));
  assert.ok(publisher.includes('published_to_main: false'));
  assert.ok(publisher.includes('draft: true'));
  assert.ok(publisher.includes('pull_request_url: pull.html_url'));
  assert.ok(publisher.includes('refs/heads/" + branchNameForRecovery'));
  assert.ok(publisher.includes('/pulls'));
  assert.ok(!publisher.includes('git/refs/heads/${BASE}'), 'publisher must not update main directly');

  var deletion = fs.readFileSync('supabase/functions/delete-hidden-story/index.ts', 'utf8');
  assert.ok(deletion.includes('deletion_mode: "draft_pr"'));
  assert.ok(deletion.includes('pending: true, deleted: false'));
  assert.ok(deletion.includes('draft: true'));
  assert.ok(deletion.includes('<!-- khaledoon-delete-story:'));
  assert.ok(!deletion.includes('git/refs/heads/${BASE}'), 'deletion function must not update main directly');
  assert.ok(deletion.indexOf('if (!mergedPull) return reply(404') < deletion.indexOf('from("story_visibility").delete()'),
    'visibility row cleanup must happen only after a merged deletion PR is verified');
});

test('approved stories can reopen reader preview and AI image data is preserved', function () {
  assert.ok(admin.includes('فتح معاينة القارئ'));
  assert.ok(admin.includes("images:Array.isArray(pkg.images)?pkg.images:[]"));
  assert.ok(admin.includes("visual_design:String(pkg.visual_design||'')"));
  assert.ok(admin.includes("preview_source_url:'',translations:translations"));
  assert.ok(admin.includes('static_story_path:null,bundle_downloaded:false,prepared_page_url:\'\''));
  assert.ok(preview.includes("params.get('table')==='submitted_stories'?'submitted_stories':'khaledoon_submissions'"));
  assert.ok(preview.includes("record_type:legacy?'legacy':'modern'"));
  assert.ok(preview.includes('if(!Array.isArray(d.images)||!d.images.length)d.images='), 'empty image arrays should fall back to saved draft or metadata images');
  assert.ok(preview.includes('d.visual_design=firstText'));
});
test('review preview displays submitted images and portrait design styling', function () {
  assert.ok(preview.includes('function renderReviewImages(d)'));
  assert.ok(preview.includes('renderReviewImages(d);'));
  assert.ok(preview.includes('images:(Array.isArray(source.images)&&source.images.length?source.images:'), 'an empty top-level images array must not mask story_meta images');
  assert.ok(preview.includes('translations:(source.translations&&Object.keys(source.translations).length?source.translations:'), 'an empty translations object must not mask saved translations');
  assert.ok(bundle.includes('Shared preview polish inspired by the approved Mahfouz and Tawfiq story pages'));
  assert.ok(preview.includes('pub-image-grid'));
  assert.ok(preview.includes('تعذر تحميل ملف الصورة من الرابط'));
  assert.ok(bundle.includes('story-design-portrait-biography .hero h1'));
  assert.ok(bundle.includes('story-design-portrait-biography .story-visual-gallery'));
  assert.ok(bundle.includes('prefers-reduced-motion'));
});
test('shared reader template supports explicit and system light themes', function () {
  assert.ok(bundle.includes(':root[data-theme="light"] body[data-story-slug] .story'));
  assert.ok(bundle.includes('@media(prefers-color-scheme:light)'));
  assert.ok(bundle.includes(':root:not([data-theme="dark"]) body[data-story-slug]'));
});
test('section color contract keeps Hatshepsut pink/purple and Magdi Yacoub cyan/teal', function () {
  var masterPrompt = fs.readFileSync('khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md', 'utf8');
  var checklist = fs.readFileSync('khaledoon/prompts/2026-10-23-unified-v4/WORKFLOW-CHECKLIST.md', 'utf8');
  var hatsTheme = fs.readFileSync('stories/women/013/theme.css', 'utf8');
  var magdiTheme = fs.readFileSync('stories/science/015/theme.css', 'utf8');
  assert.ok(masterPrompt.includes('حتشبسوت ترث لوحة نساء خالدات الوردية/البرقوقية ولا تُعرض باللون الأخضر'));
  assert.ok(masterPrompt.includes('مجدي يعقوب يرث لوحة العلوم السماوية/التركوازية ولا تُعرض صفحته بخلفية بنية'));
  assert.ok(checklist.includes('حتشبسوت ليست خضراء') && checklist.includes('مجدي يعقوب ليس بخلفية بنية'));
  assert.ok(bundle.includes("women:'#d78bb2'") && bundle.includes("women:'women-leadership'"));
  assert.ok(bundle.includes("science:'#8ad9e8'") && bundle.includes("science:'science-lab'"));
  assert.ok(hatsTheme.includes('--accent:#e7a1c1') && hatsTheme.includes('#51284b'));
  assert.ok(magdiTheme.includes('--accent:#8ad9e8') && magdiTheme.includes('#164451'));
  assert.doesNotMatch(magdiTheme, /#50302b|#40262a/, 'Magdi Yacoub theme must not inherit the brown portrait palette');
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
  assert.ok(admin.includes('cover:pkg.cover||null'), 'AI import must preserve the validated cover object');
  assert.ok(admin.includes('cover, map_location, images, translations, question_bank'), 'AI output schema must explicitly require the cover object');
  assert.ok(admin.includes("if(!Object.prototype.hasOwnProperty.call(SEC,String(pkg.section_key||'')))"));
  assert.ok(admin.includes('window.KHAIJsonRepair.parse(sourceRaw)'));
  assert.ok(admin.includes('!pkg.format&&pkg.section_key&&pkg.translations&&pkg.question_bank&&Array.isArray(pkg.images)'), 'recognizable complete packages without the format marker should be normalized safely');
  assert.ok(admin.includes('أول خاصية في كائن JSON الجذر يجب أن تكون حرفيًا'));
  assert.ok(admin.includes('بلا أسوار كود أو Markdown أو مقدمة أو خاتمة'));
  assert.ok(!admin.includes('يُسمح بسياج الكود الخارجي وحده'), 'the admin JSON contract must not request code fences');
  assert.ok(!admin.includes('ولا كتلة كود ثانية'), 'the admin JSON contract must not imply one code block is allowed');
  assert.ok(admin.includes('images مصفوفة من صورتين إلى خمس صور موثقة وصالحة'));
  assert.ok(!admin.includes('إن تعذر البحث فاترك images فارغة'));
  assert.ok(admin.includes('لا تُخرج حزمة JSON للاستيراد إذا تعذر التحقق من صورتين على الأقل'));
  var sharedQuality = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
  assert.ok(sharedQuality.includes('معرض من صورتين إلى خمس صور موثقة وصالحة'));
  assert.ok(!sharedQuality.includes('إن تعذر البحث فاترك images فارغة'));
  assert.ok(sharedQuality.includes('بدل اختلاق روابط أو حقوق'), 'shared quality gate must prohibit invented image sources and rights');
  assert.ok(admin.includes('تعذر قراءة JSON حتى بعد محاولة إصلاح التنسيق تلقائيًا'));
  assert.ok(admin.includes('section_key واحدة من october, science, learning, fame, history, curriculum, islamic, readers'));
});
test('manual builder merges metadata and protects original body', function () {
  assert.ok(builder.includes('Object.assign({},currentMeta||{})'));
  assert.ok(builder.includes('(currentRecord&&currentRecord.original_body)||d.original_body'));
  assert.ok(builder.includes('window.KHWorkflow.markPreviewSent(meta,new Date())'));
  assert.ok(!builder.includes('kh-story-preview-decision'));
});
test('preview approval records review only and never publishes directly', function () {
  var decideStart = preview.indexOf('async function decide(action,clickedButton)');
  var decideEnd = preview.indexOf('var approveBottomButton=', decideStart);
  assert.ok(decideStart >= 0 && decideEnd > decideStart, 'preview decision handler must exist');
  var decideBody = preview.slice(decideStart, decideEnd);
  assert.ok(decideBody.includes('window.KHWorkflow.markApproved(meta'));
  assert.ok(decideBody.includes('payload.story_meta=meta'));
  assert.ok(decideBody.includes('الحكاية لم تُنشر ولم يبدأ تنزيل أي ملف'));
  assert.ok(!decideBody.includes('publish-story-pr'), 'preview approval must not invoke the publisher');
  assert.ok(!decideBody.includes('window.open('), 'preview approval must not start a separate publish/download window');
  assert.ok(decideBody.includes("if(record.status!=='published')payload.status=approve?"), 'new story approval must not skip the explicit later publish stage');
  assert.ok(decideBody.includes("if(record.status==='published'){"), 'published story approval must be staged separately');
  assert.ok(decideBody.includes('meta.pending_draft=Object.assign({},d)'), 'published edits must remain pending until publish PR review');
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
test('preview review panel displays image thumbnails and attribution from the saved package', function () {
  assert.ok(preview.includes('function renderReviewImages(d)'));
  assert.ok(preview.includes('className=\'pub-image-grid\''));
  assert.ok(preview.includes('تعذر تحميل ملف الصورة من الرابط'));
  assert.ok(preview.includes('renderReviewImages(d);'));
  assert.ok(preview.includes('pub-image-card'));
});
test('Hatshepsut cover SVG has no embedded text and V2 package provides localized accessible image text', function () {
  var svg = fs.readFileSync('stories/women/013/cover-popup.svg', 'utf8');
  assert.ok(!/<text|<tspan|<title|<desc/i.test(svg), 'cover SVG must leave all words to localized package metadata');
  assert.ok(!/[\u0600-\u06FF]/.test(svg), 'cover SVG must not contain Arabic text');
  assert.ok(svg.includes('aria-hidden=\"true\"'), 'decorative SVG must be hidden from assistive technology');
  var pkg = JSON.parse(fs.readFileSync('stories/women/013/data.v2.json', 'utf8'));
  ['ar','en','fr','it','de'].forEach(function (lang) {
    assert.ok(pkg.cover.i18n[lang].alt, 'cover alt must be localized for ' + lang);
    assert.ok(pkg.cover.i18n[lang].caption, 'cover caption must be localized for ' + lang);
  });
});
test('Hatshepsut V2 reader keeps accessible scroll reveal and the women card prefers a real museum photo', function () {
  var story = fs.readFileSync('stories/women/013/index.html', 'utf8');
  var readerCss = fs.readFileSync('rebuild/reader-base.css', 'utf8');
  var readerJs = fs.readFileSync('rebuild/reader.js', 'utf8');
  var collection = fs.readFileSync('khaledoon/assets/story-collections.js', 'utf8');
  assert.ok(story.includes('data-kh-v2-reader'), 'Hatshepsut must use the unified V2 reader');
  assert.ok(story.includes('data-story-path=\"data.v2.json\"'), 'V2 page must load its localized story package');
  assert.ok(readerJs.includes('IntersectionObserver') && readerJs.includes('kh-pending') && readerJs.includes('kh-in'), 'V2 story blocks must reveal on scroll');
  assert.ok(readerCss.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion users must not have hidden story text');
  assert.ok(readerCss.includes('header{position:static'), 'language header must scroll away with the page');
  assert.ok(collection.includes("String(story.id || '') === '013'"), 'card image selection must target only story 013');
  assert.ok(collection.includes('assets/images/stories/500px-The_Female_Pharaoh_Hatshepsut_MET_DT534.jpg'), 'women card must prefer the verified Hatshepsut museum photo');
  assert.ok(fs.existsSync('assets/images/stories/500px-The_Female_Pharaoh_Hatshepsut_MET_DT534.jpg'), 'preferred museum image must exist in the repository');
});
test('Hatshepsut title uses feminine wording in all localized story metadata', function () {
  var translations = fs.readFileSync('stories/women/013/translations.js', 'utf8');
  var storyIndex = JSON.parse(fs.readFileSync('stories/index.json', 'utf8'));
  var entry = storyIndex.find(function (item) { return String(item.id).padStart(3, '0') === '013'; });
  assert.ok(entry, 'Hatshepsut must remain in the story index');
  var expected = {
    en: 'Hatshepsut: The Golden Female Pharaoh on the Nile Throne',
    fr: 'Hatchepsout : La pharaonne d’or sur le trône du Nil',
    it: 'Hatshepsut: La faraona d’oro sul trono del Nilo',
    de: 'Hatschepsut: Die goldene Pharaonin auf dem Thron des Nils'
  };
  Object.keys(expected).forEach(function (lang) {
    assert.strictEqual(entry.i18n[lang].title, expected[lang], 'story index title must use feminine wording for ' + lang);
    assert.ok(translations.includes(expected[lang]), 'story translation dictionary must contain the localized title for ' + lang);
  });
  assert.ok(!entry.i18n.fr.title.includes('Le Pharaon'), 'French title must not misgender Hatshepsut');
  assert.ok(!entry.i18n.it.title.includes('Il Faraone'), 'Italian title must not misgender Hatshepsut');
  assert.ok(!entry.i18n.de.title.includes('Der goldene Pharao'), 'German title must not misgender Hatshepsut');
});
test('new story generator uses one sourced cover object and keeps SVG fallback free of embedded text', function () {
  assert.ok(bundle.includes("var coverData=d.cover&&typeof d.cover==='object'?d.cover:null"));
  assert.ok(bundle.includes('function absoluteStoryImageUrl(value,baseUrl,section,id)'), 'hero, modal and metadata need one resolved cover URL');
  assert.ok(bundle.includes('مسار أصل موجود داخل المستودع'), 'unuploaded local cover paths must be rejected');
  assert.ok(bundle.includes('if(!localCoverResponse.ok)throw new Error'), 'local cover path must be confirmed to exist before generating a bundle');
  var vm = require('vm');
  var sandbox = { window: {}, console: console, TextEncoder: TextEncoder, Blob: Blob, URL: URL };
  vm.runInNewContext(bundle, sandbox, { filename: 'story-template-bundle.js' });
  var api = sandbox.window.KHStoryBundle;
  var pathPreview = api.renderPreviewHtml({section_key:'history',title:'اختبار مسار الغلاف',cover:{path:'assets/images/stories/Naguib_Mahfouz_HR.jpg',alt:'غلاف اختبار',caption:'تعليق',source_name:'مصدر',source_url:'https://example.org/cover',rights:'ترخيص موضح',kind:'illustration'}});
  assert.ok(pathPreview.includes('src="https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/assets/images/stories/Naguib_Mahfouz_HR.jpg"'), 'repository cover path must resolve for hero and modal');
  assert.ok(pathPreview.includes('content="https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/assets/images/stories/Naguib_Mahfouz_HR.jpg"'), 'Open Graph image must resolve to the same repository cover path');
  var localImagePreview = api.renderPreviewHtml({section_key:'history',title:'اختبار صورة محلية',cover:{url:'https://images.example/cover.jpg',alt:'غلاف',caption:'تعليق',source_name:'مصدر',source_url:'https://example.org/cover',rights:'ترخيص',kind:'illustration'},images:[{url:'assets/images/stories/21V_CAT096R3.jpg',alt:'صورة',caption:'صورة موثقة',kind:'archival',source_name:'Metropolitan Museum',source_url:'https://example.org/image',rights:'Public Domain'}]});
  assert.ok(localImagePreview.includes('src="https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/assets/images/stories/21V_CAT096R3.jpg"'), 'repository-root local gallery images must resolve against the site root');
  var unsafeImages = api.validate({images:[{url:'../assets/images/a.jpg',alt:'A',source_name:'Source A',source_url:'https://example.org/a',rights:'License'},{url:'https://images.example/b.jpg',alt:'B',source_name:'Source B',source_url:'https://example.org/b',rights:'License'}]});
  assert.ok(unsafeImages.missing.some(function(item){return item.includes('صورتين على الأقل بروابط قابلة للفتح')}), 'relative traversal image paths must not count as valid sourced images');
  var adminHtml = fs.readFileSync('khaledoon/admin.html','utf8');
  assert.ok(adminHtml.includes('localImageResponse=await fetch(localImageUrl'), 'AI import must verify local gallery image assets exist before saving');
  assert.ok(adminHtml.includes('window.KHWorkflow.verifyImageResource('), 'AI import must use the shared image-resource verifier for HTTPS and local assets');
  assert.ok(adminHtml.includes('await Promise.all(imageProbeJobs)'), 'AI import must finish image-load verification before saving the draft');
  var workflow = fs.readFileSync('khaledoon/assets/story-workflow.js','utf8');
  assert.ok(workflow.includes('function verifyImageResource(url, label, ImageCtor, timeoutMs)'), 'the image verifier must be shared and independently testable');
  assert.ok(workflow.includes('probe.naturalWidth > 0 && probe.naturalHeight > 0'), 'image verification must reject non-image/empty responses');
  var invalidLocalCover = api.validate({cover:{path:'./cover.svg',alt:'غلاف',caption:'تعليق',source_name:'مصدر',source_url:'https://example.org/cover',rights:'ترخيص موضح',kind:'illustration'}});
  assert.ok(invalidLocalCover.missing.some(function (item) { return item.includes('المسار النسبي لملف غير مرفوع'); }), 'package-local unuploaded cover must fail validation');
  assert.ok(bundle.includes("cover:d.cover?{url:d.cover.url||d.cover.path||''"));
  var collections = fs.readFileSync('khaledoon/assets/story-collections.js', 'utf8');
  assert.ok(collections.includes('if (coverPhoto && !coverUrl)'), 'legacy hardcoded covers must not override the unified cover object');
  assert.ok(bundle.includes("ترجمة الوصف والتعليق واسم المصدر وحقوق الغلاف مطلوبة"));
  assert.ok(bundle.includes("heroImageAbsoluteUrl?esc(heroImageAbsoluteUrl):baseUrl+'/stories/'+section+'/'+id+'/cover.svg'"), 'Open Graph metadata must use the resolved unified cover URL');
  var svgStart = bundle.indexOf('function svgCover(d,id,accent,popup){');
  var svgEnd = bundle.indexOf('function zipFiles(files){', svgStart);
  assert.ok(svgStart >= 0 && svgEnd > svgStart);
  assert.ok(!bundle.slice(svgStart, svgEnd).includes('<text '), 'generated SVG cover must not embed untranslated visible text');
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
  assert.ok(bundle.includes('Preview design profiles'));
  assert.ok(bundle.includes('.story-design-portrait-biography{background:radial-gradient'));
  assert.ok(bundle.includes('.story-design-arts-culture{background:radial-gradient'));
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
      cover: {url:'https://images.example/cover.jpg',alt:'غلاف اختبار',caption:'تعليق الغلاف',source_name:'مصدر الغلاف',source_url:'https://example.org/cover',rights:'ترخيص موضح',kind:'illustration',i18n:{en:{alt:'Test cover',caption:'Test cover caption'},fr:{alt:'Couverture test',caption:'Légende de couverture'},it:{alt:'Copertina di prova',caption:'Didascalia copertina'},de:{alt:'Test-Cover',caption:'Test-Cover-Beschriftung'}}},
      figure_name: 'شخصية اختبار', narrator_name: 'كارما', narrator_grade: 'الصف السادس',
      karma_text: 'لماذا تختلف الحكايات؟', body: 'هذا نص تجريبي طويل بما يكفي لعرض معاينة التصميم المخصص لكل حكاية.',
      sources: 'المصدر الأول https://example.org/source-a\nالمصدر الثاني https://example.org/source-b',
      images: [
        {url:'https://images.example/a.jpg',alt:'وصف الصورة الأولى',caption:'الصورة الأولى',kind:'illustration',source_name:'المصدر أ',source_url:'https://example.org/image-a',rights:'ترخيص توضيحي'},
        {url:'https://images.example/b.jpg',alt:'وصف الصورة الثانية',caption:'الصورة الثانية',kind:'diagram',source_name:'المصدر ب',source_url:'https://example.org/image-b',rights:'ترخيص توضيحي'}
      ],
      question_bank_json: {questions: []}
    });
    assert.ok(html.includes('https://images.example/cover.jpg'), 'missing single-source cover in hero/modal: ' + design);
    assert.ok(html.includes('content="https://images.example/cover.jpg"'), 'Open Graph image should use the cover source: ' + design);
    assert.ok(html.includes('class="story-design-' + design + '"'), 'missing design class: ' + design);
    assert.ok(html.includes('story-visual-gallery'), 'missing image gallery: ' + design);
    assert.ok(html.includes('https://images.example/a.jpg'), 'missing first image: ' + design);
    assert.ok(html.includes('https://example.org/image-a'), 'missing image source link: ' + design);
    assert.ok(html.includes('ترخيص توضيحي'), 'missing image rights: ' + design);
    assert.ok(html.includes('معاينة خاصة غير منشورة'), 'preview safety banner missing: ' + design);
  });
});
test('AI story package validation enforces one localized cover and two to five fully documented images', function () {
  var validPackage = {
    section_key:'science', figure_name:'مثال', title:'عنوان', subtitle:'نبذة',
    narrator_name:'راوي', narrator_grade:'الصف السادس', karma_text:'كارما',
    history_note:'سياق', sources:'المصدر الأول https://example.org/source-a\nالمصدر الثاني https://example.net/source-b', images_note:'حقوق الصور', original_body:'هذا هو النص الأصلي الكامل الذي وصل من صاحب الحكاية دون أي تعديل أو حذف.',
    body:'هل تعلم؟ حقيقة موثقة أولى لاختبار الحزمة.\n\nهل تعلم؟ حقيقة موثقة ثانية لاختبار الحزمة.\n\nهل تعلم؟ حقيقة موثقة ثالثة لاختبار الحزمة.',
    cover:{url:'https://images.example/cover.jpg',alt:'غلاف أ',caption:'غلاف تجريبي',kind:'illustration',source_name:'المصدر أ',source_url:'https://source.example/cover',rights:'ترخيص موضح',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Cover '+lang,caption:'Cover caption '+lang,source_name:'Cover source '+lang,rights:'Illustration '+lang}]}))},
    visual_design:'science-lab', map_location:null,
    images:[
      {url:'https://images.example/a.jpg',alt:'صورة أ',caption:'أ',kind:'illustration',source_name:'المصدر أ',source_url:'https://source.example/a',rights:'ترخيص موضح',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Image A',caption:'Caption A',source_name:'Source A',rights:'License noted'}]}))},
      {url:'https://images.example/b.jpg',alt:'صورة ب',caption:'ب',kind:'diagram',source_name:'المصدر ب',source_url:'https://source.example/b',rights:'ترخيص موضح',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Image B',caption:'Caption B',source_name:'Source B',rights:'License noted'}]}))}
    ],
    translations:Object.fromEntries(['en','fr','it','de'].map(function(lang){var marker={en:'Did you know?',fr:'Le saviez-vous ?',it:'Lo sapevi?',de:'Wusstest du?'}[lang];return [lang,{student_name:'Name',grade:'Grade',title:'Title',subtitle:'Subtitle',karma_text:'Karma',body:[marker+' Fact one.',marker+' Fact two.',marker+' Fact three.'].join('\n\n'),history_note:'History',images_note:'Images'}]})),
    question_bank:{questions:Array.from({length:5},function(_,i){return {q:'Q'+i,o:['A','B'],a:0,e:'Explain',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{q:'Q'+i,o:['A','B'],e:'Explain'}]}))}})}
  };
  assert.ok(W.validateStoryPackage(validPackage).ok);
  var tooManyImages = Object.assign({}, validPackage, { images: validPackage.images.concat(validPackage.images, validPackage.images) });
  var tooManyResult = W.validateStoryPackage(tooManyImages);
  assert.ok(!tooManyResult.ok && tooManyResult.errors.some(function (error) { return /خمس صور/.test(error); }), 'gallery must reject more than five images');
  var invalidExtraImage = Object.assign({}, validPackage, { images: validPackage.images.concat([Object.assign({}, validPackage.images[0], { url: 'javascript:alert(1)' })]) });
  var invalidExtraResult = W.validateStoryPackage(invalidExtraImage);
  assert.ok(!invalidExtraResult.ok && invalidExtraResult.errors.some(function (error) { return /الصورة 3: url/.test(error); }), 'every gallery entry must have a safe URL, even when two other images are valid');
  var ambiguousCover = Object.assign({}, validPackage, { cover: Object.assign({}, validPackage.cover, { path: 'stories/history/preview/cover.jpg' }) });
  var ambiguousCoverResult = W.validateStoryPackage(ambiguousCover);
  assert.ok(!ambiguousCoverResult.ok && ambiguousCoverResult.errors.some(function (error) { return /مصدرًا واحدًا فقط/.test(error); }), 'cover must use either url or path, never both');
  var untranslatedCoverCredit = W.validateStoryPackage({cover:{url:'https://images.example/cover.jpg',alt:'غلاف',caption:'تعليق',source_name:'مصدر',source_url:'https://source.example/cover',rights:'ترخيص',kind:'illustration',i18n:{en:{alt:'Cover',caption:'Caption',source_name:'Cover source',rights:'Illustration'},fr:{alt:'Couverture',caption:'Légende',source_name:'Source de couverture',rights:'Illustration'},it:{alt:'Copertina',caption:'Didascalia',source_name:'Fonte copertina',rights:'Illustrazione'},de:{alt:'Titelbild',caption:'Bildunterschrift',source_name:'مصدر الغلاف',rights:'Illustration'}}}});
  assert.ok(untranslatedCoverCredit.errors.some(function(error){return /الغلاف:.*DE/.test(error)}), 'AI import validator must reject Arabic source metadata on the cover');
  var missingCover = { section_key:'science', figure_name:'مثال', title:'عنوان', subtitle:'نبذة', narrator_name:'راوي', narrator_grade:'الصف السادس', original_body:'هذا هو النص الأصلي الكامل الذي وصل من صاحب الحكاية دون أي تعديل أو حذف.', karma_text:'كارما', body:'هذا نص الراوي الذي يتجاوز خمسين حرفًا لتلبية شرط التحقق في الاختبار.', history_note:'سياق', sources:'المصدر الأول https://example.org/source-a\nالمصدر الثاني https://example.net/source-b', images_note:'حقوق الصور', visual_design:'science-lab', map_location:null, images:[], translations:{}, question_bank:{questions:[]} };
  var missingCoverResult = W.validateStoryPackage(missingCover);
  assert.ok(!missingCoverResult.ok && missingCoverResult.errors.some(function(error){return /cover/.test(error)}), 'a package without cover must be rejected for the missing cover contract');
  var noImages = Object.assign({}, missingCover, {cover: {url:'https://images.example/cover.jpg',alt:'غلاف',caption:'تعليق',kind:'illustration',source_name:'مصدر',source_url:'https://source.example/cover',rights:'ترخيص',i18n:Object.fromEntries(['en','fr','it','de'].map(function(lang){return [lang,{alt:'Cover',caption:'Caption',source_name:'Cover source',rights:'Illustration'}]}))}});
  assert.ok(W.validateStoryPackage(noImages).errors.some(function(error){return /صورتين موثقتين/.test(error)}), 'an empty image gallery must be rejected');
  assert.ok(bundle.includes('أضف صورتين على الأقل'));
});
test('Gemini is available in every admin story prompt flow with full story requirements', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.equal(admin.split("['gemini','Gemini']").length-1,4);
  assert.ok(admin.includes("gemini:mode==='package'?'أخرج كائن JSON واحدًا صالحًا للاستيراد فقط"));
  assert.ok(texts.includes('var STORY_PROVIDER_PROMPTS ='));
  assert.ok(texts.includes('"gemini":"# تعليمات تشغيل خاصة بـ Gemini'));
  ['original_body','كارما طفلة فضولية','الألمانية','خمسة أسئلة','source_url','visual_design','WhatsApp وFacebook','معاينة خاصة','موافقة صاحب المشروع الصريحة','لا تدّعِ تنفيذًا أو اختبارًا أو نشرًا لم يحدث بالفعل'].forEach(function(term){assert.ok(texts.includes(term),'Gemini prompt missing '+term)});
});
test('admin project instructions and AI provider prompts require custom layouts and image rights', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.ok(texts.includes('## 3) نظام التصميم الملزم — لا تكتفِ بوصفه للذكاء الاصطناعي'));
  assert.ok(texts.includes('visual_design'));
  assert.ok(texts.includes('source_url'));
  assert.ok(texts.includes('لا تجعل جميع الحكايات نسخة لونية واحدة.'));
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
  assert.ok(admin.includes("cover:it.cover||oldMetaForPackage.cover||null"), 'rebuilt AI JSON must preserve the existing cover metadata');
  assert.ok(admin.includes('draft.cover=draft.cover||meta.cover||null'), 'publishing must restore the cover from story_meta before validating and building the bundle');
  assert.ok(admin.includes("aiPasteStorageKey='kh-story-ai-paste:'+String(it._t||'k')+':'+String(it.id||'new')"), 'AI paste cache must be namespaced by record table and ID');
  assert.ok(admin.includes("else if(it.id){var legacyAiPaste=localStorage.getItem('kh-story-ai-paste:'+String(it.id))"), 'existing records should migrate cached AI text without sharing cache across new unsaved records');
  assert.ok(admin.includes('aiClear.disabled=aiPasteLocked'), 'clear action must remain disabled until the AI output field is unlocked');
  assert.ok(admin.includes("if(aiPasteLocked){aiSay('info','افتح الخانة بزر «تعديل» قبل مسح ناتج الذكاء الاصطناعي.');return}"), 'clear handler must enforce the lock state');
  assert.ok(admin.includes('aiJsonWasRepaired'));
  assert.ok(admin.includes('assets/ai-json-repair.js?v=20261021-3'));
  assert.ok(admin.includes("ai_imported_provider_label"));
  assert.ok(admin.includes("var hw=el('span','hidebtn-wrap')"));
  assert.ok(admin.includes('hw.title=reason'));
  assert.ok(admin.includes("if(it.status==='published'){nextMeta.pending_draft=Object.assign({},payload)"));
  assert.ok(admin.includes("if(lastReview.decision==='rejected'&&lastReview.reason)"));
  assert.ok(admin.includes("aiPreviewPopup.location.href=v2OnlyDraft?'../rebuild/package-review.html?draft=1&v=20261028-v2-review-1':'preview.html?story=1&submission='"), 'V2-only drafts must use the full-package reviewer while V1 imports retain the legacy preview');
  assert.ok(admin.includes("popup.location.href='../rebuild/package-review.html?draft=1&v=20261028-v2-review-1'"), 'manual save-and-preview must also route V2-only drafts to the full-package reviewer');
  assert.ok(admin.includes("['gemini','Gemini']"));
  assert.ok(preview.includes('id="aiVersionBadge"'));
  assert.ok(preview.includes("aiMeta.ai_imported_provider_label"));
  assert.ok(preview.includes('هذه معاينة غير منشورة'));
});
test('prompt manager preserves valid v4 customizations and migrates stale appended gates', function () {
  var vm = require('vm');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var start = admin.indexOf('function adoptPromptManagerState(raw)');
  var end = admin.indexOf('\nfunction managedCustomPromptText()', start);
  assert.ok(start >= 0 && end > start, 'prompt state migration helper must be isolatable');
  var helper = admin.slice(start, end);
  var legacyGate = 'بوابة الجودة الإلزامية للحكاية — إصدار 2026-10-21-هـ';
  function adopt(raw) {
    var context = {
      STORY_PAGE_PROMPT: 'DEFAULT MASTER\nالإصدار: 2026-10-23-v4',
      STORY_WORKFLOW: 'DEFAULT GUIDE\nالإصدار: 2026-10-23-v4',
      window: { STORY_PROVIDER_PROMPTS: { chatgpt: 'DEFAULT PROVIDER' } },
      promptManagerState: {},
      promptProvidersCache: { chatgpt: 'DEFAULT PROVIDER' },
      raw: raw
    };
    return JSON.parse(vm.runInNewContext(helper + '; adoptPromptManagerState(raw); JSON.stringify(promptManagerState)', context));
  }
  var valid = adopt({
    main: 'CUSTOM MASTER\nالإصدار: 2026-10-23-v4',
    workflow: 'CUSTOM GUIDE\nالإصدار: 2026-10-23-v4',
    custom: [{ name: 'extra', text: 'keep me' }],
    providers: { chatgpt: 'CUSTOM PROVIDER' },
    versions: [{ version: 'saved' }]
  });
  assert.equal(valid.main, 'CUSTOM MASTER\nالإصدار: 2026-10-23-v4', 'valid v4 master customizations must survive reload');
  assert.equal(valid.workflow, 'CUSTOM GUIDE\nالإصدار: 2026-10-23-v4', 'valid v4 workflow customizations must survive reload');
  assert.equal(valid.providers.chatgpt, 'CUSTOM PROVIDER', 'valid provider prompts must survive reload');
  assert.equal(valid.custom.length, 1, 'custom prompt entries must survive migration checks');
  var stale = adopt({
    main: 'STALE MASTER\nالإصدار: 2026-10-23-v4\n' + legacyGate,
    workflow: 'STALE GUIDE\nالإصدار: 2026-10-23-v4\n' + legacyGate,
    custom: [{ name: 'extra', text: 'keep me' }],
    providers: { chatgpt: 'STALE PROVIDER' }
  });
  assert.equal(stale.main, 'DEFAULT MASTER\nالإصدار: 2026-10-23-v4', 'legacy appended quality gates must be replaced by the canonical master');
  assert.equal(stale.workflow, 'DEFAULT GUIDE\nالإصدار: 2026-10-23-v4', 'legacy appended quality gates must be replaced by the canonical workflow guide');
  assert.equal(stale.providers.chatgpt, 'DEFAULT PROVIDER', 'stale provider prompts must be refreshed');
  assert.equal(stale.custom.length, 1, 'migration must preserve separately managed custom prompt entries');
});

test('prompt admin links to the canonical v4 files and avoids stale v3 links', function () {
  var promptAdmin = fs.readFileSync('khaledoon/prompts-admin.html','utf8');
  assert.ok(promptAdmin.includes('2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md'));
  assert.ok(promptAdmin.includes('assets/khaledoon-admin-texts.js?v=20261029-unified-reader-prompt-2'));
  assert.ok(promptAdmin.includes('ليست مستقلة'), 'prompt admin must explain that provider files accompany the master');
  assert.ok(!promptAdmin.includes('prompts/2026-10-22-unified-v3/'));
  ['MASTER-STORY-WORKFLOW.md','CHATGPT.md','CLAUDE.md','DEEPSEEK.md','GEMINI.md','WORKFLOW-CHECKLIST.md'].forEach(function(file){
    assert.ok(fs.existsSync('khaledoon/prompts/2026-10-23-unified-v4/'+file), 'v4 prompt artifact must exist: '+file);
  });
});
test('publisher duplicate-story guard normalizes actual whitespace', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  assert.ok(publisher.includes("normalize('NFKC').replace(/\\s+/g, ' ').trim()"), 'duplicate-title normalization must collapse real whitespace');
  assert.ok(!publisher.includes("replace(/\\\\s+/g, ' ')"), 'duplicate-title normalization must not match a literal backslash-s');
  var norm = function (value) { return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase(); };
  assert.equal(norm('  Naguib   Mahfouz  '), norm('Naguib Mahfouz'));
});

test('publisher rejects dot and empty path segments', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  assert.ok(publisher.includes('path.split("/").some((part) => part === "" || part === "." || part === "..")'),
    'publisher must reject empty, dot, and parent path segments before creating a Git tree');
  assert.ok(!publisher.includes('path.split("/").includes("..")'), 'parent-only rejection is insufficient');
});

test('unified v4 prompt requires safe automatic map linkage for verified locations', function () {
  var texts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  assert.ok(texts.includes('اربط الحكاية بالفهرس والخريطة تلقائيًا وفق بنية المشروع الحالية عند وجود مكان موثق.'));
  assert.ok(texts.includes('لا تخترع إحداثيات.'));
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
  assert.ok(workflow.includes('map_location يحتاج source_name مترجمًا إلى ar/en/fr/it/de'), 'AI map source names must be localized');
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

test('story publisher prevents concurrent same-story PR creation with a GitHub ref lock', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  var lockIndex = publisher.indexOf('const storyLockBranch = `khaledoon/publish-lock-${storyId}`');
  var blobLoopIndex = publisher.indexOf('for (const file of safeFiles)', lockIndex);
  assert.ok(lockIndex >= 0 && blobLoopIndex > lockIndex, 'publisher must acquire the per-story lock before creating file blobs');
  assert.ok(publisher.includes('ref: "refs/heads/" + storyLockBranch'), 'lock acquisition must use a fixed GitHub ref unique to the story ID');
  assert.ok(publisher.includes('lockDetail.includes("GitHub API 422")'), 'an already-existing lock must fail closed with a conflict response');
  assert.ok(publisher.includes('async function releaseStoryLock()'), 'publisher must have a lock cleanup path');
  assert.ok(publisher.includes('await releaseStoryLock();'), 'publisher must release the lock on success, duplicate reconciliation, and caught failure');
  assert.ok(publisher.includes('قفل قديم يحتاج مراجعة'), 'stale lock failures must explain the manual recovery condition');
});

test('story publisher attempts to reconcile same-story PRs created concurrently', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  assert.ok(publisher.includes('const racingPulls = await githubAllPages'), 'after PR creation, publisher must re-scan open PRs for a concurrent duplicate');
  assert.ok(publisher.includes('candidate.number < best.number'), 'when concurrent duplicates are visible, publisher must deterministically keep the lowest-numbered PR');
  assert.ok(publisher.includes('method: "PATCH", body: JSON.stringify({ state: "closed" })'), 'the later duplicate PR must be closed rather than left open');
  assert.ok(publisher.includes('git/refs/heads/${branchNameForRecovery}') && publisher.includes('method: "DELETE"'), 'duplicate cleanup must attempt to delete the duplicate branch');
  assert.ok(publisher.includes('return reply(409, {') && publisher.includes('أُغلق الطلب المكرر وبقي الطلب الأقدم'), 'the duplicate caller must receive a conflict response pointing to the retained PR');
  assert.ok(publisher.includes('branch cleanup is best effort'), 'branch cleanup failure must not pretend the duplicate PR remained open');
  // This is a source-contract guard, not a true concurrent integration test; GitHub API race behavior remains unverified.
});

test('story publisher creates review PRs and never updates main directly', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  var admin = fs.readFileSync('khaledoon/admin.html', 'utf8');
  assert.ok(publisher.includes('body: JSON.stringify({ ref: "refs/heads/" + branchNameForRecovery, sha: commit.sha })'));
  assert.ok(publisher.includes('/pulls'));
  assert.ok(publisher.includes('published_to_main: false'));
  assert.ok(publisher.includes('action === "verify_pr"'));
  assert.ok(publisher.includes('pull.head?.ref !== expectedBranch'));
  assert.ok(admin.includes("action:'verify_pr'"));
  assert.ok(admin.includes('branch:review.publish_branch'));
  assert.ok(admin.includes('publish_branch:result.branch||'));
  assert.ok(admin.includes("body:JSON.stringify({action:'capabilities'})"));
  assert.ok(admin.includes("capabilityResult.publisher_mode!=='draft_pr'"));
  assert.ok(admin.includes("capabilityResult.writes_main_directly!==false"));
  assert.ok(admin.includes('var publisherCapabilityBlocked=false'));
  assert.ok(admin.includes('if(!publisherCapabilityBlocked)'));
  assert.ok(admin.includes('publisherCapabilityBlocked=true'));
  assert.ok(admin.indexOf("body:JSON.stringify({action:'capabilities'})") < admin.indexOf("body:JSON.stringify({title:'مراجعة حكاية:"));
  assert.ok(publisher.includes('branch: branchNameForRecovery'));
  assert.ok(publisher.includes('pull.head?.repo?.full_name'));
  assert.ok(!publisher.includes('git/refs/heads/\u0024{BASE}'));
  
  assert.ok(admin.includes('publish_pr_url:result.pull_request_url'));
  assert.ok(admin.includes('طلب الدمج لم يُدمج بعد'));
  assert.ok(admin.includes('الموقع المنشور لم يتغير'));
  assert.ok(!admin.includes('!result.published_to_main'));
});

test('story i18n lookup supports both dictionary shapes and the real SVG artwork dictionary', function () {
  var vm = require('vm');
  var engine = fs.readFileSync('assets/shared/story-i18n.js','utf8');
  var match = engine.match(/function findTranslation\(source, lang\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'translation lookup helper must exist');
  var svgPrefix = 'var svgArtworkTranslations=';
  var svgStart = engine.indexOf(svgPrefix) + svgPrefix.length;
  var svgEnd = engine.indexOf(';\nfunction findTranslation', svgStart);
  assert.ok(svgStart >= svgPrefix.length && svgEnd > svgStart, 'actual SVG artwork dictionary must be isolated');
  var svgDictionary = JSON.parse(engine.slice(svgStart, svgEnd));
  var sourceFirst = { 'مرحبا': { en: 'Hello', fr: 'Bonjour' } };
  var languageFirst = { en: { 'مرحبا': 'Hello' }, fr: { 'مرحبا': 'Bonjour' }, de: { 'مرحبا': 'Hallo' } };
  function lookup(dictionary, lang, source) {
    var context = { translations: dictionary, window: { StoryI18N: { text: {} } }, svgArtworkTranslations: svgDictionary };
    return vm.runInNewContext(match[0] + '; findTranslation(' + JSON.stringify(source || 'مرحبا') + ', ' + JSON.stringify(lang) + ')', context);
  }
  assert.equal(lookup(sourceFirst, 'en').en, 'Hello');
  assert.equal(lookup(languageFirst, 'fr').fr, 'Bonjour');
  assert.equal(lookup(languageFirst, 'de').de, 'Hallo');
  assert.equal(lookup(languageFirst, 'en').en, 'Hello');
  assert.equal(lookup({}, 'en', 'حتشبسوت').en, 'Hatshepsut');
  assert.equal(lookup({}, 'de', 'خالدون عبر التاريخ · رسم توضيحي').de, 'Unsterbliche der Geschichte · Illustration');
});

test('unified v4 story prompt requires complete five-language verification', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  assert.ok(promptTexts.includes('الإصدار: 2026-10-23-v4'));
  assert.ok(promptTexts.includes('## 6) اللغات الخمس — اكتمال حقيقي'));
  assert.ok(promptTexts.includes('ar/en/fr/it/de'));
  assert.ok(promptTexts.includes('اختبر التبديل بين اللغات ثم الرجوع إلى لغة أخرى'));
  assert.ok(admin.includes('STORY_PAGE_PROMPT'));
});

test('unified v4 prompt requires sourced images and a rendered image gallery', function () {
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js','utf8');
  assert.ok(promptTexts.includes('## 4) الغلاف والصور — من البداية حتى آخر مشهد'));
  assert.ok(promptTexts.includes('source_name') && promptTexts.includes('source_url') && promptTexts.includes('rights'), 'prompt artifacts must retain source and rights fields');
  assert.ok(promptTexts.includes('أضف في `i18n` لكل لغة `en/fr/it/de` الحقول الأربعة مترجمة'), 'master prompt must require localized image source and rights metadata');
  assert.ok(admin.includes('i18n.en/fr/it/de لكل من alt وcaption وsource_name وrights'), 'AI schema must require translated image metadata');
  assert.ok(bundle.includes('add(lang,im.source_name,it.source_name);add(lang,im.rights,it.rights)'), 'generated translation dictionary must include image source and rights');

  assert.ok(promptTexts.includes('ظهور الصورة في نتائج البحث ليس إذنًا باستخدامها.'));
  assert.ok(bundle.includes('function imageGalleryHtml(d,baseUrl,section,id)'));
  assert.ok(bundle.includes('absoluteStoryImageUrl(im.url,baseUrl,section,id)'), 'gallery links and images must use resolved repository-root URLs');
  assert.ok(bundle.includes("'+gallery+'"));
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
});


test('AI JSON import repair handles common copy/paste formatting damage without changing source text', function () {
  var repair = require('../assets/ai-json-repair.js');
  var raw = 'Introductory text\n```json\n{"format":"KH_STORY_PACKAGE_V1","title":"T\\\\*itle","body":"line one\nline two","items":[1,2,],}\n```';
  var parsed = repair.parse(raw);
  assert.equal(parsed.value.format, 'KH_STORY_PACKAGE_V1');
  assert.equal(parsed.value.title, 'T*itle');
  assert.equal(parsed.value.body, 'line one\nline two');
  assert.equal(parsed.repaired, true);
  assert.ok(raw.includes('T\\\\*itle'), 'the pasted source remains unchanged');
});
test('AI JSON import selects the complete story package when pasted text contains duplicate objects or stray tags', function () {
  var repair = require('../assets/ai-json-repair.js');
  var raw = '{"format":"OTHER","title":"short"}\n</escape>\n{"format":"KH_STORY_PACKAGE_V1","title":"complete package","body":"longer valid body"}';
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

test('v4 prompt architecture uses one master prompt and concise provider instructions', function () {
  var promptTexts = fs.readFileSync('khaledoon/assets/khaledoon-admin-texts.js','utf8');
  var workflow = fs.readFileSync('docs/khaledoon-story-production-workflow.md','utf8');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  var promptAdmin = fs.readFileSync('khaledoon/prompts-admin.html','utf8');
  assert.ok(promptTexts.includes('الإصدار: 2026-10-23-v4'));
  assert.ok(promptTexts.includes('var STORY_PAGE_PROMPT ='));
  assert.ok(promptTexts.includes('var STORY_PROVIDER_PROMPTS ='));
  ['ChatGPT','Gemini','Claude','DeepSeek'].forEach(function(provider) {
    assert.ok(promptTexts.includes('# تعليمات تشغيل خاصة بـ ' + provider), 'missing concise provider instruction: '+provider);
  });
  assert.ok(admin.includes('البرومبت الموحد المعتمد — مرة واحدة فقط'));
  assert.ok(admin.includes('تعليمات الأداة المختارة'));
  assert.ok(!admin.includes("STORY_WORKFLOW = khAppendPromptOnce(STORY_WORKFLOW"));
  assert.ok(promptAdmin.includes('assets/khaledoon-admin-texts.js?v=20261029-unified-reader-prompt-2'));
  assert.ok(admin.includes('khaledoon-admin-texts.js?v=20261029-unified-reader-prompt-2'));
  assert.ok(workflow.includes('التنفيذ التلقائي لكل الحكايات ولكل أدوات الذكاء الاصطناعي'));
  assert.ok(admin.includes('PROJECT_INSTRUCTIONS'));
  var providerPromptDir = 'khaledoon/prompts/2026-10-23-unified-v4/';
  ['CHATGPT.md','CLAUDE.md','GEMINI.md','DEEPSEEK.md'].forEach(function (name) {
    var providerPrompt = fs.readFileSync(providerPromptDir + name, 'utf8');
    assert.ok(providerPrompt.length < 1800, name + ' should contain concise provider-specific guidance, not a duplicated master prompt');
    assert.ok(providerPrompt.includes('MASTER-STORY-WORKFLOW.md'), name + ' must point to the canonical master prompt');
    assert.ok(!providerPrompt.includes('# البرومبت الموحد المعتمد — خالدون عبر التاريخ'), name + ' must not duplicate the master prompt');
  });
});

test('Magdi Yacoub V2 package preserves the corrected five-language opening, documented photos, and verified map location', function () {
  var translations = fs.readFileSync('stories/science/015/translations.js', 'utf8');
  var opening = 'وُلد مجدي يعقوب في 16 نوفمبر 1935 بمدينة بلبيس بمحافظة الشرقية في مصر. ومنذ طفولته، تعرّف إلى عالم الطب من خلال والده الطبيب، ثم اختار أن يجعل علمه وعمله وسيلة لمساعدة المرضى.';
  assert.equal(translations.split('"' + opening + '":"').length - 1, 8, 'the corrected opening text node must retain exact EN/FR/IT/DE source-key coverage');
  assert.ok(translations.includes('Magdi Yacoub was born on 16 November 1935 in Belbeis'), 'English opening must match the corrected fact');
  assert.ok(translations.includes('Magdi Yacoub est né le 16 novembre 1935 à Belbeis'), 'French opening must match the corrected fact');
  assert.ok(translations.includes('Magdi Yacoub nacque il 16 novembre 1935 a Belbeis'), 'Italian opening must match the corrected fact');
  assert.ok(translations.includes('Magdi Yacoub wurde am 16. November 1935 in Belbeis'), 'German opening must match the corrected fact');
  assert.ok(!translations.includes('خصوصاً في أسوان، ولد طفل صغير'), 'the stale contradictory Aswan opening must not return');

  var magdiPage = fs.readFileSync('stories/science/015/index.html', 'utf8');
  var magdiExtra = fs.readFileSync('stories/science/015/translations-extra.js', 'utf8');
  var story = JSON.parse(fs.readFileSync('stories/science/015/data.v2.json', 'utf8'));
  var original = fs.readFileSync('stories/science/015/original.md', 'utf8')
    .replace(/^# النص الأصلي كما وصل دون تعديل\s*\n\n/, '').trimEnd();
  var places = JSON.parse(fs.readFileSync('stories/places.json', 'utf8'));
  assert.equal(story.format, 'KHALEDOON_STORY_V2');
  assert.equal(story.section, 'science');
  assert.equal(story.design.variant, 'portrait-biography');
  assert.equal(story.original_body, original, 'the submitted original_body must remain verbatim');
  assert.ok(story.i18n.ar.blocks.length >= 10, 'Arabic story keeps at least the established narrative blocks');
  assert.equal(story.quiz.length, 6, 'all six original quiz questions must be preserved');
  var correctedOpening = story.i18n.ar.blocks.find(function (block) { return block.heading === 'قلب ينبض بالحياة: حكاية صانع الأمل'; });
  assert.ok(correctedOpening && correctedOpening.text.includes('بلبيس') && !correctedOpening.text.includes('أسوان'), 'the reader-facing opening must use the corrected birthplace');

  var photos = story.images.filter(function (image) { return image.kind === 'photograph'; });
  var illustration = story.images.find(function (image) { return image.kind === 'illustration'; });
  assert.equal(photos.length, 2, 'the V2 gallery must contain two sourced photographs');
  assert.ok(illustration && illustration.path === 'stories/science/015/cover-popup.svg', 'the gallery must retain the original non-photographic illustration');
  var raafat = photos.find(function (image) { return image.source_url === 'https://commons.wikimedia.org/wiki/File:M_Yacoub.JPG'; });
  var lister = photos.find(function (image) { return image.source_url === 'https://commons.wikimedia.org/wiki/File:Yacoub_Lister_Medal_2015.JPG'; });
  assert.ok(raafat && raafat.path === 'assets/images/stories/M_Yacoub.jpg' && raafat.rights.includes('CC BY-SA 3.0'), 'the local Raafat photograph and CC BY-SA 3.0 credit must be preserved');
  assert.ok(lister && lister.url === 'https://commons.wikimedia.org/wiki/Special:FilePath/Yacoub_Lister_Medal_2015.JPG' && lister.rights.includes('CC BY-SA 4.0'), 'the Lister Medal photograph and CC BY-SA 4.0 credit must be preserved');
  assert.ok(story.sources.some(function (source) { return source.url === 'https://creativecommons.org/licenses/by-sa/3.0/'; }), 'the CC BY-SA 3.0 licence must be directly linked');
  assert.ok(story.sources.some(function (source) { return source.url === 'https://creativecommons.org/licenses/by-sa/4.0/'; }), 'the CC BY-SA 4.0 licence must be directly linked');
  assert.ok(story.sources.some(function (source) { return source.url === raafat.source_url; }), 'the Raafat Commons source page must be linked');
  assert.ok(story.sources.some(function (source) { return source.url === lister.source_url; }), 'the Lister Medal Commons source page must be linked');

  ['ar', 'en', 'fr', 'it', 'de'].forEach(function (lang) {
    assert.ok(story.i18n[lang].blocks.length >= 10, lang + ' must contain at least the established story blocks');
    assert.equal(story.i18n[lang].blocks.length, story.i18n.ar.blocks.length, lang + ' block count must match Arabic');
    assert.equal(story.i18n[lang].person, story.i18n[lang].figure_name, lang + ' person metadata must remain localized');
    [raafat, lister, illustration].forEach(function (image) {
      ['alt', 'caption', 'source_name', 'rights'].forEach(function (field) {
        assert.ok(image.i18n[lang][field] && image.i18n[lang][field].trim(), lang + ' image ' + field + ' must be present');
      });
    });
    story.sources.forEach(function (source) {
      assert.ok(source.i18n[lang].title && source.i18n[lang].organization, lang + ' source title and organization must be translated');
    });
    story.quiz.forEach(function (question) {
      assert.ok(question.i18n[lang].question && question.i18n[lang].options.length === 4 && question.i18n[lang].explanation, lang + ' quiz question must be complete');
    });
  });
  assert.equal(lister.i18n.en.caption, 'Magdi Yacoub receives the 2015 Lister Medal.', 'the Lister photo caption must use the concise translated caption');
  assert.ok(magdiExtra.includes('"الدكتور مجدي يعقوب يتسلم ميدالية ليستر عام 2015.":"Magdi Yacoub receives the 2015 Lister Medal."'), 'the concise Lister caption must remain in the translation dictionary');

  assert.equal(story.map_location.lat, places['015'].lat);
  assert.equal(story.map_location.lng, places['015'].lng);
  assert.deepEqual(story.map_location.place, places['015'].place, 'the V2 map location must match the verified Belbeis place record');
  assert.ok(magdiPage.includes('data-kh-v2-reader') && magdiPage.includes('data-story-path="data.v2.json"'), 'Magdi page must use the shared V2 reader');
  assert.ok(magdiPage.includes('rebuild/reader.js') && magdiPage.includes('khaledoon-story-map-link.js'), 'V2 reader and interactive 3D map link must be connected');
  assert.ok(magdiPage.includes('id="site-brand"'), 'the shared reader must localize the site brand');
});
 
console.log('\n' + passed + ' integration checks passed' + (process.exitCode ? ', with failures' : ''));


test('hidden-story deletion is review-only until a merged deletion PR is verified', function () {
  var edge = fs.readFileSync('supabase/functions/delete-hidden-story/index.ts','utf8');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  assert.ok(edge.includes('body?.action === "capabilities"') && edge.includes('deletion_mode: "draft_pr"'), 'delete function must advertise safe PR mode');
  assert.ok(edge.includes('async function githubAllPages(') && edge.includes('page=${page}') && edge.includes('batch.length < 100'), 'deletion must paginate pull-request searches instead of scanning only the first 100 results');
  assert.ok(edge.includes('refusing to continue with incomplete pull-request results'), 'deletion must fail closed if pagination exceeds its safety cap');
  assert.ok(edge.includes('githubAllPages(`/repos/${OWNER}/${REPO}/pulls?state=open&base=${BASE}`, githubToken)'), 'duplicate-deletion search must scan all open PR pages');
  assert.ok(edge.includes('githubAllPages(`/repos/${OWNER}/${REPO}/pulls?state=closed&base=${BASE}`, githubToken)'), 'post-merge deletion recovery must scan all closed PR pages');
  assert.ok(edge.includes('head: branchName, base: BASE, body: description, draft: true'), 'hidden-story deletion must create a draft PR');
  assert.ok(!edge.includes('github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {'), 'delete function must never update main directly');
  assert.ok(!edge.includes('method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false })'), 'delete function must not fast-forward main');
  assert.ok(edge.includes('const mergedPull') && edge.includes('remainingStoryFiles || quizStillExists'), 'visibility cleanup must verify the merged PR removed story and quiz files');
  assert.ok(edge.includes('delete places[id]'), 'deletion PR must remove the story map marker as well as the index entry');
  assert.ok(edge.includes('branchNameForRecovery = branchName') && edge.includes('branch: branchNameForRecovery || null'), 'a failed PR creation must return the branch name for recovery');
  assert.ok(edge.indexOf('const mergedPull') < edge.indexOf('supabase.from("story_visibility").delete()'), 'visibility row must remain until a merged deletion PR is verified');
  assert.ok(admin.includes("JSON.stringify({action:'capabilities'})") && admin.includes("capability.deletion_mode!=='draft_pr'"), 'admin must gate deletion on the deployed safe-mode capability');
  assert.ok(admin.includes("JSON.stringify({action:'delete_or_verify',story_id:String(s.id).padStart(3,'0')})"), 'admin must request PR creation or post-merge verification');
  var deleteStart = admin.indexOf('async function deleteHiddenStory');
  var deleteEnd = admin.indexOf('function vcount', deleteStart);
  var deleteBlock = admin.slice(deleteStart, deleteEnd);
  assert.ok(deleteBlock.indexOf("JSON.stringify({action:'capabilities'})") < deleteBlock.indexOf("JSON.stringify({action:'delete_or_verify'"), 'delete capability handshake must run before any destructive story ID request');
  assert.ok(admin.indexOf('if(result.pending===true)') < admin.indexOf('delete vHidden[String(s.id)]'), 'a pending deletion PR must not remove the hidden status from the admin view');
  assert.ok(edge.includes('replace(/\\s/g, "")'), 'GitHub base64 content must remove actual whitespace before decoding');
  assert.ok(!edge.includes('replace(/\\\\s/g, "")'), 'base64 normalization must not match a literal backslash-s');
  assert.ok(edge.includes('String(entry.path ?? "").replace(/\\/$/, "")'), 'story path normalization must remove a trailing forward slash');
  assert.ok(edge.includes('JSON.stringify(index, null, 2) + "\\n"'), 'index JSON must end with an actual newline escape, not a literal backslash-n');
  assert.ok(edge.includes('JSON.stringify(places, null, 2) + "\\n"'), 'map JSON must end with an actual newline escape, not a literal backslash-n');
  assert.ok(edge.includes('`<!-- khaledoon-delete-story:${id}:${storyPath} -->\\n\\n`'), 'deletion PR marker must be followed by real line breaks');
});



test('story publisher creates a draft PR and confirms it was merged before marking live', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts','utf8');
  var admin = fs.readFileSync('khaledoon/admin.html','utf8');
  assert.ok(publisher.includes('method: "POST"') && publisher.includes('ref: "refs/heads/" + branchNameForRecovery'), 'story commits must be placed on a dedicated branch');
  assert.ok(publisher.includes('head: branchNameForRecovery, base: BASE, body: prBody, draft: true'), 'publishing must open a draft pull request for human review');
  assert.ok(publisher.includes('const prMarker = `<!-- khaledoon-story:${storyId}:${normalizedRoot} -->`'), 'each publication PR must carry a stable story marker');
  assert.ok(publisher.includes('async function githubAllPages(') && publisher.includes('page=${page}') && publisher.includes('batch.length < 100'), 'publisher must paginate pull-request searches instead of silently scanning only the first 100 results');
  assert.ok(publisher.includes('refusing to continue with incomplete pull-request results'), 'publisher must fail closed if pagination exceeds its safety cap');
  assert.ok(publisher.includes('githubAllPages(`/repos/${OWNER}/${REPO}/pulls?state=open&base=${BASE}`, githubToken)'), 'duplicate-publication search must scan every page of open PRs');
  assert.ok(publisher.includes('if (existingPull)') && publisher.includes('لم ننشئ نسخة ثانية'), 'an existing open PR must prevent duplicate publication branches');
  assert.ok(publisher.includes('published_to_main: false'), 'a created PR must never be reported as already published');
  assert.ok(publisher.includes('if (existingIndex < 0 || previousRoot)') && publisher.includes('Story page path already exists on main but is missing from stories/index.json'), 'publisher must refuse to overwrite an unindexed existing story path');
  assert.ok(publisher.includes("'/contents/stories/index.json?ref=' + baseSha") && publisher.includes("'/contents/stories/places.json?ref=' + baseSha"), 'index and map reads must use the exact commit used as the PR base');
  assert.ok(publisher.includes('body?.action === "capabilities"') && publisher.includes('publisher_mode: "draft_pr"'), 'publisher must advertise its safe mode before the admin uploads files');
  assert.ok(publisher.includes('body?.action === "verify_pr"'), 'publisher must expose an authenticated PR-state verification action');
  assert.ok(publisher.includes('pull.head?.ref !== expectedBranch'), 'PR verification must match the exact recorded branch, not an arbitrary PR to main');
  assert.ok(publisher.includes('merged: pull.merged === true || Boolean(pull.merged_at)'), 'PR verification must report GitHub merge state');
  assert.ok(!publisher.includes('github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {'), 'publisher must not patch the main ref');
  assert.ok(!publisher.includes('method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false })'), 'publisher must not fast-forward main directly');
  assert.ok(admin.includes('publish_pr_number:result.pull_request_number'), 'admin must retain the created PR number for later verification');
  assert.ok(admin.includes("action:'verify_pr',pull_request_number:review.publish_pr_number,branch:review.publish_branch"), 'admin must verify the exact recorded PR branch before confirming publication');
  var publishStart = admin.indexOf('async function submitStoryPublishPR');
  var publishEnd = admin.indexOf('async function confirmStoryPublishAfterUpload', publishStart);
  var publishBlock = admin.slice(publishStart, publishEnd);
  assert.ok(publishBlock.includes('if(!statusResult.merged){window.open(review.publish_pr_url') && publishBlock.indexOf('if(!statusResult.merged)') < publishBlock.indexOf('published_to_main_at:new Date().toISOString()'), 'an open PR must not be marked as published');
  assert.ok(admin.includes('if(!review.publish_pr_number||!review.publish_branch)') && admin.includes('لم نؤكد النشر'), 'legacy PR records without a verifiable number must not bypass merge verification');
  assert.ok(admin.includes('result.published_to_main!==false'), 'admin must reject the old direct-main response contract');
  var submitStart = admin.indexOf('async function submitStoryPublishPR');
  var submitEnd = admin.indexOf('async function confirmStoryPublishAfterUpload', submitStart);
  var submitBlock = admin.slice(submitStart, submitEnd);
  assert.ok(submitBlock.indexOf('if(review.publish_pr_url)') < submitBlock.indexOf("if(review.decision!=='approved_waiting_for_github_upload')"), 'existing PR links must remain accessible after the story is confirmed published');
  assert.ok(admin.includes("JSON.stringify({action:'capabilities'})") && admin.includes("capabilityResult.publisher_mode!=='draft_pr'"), 'admin must stop before upload when the deployed function is still the legacy direct-main publisher');
  var capIndex = admin.indexOf("JSON.stringify({action:'capabilities'})", submitStart);
  var bundleIndex = admin.indexOf('var pack;', submitStart);
  var unifiedBuilderIndex = admin.indexOf('window.KHStoryV2Publisher.buildFiles', submitStart);
  assert.ok(capIndex >= 0 && bundleIndex > capIndex && unifiedBuilderIndex > capIndex, 'capability handshake must run before either unified or October compatibility bundle generation');
});



test('story generation uses a stable shared theme asset and fails closed when it cannot load', function () {
  var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
  var theme = fs.readFileSync('khaledoon/assets/story-theme-template.css', 'utf8');
  assert.ok(theme.length > 5000, 'canonical shared theme should contain the full approved story design');
  assert.ok(bundle.includes("fetch('../khaledoon/assets/story-theme-template.css',{cache:'no-store'})"), 'new stories must use the stable shared theme asset rather than borrowing story 005 CSS');
  assert.ok(bundle.includes('if(!themeResponse.ok)throw new Error('), 'theme load failure must stop bundle generation instead of silently emitting an unstyled page');
  assert.ok(!bundle.includes("fetch('../stories/history/005/theme.css'"), 'future edits to story 005 must not silently alter every new story theme');
});


test('story builder derives the site base path from its current deployment instead of hard-coding the GitHub Pages repo path', function () {
  var bundle = fs.readFileSync('khaledoon/assets/story-template-bundle.js', 'utf8');
  assert.ok(bundle.includes('function siteBaseUrl()'), 'builder must centralize deployment base URL detection');
  assert.ok(bundle.includes("path.indexOf('/khaledoon/')"), 'builder must detect the repository prefix from its own admin/builder path');
  assert.ok(bundle.includes("var liveUrl=siteBaseUrl()+'/stories/'"), 'legacy story existence checks must use the detected site base path');
  assert.ok(bundle.includes("baseUrl=siteBaseUrl()"), 'generated og:image and local image URLs must use the detected site base path');
  assert.ok(!bundle.includes("location.origin+'/nourdeen-october-1973"), 'builder must not generate incorrect repository URLs when run on localhost or a root-hosted staging site');
});


test('unified publisher requires an approved canonical package from its source record', function () {
  var publisher = fs.readFileSync('supabase/functions/publish-story-pr/index.ts', 'utf8');
  var admin = fs.readFileSync('khaledoon/admin.html', 'utf8');
  assert.ok(publisher.includes('requires_submission_id: true'));
  assert.ok(publisher.includes('supports_v2_publish: true'));
  assert.ok(publisher.includes('body.submission_table'));
  assert.ok(publisher.includes('body.submission_id'));
  assert.ok(publisher.includes('.from(submissionTable).select("id,story_meta").eq("id", submissionId).maybeSingle()'));
  assert.ok(publisher.includes('sourceMeta.v2_only_draft === true || pendingMeta.v2_only_draft === true'));
  assert.ok(publisher.includes('const savedV2Package: any ='));
  assert.ok(publisher.includes('review.decision !== "approved_waiting_for_github_upload"'));
  assert.ok(publisher.includes('stableJson(packageData) !== stableJson(savedV2Package)'));
  var packageGuard = publisher.indexOf('if (isV2OnlyDraft) {');
  var branchWrite = publisher.indexOf('await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {');
  var prWrite = publisher.indexOf('await github(`/repos/${OWNER}/${REPO}/pulls`, githubToken, {');
  assert.ok(packageGuard >= 0 && branchWrite > packageGuard && prWrite > packageGuard, 'canonical package checks must run before branch or PR creation');
  assert.ok(publisher.includes('published_to_main: false'));
  assert.ok(admin.includes("submission_id:String(it.id||''),submission_table:it._t==='o'?'submitted_stories':'khaledoon_submissions'"));
  assert.ok(admin.includes('capabilityResult.requires_submission_id!==true'));
  assert.ok(admin.includes('capabilityResult.rejects_v2_only_drafts!==true'));
  assert.ok(admin.includes('var requireV2ForNewStory=!isOctoberLegacyRecord(it)'));
  assert.ok(admin.includes('if(!isOctoberLegacyRecord(it)&&!v2Only)'), 'non-October stories must never use the legacy publisher even if they predate the unified package');
});
