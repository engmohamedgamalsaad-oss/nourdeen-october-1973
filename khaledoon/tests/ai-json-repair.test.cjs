/* Tests for safe parsing of AI-generated story JSON. */
'use strict';
const assert = require('node:assert/strict');
const parser = require('../assets/ai-json-repair.js');

{
  const raw = String.raw\`{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"نص سليم"}\`;
  const result = parser.parse(raw);
  assert.equal(result.value.title, 'حكاية');
  assert.equal(result.repaired, false);
}
{
  const raw = String.raw\`{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"قال "العلم" مهم للناس"}\`;
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'قال "العلم" مهم للناس');
  assert.equal(result.repaired, true);
}
{
  const raw = String.raw\`{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"سطر أول
سطر ثان"}\`;
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'سطر أول\nسطر ثان');
  assert.equal(result.repaired, true);
}
{
  const raw = String.raw\`\`\`json
{"format":"KH_STORY_PACKAGE_V1","title":"حكاية","body":"نص",}
\`\`\`;
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'نص');
  assert.equal(result.repaired, true);
}
{
  const raw = String.raw\`{"format":"KH_STORY_PACKAGE_V1"
"title":"حكاية","body":"نص"}\`;
  const result = parser.parse(raw);
  assert.equal(result.value.title, 'حكاية');
  assert.equal(result.repaired, true);
}
{
  assert.throws(() => parser.parse('{"title": "broken'), /قرب هذا النص/);
}
console.log('Passed 6 AI JSON repair tests.');
