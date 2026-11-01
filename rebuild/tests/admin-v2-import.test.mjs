import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStory, validateForAdminBridge } from '../validate-story.mjs';
import { v2ToAdminDraft } from '../adapters/v1-v2.mjs';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../../khaledoon/story-builder.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-v2-import.mjs?v=20261031-v2-publisher-1"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/v1-v2.mjs?v=20261031-v2-publisher-1'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261031-v2-publisher-1'"));
  assert.match(html, /function isOctoberLegacyRecord\(it\)/);
  assert.match(html, /var requireV2ForNewStory=!isOctoberLegacyRecord\(it\)/, 'all non-October records must use the unified package');
  assert.doesNotMatch(html, /hasExplicitLegacyV1Package/, 'editing an old record must not force V2 just because it lacks an explicit V1 package');
  assert.match(html, /requireV2ForNewStory&&aiInputFormat!=='KHALEDOON_STORY_V2'/, 'new stories must reject V1 and untagged JSON');
  assert.match(html, /v2_contract_required=true/, 'new V2 contract requirement persists for later edits');
  assert.match(html, /V2-STORY-PACKAGE-PROMPT\.md/);
  assert.match(html, /rebuild\/story-contract\.json/);
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2ValidationErrors=v2Adapter\.validateV2\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToAdminDraft\(pkg\)/);
  assert.match(html, /nextMeta\.v2_package=v2PackageRaw/);
  assert.ok(html.includes("package-review.html?draft=1"), 'V2-only drafts should use the full-package read-only preview');
  assert.match(builder, /package-review\.html\?v=20261028-v2-review-1/);
  assert.ok(html.includes('function isV2OnlyDraftRecord(it)'), 'admin should identify top-level and pending V2-only drafts');
  assert.ok(html.includes('bSave.disabled=true;bPub.disabled=true;'), 'legacy projection must not be saved as if it were the authoritative V2 package');
  assert.ok(html.includes("v2PackageDirect=v2PendingDirect&&v2PendingDirect.v2_only_draft?v2PendingDirect.v2_package:(v2MetaDirect.v2_only_draft?v2MetaDirect.v2_package:null)"), 'manual preview should open the saved V2 package without persisting legacy projection edits');
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.ok(html.includes("story-template-bundle.js?v=20261027-source-clean-2"));
  assert.ok(html.includes("sources:aiInputFormat==='KHALEDOON_STORY_V2'?String(pkg.sources||''):String(pkg.sources||'').slice(0,3000)"), 'V2 source text must remain complete while legacy V1 retains its historical 3000-character cap');
  assert.ok(html.includes("aiInputFormat==='KHALEDOON_STORY_V2'&&visibleSourceLength>3000"), 'only V2 imports should reject source text exceeding the visible-character limit');
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON الناتج من البرومبت الموحد/);
  assert.match(html, /MASTER-STORY-WORKFLOW\.md/);
  assert.match(html, /providerPromptFile=\{chatgpt:'CHATGPT\.md',gemini:'GEMINI\.md',claude:'CLAUDE\.md',deepseek:'DEEPSEEK\.md'\}/);
  assert.match(html, /storyContext= inputData|storyContext=inputData/);
  assert.match(html, /requested_section:sectionAliases/);
});


test('valid V2 package beyond the V1 bridge is saved through a complete, non-publishable projection', async () => {
  const packageUrl = new URL('../story-packages/october-sea-men.v2.json', import.meta.url);
  const pkg = JSON.parse(await readFile(packageUrl, 'utf8'));
  assert.deepEqual(validateStory(pkg), []);
  const bridgeErrors = validateForAdminBridge(pkg);
  assert.ok(bridgeErrors.some(e => e.includes('supports exactly 5 quiz questions')));
  const draft = v2ToAdminDraft(pkg);
  assert.equal(draft.format, 'KH_STORY_PACKAGE_V1');
  assert.equal(draft.section_key, 'october');
  assert.equal(draft.original_body, pkg.original_body);
  assert.equal(draft.question_bank.questions.length, 23);
  assert.equal(JSON.parse(JSON.stringify(draft.question_bank)).questions.length, pkg.quiz.length);
  assert.equal(draft.images.length, pkg.images.length);
  assert.equal(draft.cover.kind, 'archival', 'legacy projection maps unsupported photo kind only for display/storage compatibility');
  assert.equal(pkg.cover.kind, 'photograph', 'authoritative V2 package must remain unchanged');
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
test('prompt administration links the dedicated V2 package instructions', async () => {
  const promptAdmin = await readFile(new URL('../../khaledoon/prompts-admin.html', import.meta.url), 'utf8');
  const prompt = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/V2-STORY-PACKAGE-PROMPT.md', import.meta.url), 'utf8');
  assert.ok(promptAdmin.includes('V2-STORY-PACKAGE-PROMPT.md'));
  assert.ok(prompt.includes('KHALEDOON_STORY_V2'));
  assert.ok(prompt.includes('استلام الأصل'));
  assert.ok(prompt.includes('التدقيق التاريخي'));
  assert.ok(prompt.includes('الاعتماد والنشر'));
  assert.ok(prompt.includes('كائن JSON واحدًا فقط'));
});


test('unified package is mandatory for every non-October story, including legacy records', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const guard = html.split('\n').find(line => line.startsWith('function isOctoberLegacyRecord('));
  const exprLine = html.split('\n').find(line => line.includes('var requireV2ForNewStory='));
  const expr = exprLine && exprLine.match(/var requireV2ForNewStory=(.*);/);
  assert.ok(guard && expr, 'October exception and unified policy must exist');
  const requires = new Function('it', guard + '; return ' + expr[1] + ';');

  assert.equal(requires({ id: 'legacy-123', section: 'history', story_meta: {} }), true, 'old non-October record must use the unified package when edited');
  assert.equal(requires({ id: 'new-123', section: 'science', story_meta: {} }), true, 'new story must use the unified package');
  assert.equal(requires({ id: 'old-october-123', _t: 'o', status: 'published', story_meta: {} }), false, 'October submission table keeps its existing workflow');
  assert.equal(requires({ id: 'old-october-456', section: 'october', status: 'published', story_meta: {} }), false, 'October section records keep their existing workflow');
  assert.equal(requires({ id: 'old-non-october-789', section: 'science', story_meta: { pending_draft: { section_key: 'october' } } }), true, 'pending draft metadata cannot exempt a non-October source record from the unified package');
  assert.match(html, /requireV2ForNewStory&&aiInputFormat!=='KHALEDOON_STORY_V2'/, 'non-October records must reject the old package format');
  assert.ok(html.includes('if(requireV2ForNewStory)nextMeta.v2_contract_required=true'));
  assert.ok(html.includes('if(v2OnlyDraft){nextMeta.v2_only_draft=true'));
  assert.ok(html.includes('if(!isOctoberLegacyRecord(it)&&!v2Only)'), 'non-October records must be blocked from the legacy publish path');
  assert.ok(html.includes('if(isV2OnlyDraftRecord(it)){bSave.disabled=true;bPub.disabled=true;'), 'legacy save and publish controls stay disabled for authoritative unified drafts');
});
