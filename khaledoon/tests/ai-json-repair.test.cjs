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

// ---- Failure classes seen when pasting from ChatGPT / Gemini / Claude / DeepSeek ----
{
  // The exact failure: Markdown-escaped asterisks inside a JSON string (invalid escape \*).
  const raw = String.raw`{"format":"KH_STORY_PACKAGE_V1","body":"أن يجعل الجمهور يفكر.\n\n\*\*من دراسة الحقوق إلى عالم المسرح\*\*\n\nدرس الحكيم الحقوق في القاهرة"}`;
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'أن يجعل الجمهور يفكر.\n\nمن دراسة الحقوق إلى عالم المسرح\n\nدرس الحكيم الحقوق في القاهرة');
  assert.equal(result.repaired, true);
  assert.ok(result.notes.length >= 1);
}
{
  // Other Markdown escapes + double-escaped asterisks that survive JSON parsing.
  const raw = String.raw`{"format":"KH_STORY_PACKAGE_V1","title":"عنوان\_تجريبي","body":"نقطة\- أولى\. و \\*\\*مهم\\*\\*"}`;
  const result = parser.parse(raw);
  assert.equal(result.value.title, 'عنوان_تجريبي');
  assert.equal(result.value.body, 'نقطة- أولى. و مهم');
}
{
  // Valid JSON that still carries Markdown markers: cleaned, but original_body/urls stay verbatim.
  const raw = JSON.stringify({
    format: 'KH_STORY_PACKAGE_V1',
    original_body: '**نص** أصلي كما كتبه الطالب',
    body: '## عنوان فرعي\n**مهم** و *مائل* هنا',
    images: [{ url: 'https://example.org/a__b__.jpg', caption: '**صورة**' }]
  });
  const result = parser.parse(raw);
  assert.equal(result.value.original_body, '**نص** أصلي كما كتبه الطالب');
  assert.equal(result.value.body, 'عنوان فرعي\nمهم و مائل هنا');
  assert.equal(result.value.images[0].url, 'https://example.org/a__b__.jpg');
  assert.equal(result.value.images[0].caption, 'صورة');
  assert.equal(result.repaired, true);
}
{
  // Raw tab / control character and non-breaking spaces between tokens.
  const raw = '{\u00A0"format":\u00A0"KH_STORY_PACKAGE_V1",\u200B"body":"a\tb\u0001c"}';
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'a\tb\u0001c');
}
{
  // A comma inside prose right after a quoted word must not end the string.
  const raw = '{"format":"KH_STORY_PACKAGE_V1","body":"قال "نعم", وذهب إلى البيت","title":"ت"}';
  const result = parser.parse(raw);
  assert.equal(result.value.body, 'قال "نعم", وذهب إلى البيت');
  assert.equal(result.value.title, 'ت');
}
{
  // Text before/after the object, a fence with a language tag, and braces in the explanation.
  const fence = String.fromCharCode(96).repeat(3);
  const raw = 'تفضل الحزمة {جاهزة}:\n' + fence + 'JSON\n{"format":"KH_STORY_PACKAGE_V1","title":"ح"}\n' + fence + '\nانتهى.';
  assert.equal(parser.parse(raw).value.title, 'ح');
}
{
  // Typographic quotes around property names.
  const raw = '{\u201Cformat\u201D: "KH_STORY_PACKAGE_V1", \u201Ctitle\u201D: "ح"}';
  assert.equal(parser.parse(raw).value.title, 'ح');
}
{
  // Truncated output (reply cut by the tool) is reported as such, with the position snippet.
  const raw = '{"format":"KH_STORY_PACKAGE_V1","translations":{"en":{"title":"A","body":"The story begins';
  assert.throws(() => parser.parse(raw), (error) => error.truncated === true && /مقطوع/.test(error.message) && /قرب هذا النص/.test(error.message));
}
{
  // Genuinely broken (not truncated) output still fails loudly instead of importing garbage.
  assert.throws(() => parser.parse('{"title": }'), (error) => error.truncated === false);
}

console.log('Passed AI JSON repair tests.');
