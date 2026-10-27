import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="assets/admin-v2-import.mjs?v=20261027-v2-admin-2"></script>'));
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.mjs', import.meta.url), 'utf8');
  assert.ok(module.includes("from '../../rebuild/adapters/v1-v2.mjs?v=20261027-v2-admin-1'"));
  assert.ok(module.includes("from '../../rebuild/validate-story.mjs?v=20261027-v2-admin-1'"));
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2Errors=v2Adapter\.validateStory\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToV1\(pkg\)/);
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON من KH_STORY_PACKAGE_V1 أو KHALEDOON_STORY_V2/);
});
