import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('manual story builder isolates Latin AI text and scales its heading for mobile', async () => {
  const html = await readFile(path.join(root, 'khaledoon/story-builder.html'), 'utf8');
  assert.match(html, /<h1>إنشاء حكاية يدويًا — من غير <bdi dir="ltr">AI<\/bdi><\/h1>/);
  assert.match(html, /h1\{font:700 clamp\(1\.25rem,4\.5vw,1\.8rem\)/);
  assert.match(html, /line-height:1\.55;overflow-wrap:anywhere/);
});
