import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStory, validateForAdminBridge } from '../validate-story.mjs';
import { storyToAdminDraft } from '../adapters/story-package-adapter.mjs';

test('admin import exposes unified story validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../../khaledoon/story-builder.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-story-import.mjs?v=20261101-story-publisher-1"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-story-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/story-package-adapter.mjs?v=20261101-story-package-adapter-1'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261101-story-package-adapter-1'"));
  assert.match(html, /function isOctoberLegacyRecord\(it\)/);
  assert.match(html, /var requireUnifiedStoryPackage=!isOctoberLegacyRecord\(it\)/, 'all non-October records must use the unified package');
  assert.doesNotMatch(html, /hasExplicitLegacyPackage/, 'editing an old record must not force unified story just because it lacks an explicit legacy package');
  assert.match(html, /requireUnifiedStoryPackage&&aiInputFormat!=='KHALEDOON_STORY'/, 'new stories must reject legacy and untagged JSON');
  assert.match(html, /story_contract_required=true/, 'new unified story contract requirement persists for later edits');
  assert.match(html, /STORY-PACKAGE-PROMPT\.md/);
  assert.match(html, /rebuild\/story-contract\.json/);
  assert.match(html, /pkg&&isStoryPackageFormat\(pkg\.format\)/);
  assert.match(html, /var storyValidationErrors=storyAdapter\.validateStory\(pkg\)/);
  assert.match(html, /pkg=storyAdapter\.storyToAdminDraft\(pkg\)/);
  assert.match(html, /nextMeta\.story_package=storyPackageRaw/);
  assert.ok(html.includes("package-review.html?draft=1"), 'unified story-only drafts should use the full-package read-only preview');
  assert.match(builder, /package-review\.html\?v=20261101-story-review-1/);
  assert.ok(html.includes('function isStoryOnlyDraftRecord(it)'), 'admin should identify top-level and pending unified story-only drafts');
  assert.ok(html.includes('bSave.disabled=true;bPub.disabled=true;'), 'legacy projection must not be saved as if it were the authoritative unified story package');
  assert.ok(html.includes("storyPackageDirect=storyPendingDirect&&(storyPendingDirect.story_only_draft||storyPendingDirect.v2_only_draft)?(storyPendingDirect.story_package||storyPendingDirect.v2_package):((storyMetaDirect.story_only_draft||storyMetaDirect.v2_only_draft)?(storyMetaDirect.story_package||storyMetaDirect.v2_package):null)"), 'manual preview should open the saved unified story package without persisting legacy projection edits');
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.ok(html.includes("story-template-bundle.js?v=20261027-source-clean-2"));
  assert.ok(html.includes("sources:aiInputFormat==='KHALEDOON_STORY'?String(pkg.sources||''):String(pkg.sources||'').slice(0,3000)"), 'unified story source text must remain complete while legacy imports retain its historical 3000-character cap');
  assert.ok(html.includes("aiInputFormat==='KHALEDOON_STORY'&&visibleSourceLength>3000"), 'only unified story imports should reject source text exceeding the visible-character limit');
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON الناتج من البرومبت الموحد/);
  assert.match(html, /MASTER-STORY-WORKFLOW\.md/);
  assert.match(html, /providerPromptFile=\{chatgpt:'CHATGPT\.md',gemini:'GEMINI\.md',claude:'CLAUDE\.md',deepseek:'DEEPSEEK\.md'\}/);
  assert.match(html, /storyContext= inputData|storyContext=inputData/);
  assert.match(html, /requested_section:sectionAliases/);
});


test('valid unified story package beyond the legacy bridge is saved through a complete, non-publishable projection', async () => {
  const packageUrl = new URL('../story-packages/october-sea-men.v2.json', import.meta.url);
  const pkg = JSON.parse(await readFile(packageUrl, 'utf8'));
  assert.deepEqual(validateStory(pkg), []);
  const bridgeErrors = validateForAdminBridge(pkg);
  assert.ok(bridgeErrors.some(e => e.includes('supports exactly 5 quiz questions')));
  const draft = storyToAdminDraft(pkg);
  assert.equal(draft.format, 'KH_STORY_PACKAGE_V1');
  assert.equal(draft.section_key, 'october');
  assert.equal(draft.original_body, pkg.original_body);
  assert.equal(draft.question_bank.questions.length, 23);
  assert.equal(JSON.parse(JSON.stringify(draft.question_bank)).questions.length, pkg.quiz.length);
  assert.equal(draft.images.length, pkg.images.length);
  assert.equal(draft.cover.kind, 'archival', 'legacy projection maps unsupported photo kind only for display/storage compatibility');
  assert.equal(pkg.cover.kind, 'photograph', 'authoritative unified story package must remain unchanged');
});


