import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStory, validateForAdminBridge } from '../validate-story.mjs';
import { v2ToAdminDraft } from '../adapters/v1-v2.mjs';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../../khaledoon/story-builder.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-v2-import.mjs?v=20261028-v2-admin-6"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/v1-v2.mjs?v=20261028-v2-admin-6'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261028-v2-admin-6'"));
  assert.match(html, /var requireV2ForNewStory=!it\.id\|\|!!\(it\.story_meta&&it\.story_meta\.v2_contract_required\)\|\|isV2OnlyDraftRecord\(it\)/);
  assert.doesNotMatch(html, /hasExplicitLegacyV1Package/, 'editing an old record must not force V2 just because it lacks an explicit V1 package');
  assert.match(html, /requireV2ForNewStory&&aiInputFormat!=='KHALEDOON_STORY_V2'/, 'new stories must reject V1 and untagged JSON');
  assert.match(html, /v2_contract_required=true/, 'new V2 contract requirement persists for later edits');
  assert.match(html, /V2-STORY-PACKAGE-PROMPT\.md/);
  assert.match(html, /rebuild\/story-contract\.json/);
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2ValidationErrors=v2Adapter\.validateV2\(pkg\)/);
  assert.match(html, /var v2Errors=v2Adapter\.validateForAdminBridge\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToV1\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToAdminDraft\(pkg\)/);
  assert.match(html, /nextMeta\.v2_package=v2PackageRaw/);
  assert.match(html, /if\(meta\.v2_only_draft\|\|\(meta\.pending_draft&&meta\.pending_draft\.v2_only_draft\)\)/);
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


test('V2 requirement separates new stories from legacy records and keeps V2-only records on V2', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  const submit = await readFile(new URL('../../khaledoon/submit.html', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../../khaledoon/story-builder.html', import.meta.url), 'utf8');
  assert.match(submit, /story_meta:\{v2_contract_required:true,source:'public_submission'\}/, 'new public submissions must persist the V2-required marker');
  assert.match(builder, /if\(!d\.submission_id\)meta\.v2_contract_required=true/, 'new manual-builder records must persist the V2-required marker');
  const guard = html.match(/function isV2OnlyDraftRecord\(it\)\{[^\n]*?\}(?=\n)/);
  const expr = html.match(/var requireV2ForNewStory=([^;\n]+);/);
  assert.ok(guard && expr, 'policy expression must be present');
  const requires = new Function('draftNew', 'it', guard[0] + '; return ' + expr[1] + ';');
  const legacy = { id: 'legacy-123', status: 'published', story_meta: {} };
  assert.equal(requires(true, { status: 'pending' }), true, 'new story without a persisted id requires V2');
  assert.equal(requires(true, legacy), false, 'global new-story mode must not force V2 on an existing record');
  assert.equal(requires(false, { id: 'new-public-submission-1', story_meta: { v2_contract_required: true, source: 'public_submission' } }), true, 'new public submission with an ID must require V2');
  assert.equal(requires(false, { id: 'new-manual-builder-1', story_meta: { v2_contract_required: true, manual_builder: true } }), true, 'new manual-builder record with an ID must require V2');
  assert.equal(requires(false, legacy), false, 'legacy record without flags stays on the compatibility path');
  assert.equal(requires(false, { id: 'legacy-v1-456', story_meta: { ai_imported_format: 'KH_STORY_PACKAGE_V1', ai_package_raw: '{}' } }), false, 'explicit V1 legacy record stays on V1');
  assert.equal(requires(false, { id: 'v2-required-1', story_meta: { v2_contract_required: true } }), true, 'record already marked V2-required stays V2');
  assert.equal(requires(false, { id: 'v2-only-1', story_meta: { v2_only_draft: true } }), true, 'V2-only record stays V2');
  assert.equal(requires(false, { id: 'pending-v2-1', story_meta: { pending_draft: { v2_only_draft: true } } }), true, 'published record with V2-only pending draft stays V2');
  assert.equal(requires(false, { id: 'pending-v1-1', story_meta: { pending_draft: { title: 'x' } } }), false, 'ordinary V1 pending draft does not force V2');
  assert.match(html, /if\(requireV2ForNewStory\)nextMeta\.v2_contract_required=true/, 'only V2-required records are marked');
  assert.match(html, /if\(v2OnlyDraft\)\{nextMeta\.v2_only_draft=true/, 'bridge-incompatible V2 imports are stored as V2 review drafts');
  assert.match(html, /if\(isV2OnlyDraftRecord\(it\)\)\{aiFail\('هذا السجل يحمل مسودة V2-only محفوظة للمراجعة\./, 'reimport must not silently clear a V2-only review gate');
});
