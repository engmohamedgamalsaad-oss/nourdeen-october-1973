const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('admin speech-text reviewer is loaded and inline admin JavaScript parses', () => {
  const html = fs.readFileSync(path.join(__dirname, '../khaledoon/admin.html'), 'utf8');
  assert.match(html, /assets\/audio-text-review\.js\?v=20261106-dictionary-review-3/);
  assert.match(html, /مراجعة النص قبل توليد الصوت/);
  assert.match(html, /audio-pronunciation\.json/);
  assert.match(html, /اعتماد المراجعة وتصدير ملف الصوت/);
  assert.match(html, /اقتراحات قاموس النطق العربي/);
  assert.match(html, /\(requireUnifiedStoryPackage\|\|isOctoberLegacyRecord\(it\)\)&&window\.KHAudioTextReview/);
  assert.match(html, /async function audioReviewPackageOf\(it\)/);
  assert.match(html, /rebuild\/october-audio-packages/);
  assert.match(html, /المقترح الصوتي — يمكنك تعديله قبل الموافقة/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    if (/application\/(ld\+)?json/i.test(match[1])) continue;
    assert.doesNotThrow(() => new vm.Script(match[2]), 'inline admin script must remain valid JavaScript');
  }
});
