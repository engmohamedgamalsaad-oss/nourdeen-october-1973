import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin import exposes V2 validator and converter and preserves original input format', async () => {
  const html = await readFile(new URL('../../khaledoon/admin.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="module" src="assets\\/admin-v2-import\\.js\\?v=20261027-v2-admin-1"><\\/script>/);
  const module = await readFile(new URL('../../khaledoon/assets/admin-v2-import.js', import.meta.url), 'utf8');
  assert.match(module, /import \\{ v2ToV1, V2_FORMAT \\} from ['"]\\.\\.\\/\\.\\.\\/rebuild\\/adapters\\/v1-v2\\.mjs/);
  assert.match(module, /import \\{ validateStory \\} from ['"]\\.\\.\\/\\.\\.\\/rebuild\\/validate-story\\.mjs/);
  assert.match(html, /pkg&&pkg\.format==='KHALEDOON_STORY_V2'/);
  assert.match(html, /var v2Errors=v2Adapter\.validateStory\(pkg\)/);
  assert.match(html, /pkg=v2Adapter\.v2ToV1\(pkg\)/);
  assert.match(html, /ai_imported_format:aiInputFormat\|\|'KH_STORY_PACKAGE_V1'/);
  assert.match(html, /aiPaste\.placeholder='الصق هنا JSON من KH_STORY_PACKAGE_V1 أو KHALEDOON_STORY_V2/);
});
