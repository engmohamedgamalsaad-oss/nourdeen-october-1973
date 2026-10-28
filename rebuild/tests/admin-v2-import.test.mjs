import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStory, validateForAdminBridge } from '../validate-story.mjs';
import { v2ToAdminDraft } from '../adapters/v1-v2.mjs';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-v2-import.mjs?v=20261028-v2-admin-6"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/v1-v2.mjs?v=20261028-v2-admin-6'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261028-v2-admin-6'"));
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2ValidationErrors=v2Adapter\.validateV2\(pkg\)/);
  assert.match(html, /var v2Errors=v2Adapter\.validateForAdminBridge\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToV1\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToAdminDraft\(pkg\)/);
  assert.match(html, /nextMeta\.v2_package=v2PackageRaw/);
  assert.match(html, /if\(meta\.v2_only_draft\|\|\(meta\.pending_draft&&meta\.pending_draft\.v2_only_draft\)\)/);
  assert.ok(html.includes("package-review.html?draft=1"), 'V2-only drafts should use the full-package read-only preview');
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.ok(html.includes("story-template-bundle.js?v=20261027-source-clean-2"));
  assert.ok(html.includes("sources:aiInputFormat==='KHALEDOON_STORY_V2'?String(pkg.sources||''):String(pkg.sources||'').slice(0,3000)"), 'V2 source text must remain complete while legacy V1 retains its historical 3000-character cap');
  assert.ok(html.includes("aiInputFormat==='KHALEDOON_STORY_V2'&&visibleSourceLength>3000"), 'only V2 imports should reject source text exceeding the visible-character limit');
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON من KH_STORY_PACKAGE_V1 أو KHALEDOON_STORY_V2/);
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
