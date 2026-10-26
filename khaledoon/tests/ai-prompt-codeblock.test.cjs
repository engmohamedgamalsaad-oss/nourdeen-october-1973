/* Tests that copied story prompts request raw JSON, not Markdown fences. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tool = require('../assets/ai-json-repair.js');

const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const FENCE = String.fromCharCode(96).repeat(3);

// 1) Every legacy provider sentence we normalize must still exist exactly once in admin.html.
tool.PROMPT_RULES.forEach(([oldText]) => {
  assert.equal(admin.split(oldText).length - 1, 1, 'prompt sentence missing or duplicated in admin.html: ' + oldText);
});

// 2) A package prompt containing all legacy sentences is normalized to raw JSON-only instructions.
const prompt = 'KH_STORY_PACKAGE_V1\n' + tool.PROMPT_RULES.map((r) => r[0]).join('\n');
const rewritten = tool.toRawJsonPrompt(prompt);
tool.PROMPT_RULES.forEach(([oldText, newText]) => {
  assert.ok(!rewritten.includes(oldText));
  assert.ok(rewritten.includes(newText));
});
assert.ok(/JSON خام|نص خام/.test(rewritten));
assert.ok(/بلا Markdown أو أسوار كود/.test(rewritten));
assert.ok(!rewritten.includes(FENCE + 'json'), 'the prompt must not request code fences');
assert.equal(tool.toRawJsonPrompt(rewritten), rewritten, 'rewrite is idempotent');

// 3) Text that is not the package prompt is untouched (e.g. the "new story" gate prompt).
const other = 'تعليمات العمل — مشروع «خالدون عبر التاريخ».\n' + tool.PROMPT_RULES[0][0];
assert.equal(tool.toRawJsonPrompt(other), other);
assert.equal(tool.toRawJsonPrompt(undefined), undefined);

// 4) The rewrite is wired into both copy sinks, once, and never blocks copying.
{
  const written = [];
  const doc = {
    activeElement: null,
    execCommand(cmd) { doc.copied = doc.activeElement && doc.activeElement.value; return true; }
  };
  const win = { navigator: { clipboard: { writeText(t) { written.push(t); return Promise.resolve(); } } }, document: doc };
  tool.installPromptPatch(win);
  tool.installPromptPatch(win); // installing twice must not double-wrap
  win.navigator.clipboard.writeText(prompt);
  assert.equal(written.length, 1);
  assert.equal(written[0], rewritten);
  doc.activeElement = { tagName: 'TEXTAREA', value: prompt, select() { this.selected = true; } };
  assert.equal(doc.execCommand('copy'), true);
  assert.equal(doc.copied, rewritten);
  assert.ok(doc.activeElement.selected);
  doc.activeElement = { tagName: 'DIV', value: prompt };
  doc.execCommand('copy');
  assert.equal(doc.copied, prompt, 'non-textarea copies are untouched');
}

// 5) Legacy fenced replies remain accepted for recovery, though the prompt no longer requests them.
{
  const body = { format: 'KH_STORY_PACKAGE_V1', title: 'ح', body: 'سطر أول\n\nسطر ثان' };
  const reply = 'ها هي الحزمة:\n' + FENCE + 'json\n' + JSON.stringify(body, null, 2) + '\n' + FENCE;
  const result = tool.parse(reply);
  assert.equal(result.value.body, 'سطر أول\n\nسطر ثان');
  assert.equal(result.repaired, false);
}

console.log('Passed raw-JSON prompt normalization and legacy fenced-reply recovery tests.');
