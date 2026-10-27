import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(root, 'stories/index.json'), 'utf8'));

for (const sample of [
  { id: '001', section: 'october', person: 'نبيل عبد الوهاب' },
  { id: '009', section: 'people', person: 'نجيب محفوظ' }
]) {
  test('production story ' + sample.id + ' stays in the current published layout (not treated as a V1 AI package)', () => {
    const dir = path.join(root, 'stories', sample.section, sample.id);
    const dataPath = path.join(dir, 'data.json');
    const htmlPath = path.join(dir, 'index.html');
    assert.ok(fs.existsSync(dataPath), 'published data.json exists');
    assert.ok(fs.existsSync(htmlPath), 'published reader page exists');

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const indexed = index.find(row => String(row.id).padStart(3, '0') === sample.id);
    assert.ok(indexed, 'published story is present in stories/index.json');
    assert.equal(data.published, true);
    assert.equal(indexed.published, true);
    assert.equal(data.person, sample.person);
    assert.equal(indexed.person, sample.person);
    assert.equal(data.title, indexed.title);
    assert.equal(data.section, undefined, 'section is stored in the index, not assumed in data.json');
    assert.equal(data.format, undefined, 'published metadata is not a KH_STORY_PACKAGE_V1 AI import object');
    for (const lang of ['en', 'fr', 'it', 'de']) {
      assert.ok(data.i18n?.[lang], 'data.json contains ' + lang + ' metadata');
      assert.equal(data.i18n[lang].title, indexed.i18n?.[lang]?.title);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.match(html, /<html[^>]*lang="ar"/i, 'reader page starts in Arabic');
    assert.match(html, /translations\.js|data\.json|KH_LANG|setLanguage/i, 'reader page contains a language/data integration point');
  });
}