test('source story text and all original figure captions remain archived for editorial review', async () => {
  const packageUrl = new URL('../story-packages/october-sea-men.v2.json', import.meta.url);
  const figuresUrl = new URL('../story-packages/source-archives/october-sea-men-original-figures.json', import.meta.url);
  const pkg = JSON.parse(await readFile(packageUrl, 'utf8'));
  const figures = JSON.parse(await readFile(figuresUrl, 'utf8'));
  assert.ok(pkg.original_body.length > 5500);
  assert.ok(pkg.original_body.includes('النصر لا يصنعه بطل واحد'));
  assert.ok(pkg.original_body.includes('كيف تُقرأ الخريطة البحرية؟'));
  assert.equal(figures.figure_count, 9);
  assert.equal(figures.figures.length, 9);
  assert.ok(figures.figures.every(item => item.raw_html.includes('<figure') && item.raw_html.includes('<img')));
});
test('prompt administration links the dedicated unified story package instructions', async () => {
  const promptAdmin = await readFile(new URL('../../khaledoon/prompts-admin.html', import.meta.url), 'utf8');
  const prompt = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/STORY-PACKAGE-PROMPT.md', import.meta.url), 'utf8');
  assert.ok(promptAdmin.includes('STORY-PACKAGE-PROMPT.md'));
  assert.ok(prompt.includes('KHALEDOON_STORY'));
  assert.ok(prompt.includes('استلام الأصل'));
  assert.ok(prompt.includes('التدقيق التاريخي'));
  assert.ok(prompt.includes('الاعتماد والنشر'));
  assert.ok(prompt.includes('كائن JSON واحدًا فقط'));
});


test('unified package is mandatory for every non-October story, including legacy records', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const guard = html.split('\n').find(line => line.startsWith('function isOctoberLegacyRecord('));
  const exprLine = html.split('\n').find(line => line.includes('var requireUnifiedStoryPackage='));
  const expr = exprLine && exprLine.match(/var requireUnifiedStoryPackage=(.*);/);
  assert.ok(guard && expr, 'October exception and unified policy must exist');
  const requires = new Function('it', guard + '; return ' + expr[1] + ';');

  assert.equal(requires({ id: 'legacy-123', section: 'history', story_meta: {} }), true, 'old non-October record must use the unified package when edited');
  assert.equal(requires({ id: 'new-123', section: 'science', story_meta: {} }), true, 'new story must use the unified package');
  assert.equal(requires({ id: 'old-october-123', _t: 'o', status: 'published', story_meta: {} }), false, 'October submission table keeps its existing workflow');
  assert.equal(requires({ id: 'old-october-456', section: 'october', status: 'published', story_meta: {} }), false, 'October section records keep their existing workflow');
  assert.equal(requires({ id: 'old-non-october-789', section: 'science', story_meta: { pending_draft: { section_key: 'october' } } }), true, 'pending draft metadata cannot exempt a non-October source record from the unified package');
  assert.match(html, /requireUnifiedStoryPackage&&aiInputFormat!=='KHALEDOON_STORY'/, 'non-October records must reject the old package format');
  assert.ok(html.includes('if(requireUnifiedStoryPackage)nextMeta.story_contract_required=true'));
  assert.ok(html.includes('if(storyOnlyDraft){nextMeta.story_only_draft=true'));
  assert.ok(html.includes('if(!isOctoberLegacyRecord(it)&&!storyOnly)'), 'non-October records must be blocked from the legacy publish path');
  assert.ok(html.includes('if(!isOctoberLegacyRecord(it)){bSave.disabled=true;bPub.disabled=true;'), 'legacy save and preview controls must be disabled for every non-October record');
  assert.ok(html.includes('هذه الحكاية خارج قسم أكتوبر؛ أوقفنا الحفظ والمعاينة من المسار القديم.'), 'legacy records must be directed to the unified package workflow');
});
