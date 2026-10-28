import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gate = await readFile(new URL('../../scripts/check-new-story-readiness.js', import.meta.url), 'utf8');
const cli = await readFile(new URL('../validate-package.mjs', import.meta.url), 'utf8');

test('new V2 story pages use the canonical package and bypass V1-only requirements', () => {
  assert.match(gate, /data-story-path=\["']data\\\.v2\\\.json\["']/);
  assert.match(gate, /data\.v2\.json/);
  assert.match(gate, /V2 is canonical/);
  assert.match(gate, /continue;/);
});

test('V2 package readiness invokes the strict shared validator', () => {
  assert.match(gate, /rebuild\/validate-package\.mjs/);
  assert.match(cli, /validateStory/);
  assert.match(cli, /validateLocalImagePaths/);
  assert.match(cli, /validateStory\(story\)/);
});

test('documented production workflow keeps all nine review gates', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /مراحل إنتاج الحكاية — تسع مراحل إلزامية/);
  for (const stage of [
    'استلام الأصل', 'التدقيق التاريخي', 'تحرير السرد', 'التصميم حسب القسم',
    'الصور والحقوق', 'اللغات الخمس', 'التحقق الآلي', 'المعاينة والمراجعة', 'الاعتماد والنشر'
  ]) assert.ok(readme.includes(stage), 'missing workflow stage: ' + stage);
  assert.match(readme, /الاعتماد لا ينشر تلقائيًا/);
});

test('V2 is the only long-term story contract and V1 bridge is explicitly temporary', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /V2 هو العقد الوحيد للحكايات الجديدة/);
  assert.match(readme, /جسر V1 الحالي أداة انتقال مؤقتة/);
  assert.match(readme, /لا تضف ميزات جديدة إلى V1/);
  assert.match(readme, /لا تُحذف ملفات أو بيانات V1 المنشورة قبل إثبات/);
});
