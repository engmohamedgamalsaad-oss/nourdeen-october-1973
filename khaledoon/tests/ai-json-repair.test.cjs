/* Tests for safe parsing of AI-generated story JSON. */
'use strict';
const assert = require('node:assert/strict');
const parser = require('../assets/ai-json-repair.js');

{
  const raw = '{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"نص سليم"}';
  const result = parser.parse(raw);
  assert.equal(result.value.title, 'حكاية');
  assert.equal(result.repaired, false);
}
{
  const raw = '{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"قال "العلم" مهم للناس"}';
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'قال "العلم" مهم للناس');
  assert.equal(result.repaired, true);
}
{
  const raw = '{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"سطر أول\nسطر ثان"}';
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'سطر أول\nسطر ثان');
  assert.equal(result.repaired, true);
}
{
  const fence = String.fromCharCode(96).repeat(3);
  const raw = fence + 'json' + String.fromCharCode(10) + '{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"نص",}' + String.fromCharCode(10) + fence;
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'نص');
  assert.equal(result.repaired, true);
}
{
  const raw = '{"format":"KH_STORY_PACKAGE_V1"\n"title":"حكاية","body":"نص"}';
  const result = parser.parse(raw);
  assert.equal(result.value.title, 'حكاية');
  assert.equal(result.repaired, true);
}
{
  assert.throws(() => parser.parse('{"title": "broken'), /قرب هذا النص/);
}
console.log('Passed 6 AI JSON repair tests.');
