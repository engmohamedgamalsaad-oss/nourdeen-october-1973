import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(root, 'stories/index.json'), 'utf8'));

for (const sample of [
  { id: '001', section: 'october', person: 'نبيل عبد الوهاب' },
  { id: '009', section: 'people', person: 'نجيب محفوظ' },
  { id: '010', section: 'women', person: 'سميرة موسى' },
  { id: '011', section: 'islamic', person: 'عمرو بن العاص' },
  { id: '012', section: 'science', person: 'فاروق الباز' },
  { id: '013', section: 'women', person: 'الملكة حتشبسوت' },
  { id: '014', section: 'history', person: 'أبو بكر محمد بن العباس الخوارزمي' }
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
    assert.ok(data.section === undefined || data.section === sample.section, 'any optional data.json section agrees with the published index');
    assert.equal(data.format, undefined, 'published metadata is not a KH_STORY_PACKAGE_V1 AI import object');
    for (const lang of ['en', 'fr', 'it', 'de']) {
      assert.ok(data.i18n?.[lang], 'data.json contains ' + lang + ' metadata');
      assert.equal(data.i18n[lang].title, indexed.i18n?.[lang]?.title);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.match(html, /<html[^>]*lang="ar"/i, 'reader page starts in Arabic');
    if (['009', '010', '011', '012', '013', '014'].includes(sample.id)) {
      const v2Path = path.join(dir, 'data.v2.json');
      assert.ok(fs.existsSync(v2Path), 'migrated story has a V2 package');
      const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
      assert.equal(v2.format, 'KHALEDOON_STORY_V2');
      assert.equal(v2.section, sample.section);
      assert.match(html, /data-kh-v2-reader/, 'migrated story uses the unified V2 reader');
      assert.match(html, /data-story-path="data\.v2\.json"/, 'V2 reader loads the story package');
    } else {
      assert.match(html, /i18n\.js|data-i18n|data\.json|KH_LANG|setLanguage/i, 'reader page contains a language/data integration point');
    }
  });
}
