import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-v2-import.mjs?v=20261027-v2-admin-4"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/v1-v2.mjs?v=20261027-v2-admin-4'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261027-v2-admin-4'"));
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2Errors=v2Adapter\.validateForAdminBridge\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToV1\(pkg\)/);
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.ok(html.includes("story-template-bundle.js?v=20261027-source-clean-2"));
  assert.ok(html.includes("sources:aiInputFormat==='KHALEDOON_STORY_V2'?String(pkg.sources||''):String(pkg.sources||'').slice(0,3000)"), 'V2 source text must remain complete while legacy V1 retains its historical 3000-character cap');
  assert.ok(html.includes("aiInputFormat==='KHALEDOON_STORY_V2'&&visibleSourceLength>3000"), 'only V2 imports should reject source text exceeding the visible-character limit');
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON من KH_STORY_PACKAGE_V1 أو KHALEDOON_STORY_V2/);
});
