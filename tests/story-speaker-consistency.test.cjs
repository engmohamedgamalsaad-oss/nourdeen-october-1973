'use strict';
/* Every language must preserve the Arabic speaker identity and block order. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const stories = [];
for (const section of fs.readdirSync(path.join(root, 'stories'))) {
  const dir = path.join(root, 'stories', section);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const id of fs.readdirSync(dir)) {
    const file = path.join(dir, id, 'story.json');
    if (fs.existsSync(file)) stories.push({ name: section + '/' + id, data: JSON.parse(fs.readFileSync(file, 'utf8')) });
  }
}
test('there are stories to check', () => assert.ok(stories.length >= 1));
for (const story of stories) {
  test(story.name + ': every language has the same blocks and speakers as Arabic', () => {
    const i18n = story.data.i18n || {};
    const ar = (i18n.ar && i18n.ar.blocks) || [];
    for (const lang of Object.keys(i18n)) {
      if (lang === 'ar') continue;
      const blocks = (i18n[lang] && i18n[lang].blocks) || [];
      assert.equal(blocks.length, ar.length, lang + ': number of blocks differs from Arabic');
      const diffs = [];
      ar.forEach((block, index) => {
        if (blocks[index] && blocks[index].speaker !== block.speaker) diffs.push('block ' + index + ': ar=' + block.speaker + ' ' + lang + '=' + blocks[index].speaker);
      });
      assert.deepEqual(diffs, [], lang + ': speaker differs from Arabic');
    }
  });
}
