'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const root = process.cwd();
const promptDir = 'khaledoon/prompts/2026-10-23-unified-v4/';
const master = fs.readFileSync(root + '/' + promptDir + 'MASTER-STORY-WORKFLOW.md', 'utf8').trim();
const activeSource = fs.readFileSync(root + '/khaledoon/assets/khaledoon-admin-texts.js', 'utf8');
const start = activeSource.indexOf('var STORY_PAGE_PROMPT = ');
const end = activeSource.indexOf(';\\nvar STORY_PROVIDER_PROMPTS =', start);
assert.ok(start >= 0 && end > start, 'active prompt declaration must have stable boundaries');
const activePrompt = JSON.parse(activeSource.slice(start + 'var STORY_PAGE_PROMPT = '.length, end)).trim();
assert.equal(activePrompt, master, 'the active admin prompt must exactly match the canonical v4 master');

const numberedHeadings = master.split('\\n')
  .map(line => line.match(/^## (\\d+)\\)/))
  .filter(Boolean)
  .map(match => Number(match[1]));
assert.deepEqual(numberedHeadings, [1, 2, 3, 4, 5, 6, 7, 8, 9],
  'numbered master-prompt sections must be sequential and unique');

assert.ok(master.includes('الحقول المطلوبة: `url` أو `path`، و`alt`، و`caption`، و`source_name`'),
  'the required cover field list must explicitly include caption');
assert.ok(master.includes('يجب أن تحتوي كل حكاية جديدة على شاشة «ابدأ الحكاية» وفق القالب المشترك'),
  'the start screen must be mandatory for every new story');
assert.ok(!master.includes('إذا كان القالب يستخدمهما'),
  'the prompt must not make the required start screen conditional');

for (const provider of ['CHATGPT.md', 'CLAUDE.md', 'GEMINI.md', 'DEEPSEEK.md']) {
  const text = fs.readFileSync(root + '/' + promptDir + provider, 'utf8');
  assert.ok(text.includes('## 4) المشاهد وبطاقات القراءة'), provider + ': scene heading numbering must be corrected');
  assert.ok(text.includes('و`caption`، و`source_name`'), provider + ': cover caption must be explicit');
  assert.ok(text.includes('يجب أن تحتوي كل حكاية جديدة على شاشة «ابدأ الحكاية»'), provider + ': start screen must be mandatory');
  assert.ok(!text.includes('## 3) المشاهد وبطاقات القراءة'), provider + ': duplicate section number must be removed');
  assert.ok(!text.includes('إذا كان القالب يستخدمهما'), provider + ': conditional start-screen wording must be removed');
}

console.log('Passed prompt contract consistency: active/master equality, sequential sections, required cover caption, mandatory start screen, and provider alignment.');
