import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gate = await readFile(new URL('../../scripts/check-new-story-readiness.js', import.meta.url), 'utf8');
const cli = await readFile(new URL('../validate-package.mjs', import.meta.url), 'utf8');

test('new unified story pages use the canonical package and bypass V1-only requirements', () => {
  assert.ok(gate.includes('data-story-path=') && gate.includes('storyPath = `stories/${section}/${id}/story.json`'));
  assert.match(gate, /story\.json/);
  assert.match(gate, /Story package is the canonical story format/);
  assert.match(gate, /continue;/);
});

test('unified story package readiness invokes the strict shared validator', () => {
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

test('the unified story contract is the only workflow outside October', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /النظام المعتمد واحد/);
  assert.match(readme, /كل الحكايات خارج قسم أكتوبر تُنشأ وتُحدّث وتُنشر من حزمة القالب الموحد نفسها/);
  assert.match(readme, /قسم أكتوبر مستثنى مؤقتًا/);
  assert.match(readme, /لا تُستخدم مصدرًا لإنشاء صفحة أو نشر حكاية خارج أكتوبر/);
});

test('canonical v5 prompt and prompt admin use the official story contract', async () => {
  const master = await readFile(new URL('../../docs/khaledoon-story-production-workflow.md', import.meta.url), 'utf8');
  const promptAdmin = await readFile(new URL('../../khaledoon/prompts-admin.html', import.meta.url), 'utf8');
  const activeAdminTexts = await readFile(new URL('../../khaledoon/assets/khaledoon-admin-texts.js', import.meta.url), 'utf8');
  assert.match(master, /المخطط الرسمي/);
  assert.match(master, /rebuild\/story-contract\.json/);
  assert.match(master, /لا تُخرج حقولًا غير موجودة في المخطط/);
  assert.match(promptAdmin, /كل ملف أداة في مسار v5 نسخة مستقلة كاملة/);
  assert.match(promptAdmin, /لا تجمع معه مرجعًا أو نسخة v4 إضافية/);
  assert.match(activeAdminTexts, /المخطط الرسمي/);
  assert.match(activeAdminTexts, /rebuild\/story-contract\.json/);
  assert.doesNotMatch(activeAdminTexts, /افحص مخطط KH_STORY_PACKAGE_V1 الفعلي/);
});

test('the four standalone v5 prompts contain the same shared reference and distinct provider appendices', async () => {
  const master = (await readFile(new URL('../../docs/khaledoon-story-production-workflow.md', import.meta.url), 'utf8')).trim();
  const files = ['chatgpt', 'claude', 'deepseek', 'gemini'];
  const prompts = await Promise.all(files.map(name =>
    readFile(new URL('../../khaledoon/prompts/2026-11-02-unified-v5/story-prompt-' + name + '.md', import.meta.url), 'utf8')
  ));
  for (let i = 0; i < prompts.length; i++) {
    const appendixAt = prompts[i].indexOf('# تعليمات خاصة بـ ');
    assert.ok(appendixAt > 0, files[i] + ' must have a provider appendix');
    const shared = prompts[i].slice(0, appendixAt).replace(/\n*---\n*$/, '').trim();
    assert.equal(shared, master, files[i] + ' must include the exact canonical reference');
    assert.match(prompts[i], /الإصدار: 2026-11-02-v5/);
  }
});

test('v5 story content gate requires specific, source-grounded facts and balanced uncertainty', async () => {
  const master = await readFile(new URL('../../docs/khaledoon-story-production-workflow.md', import.meta.url), 'utf8');
  const files = ['chatgpt', 'claude', 'deepseek', 'gemini'];
  const prompts = await Promise.all(files.map(name =>
    readFile(new URL('../../khaledoon/prompts/2026-11-02-unified-v5/story-prompt-' + name + '.md', import.meta.url), 'utf8')
  ));
  for (const [name, content] of [['canonical reference', master], ...files.map((name, i) => [name, prompts[i]])]) {
    assert.match(content, /معلومات تاريخية محددة وكافية/, name + ' must require specific historical detail');
    assert.match(content, /اذكر الخلاف \*\*مرة واحدة\*\*/, name + ' must keep uncertainty notes balanced');
    assert.match(content, /مصادر موثوقة قابلة للفتح/, name + ' must require verifiable sources');
  }
});
