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

test('canonical prompt and prompt admin use the unified story contract for new packages', async () => {
  const master = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md', import.meta.url), 'utf8');
  const promptAdmin = await readFile(new URL('../../khaledoon/prompts-admin.html', import.meta.url), 'utf8');
  const activeAdminTexts = await readFile(new URL('../../khaledoon/assets/khaledoon-admin-texts.js', import.meta.url), 'utf8');
  assert.match(master, /العقد الفعلي الموجود في `rebuild\/story-contract\.json`/);
  assert.match(master, /rebuild\/story-contract\.json/);
  assert.match(master, /لا تستخدم مخطط KH_STORY_PACKAGE_V1/);
  assert.doesNotMatch(master, /افحص مخطط KH_STORY_PACKAGE_V1 الفعلي/);
  assert.match(promptAdmin, /القالب الموحد هو المرجع المعتمد للحكايات الجديدة/);
  assert.match(promptAdmin, /لا تستخدم المخطط القديم/);
  assert.match(activeAdminTexts, /العقد الفعلي الموجود في `rebuild\/story-contract\.json`/);
  assert.doesNotMatch(activeAdminTexts, /افحص مخطط KH_STORY_PACKAGE_V1 الفعلي/);
});


test('V2 story content must be rich, source-grounded, and balanced about uncertainty', async () => {
  const packagePrompt = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/V2-STORY-PACKAGE-PROMPT.md', import.meta.url), 'utf8');
  const master = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/MASTER-STORY-WORKFLOW.md', import.meta.url), 'utf8');
  const checklist = await readFile(new URL('../../khaledoon/prompts/2026-10-23-unified-v4/WORKFLOW-CHECKLIST.md', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const [name, text] of [['V2 package prompt', packagePrompt], ['master workflow', master], ['checklist', checklist], ['V2 README', readme]]) {
    assert.match(text, /ثراء المحتوى|ثراء المحتوى التاريخي|ثراء المحتوى والدقة التاريخية/, name + ' must define the story richness gate');
    assert.match(text, /لا تجعل التحفظات|لا تهيمن عبارات|لا نكرر|لا تكرر/, name + ' must prevent uncertainty warnings from dominating the story');
    assert.match(text, /مصادر موثوقة|المصادر الموثوقة|مصادر موثوقة تدعمها/, name + ' must require source-grounded claims');
  }
});
