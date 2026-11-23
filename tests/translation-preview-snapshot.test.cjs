const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../rebuild/reader-audio-flow.js'), 'utf8');
// Execute the production request helper and its actual dependencies, without the page's DOM setup.
const helpers = source.slice(source.indexOf('  function storyIdentity('), source.indexOf('  async function sha256Trim('));
function requestHarness(st) {
  const sent = [];
  const context = { story: () => st, token: () => 'test-session', lang: () => 'en', SUPA: 'https://test.invalid', KEY: 'test',
    fetch: async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({success: true}) }; } };
  vm.createContext(context);
  vm.runInContext(helpers + ';this.request = audioReviewAction;', context);
  return {sent, request: context.request};
}
test('single and bulk translation requests preserve the preview compact snapshot contract', async () => {
  const st = {section:'history',slug:'ibn-sina',i18n:{ar:{blocks:[{speaker:'karma',text:'Edited Arabic',type:'paragraph'},{speaker:'narrator',text:'Appended Arabic'}]},en:{blocks:[{speaker:'karma',text:'English'}]},de:{blocks:[{speaker:'karma',text:'Deutsch'}]}}};
  const original = JSON.stringify(st);
  const h = requestHarness(st);
  await h.request({action:'translation_generate',block_index:0,force:true});
  await h.request({action:'translation_generate',language:'de',block_index:1,force:false});
  assert.equal(h.sent[0].language,'en');
  assert.equal(h.sent[1].language,'de');
  assert.equal(h.sent[1].block_index,1);
  assert.equal(h.sent[1].force,false);
  for (const payload of h.sent) {
    assert.deepEqual(payload.story_snapshot,{section:st.section,slug:st.slug,blocks:{ar:[{speaker:'karma',text:'Edited Arabic'},{speaker:'narrator',text:'Appended Arabic'}],en:[{speaker:'karma',text:'English'}],de:[{speaker:'karma',text:'Deutsch'}]}});
    assert.equal(payload.story_snapshot.i18n,undefined);
  }
  assert.equal(JSON.stringify(st),original,'request preparation must not mutate preview or approved text');
});
test('compact translation snapshot keeps placeholder positions and source speaker mapping', async () => {
  const h = requestHarness({section:'science',slug:'new-preview',i18n:{ar:{blocks:[null,{speaker:'title',text:'Heading'},{speaker:'narrator',text:'Source'}]}}});
  await h.request({action:'translation_generate',language:'fr',block_index:2});
  assert.deepEqual(h.sent[0].story_snapshot.blocks.ar,[{speaker:'',text:''},{speaker:'title',text:'Heading'},{speaker:'narrator',text:'Source'}]);
  assert.equal(h.sent[0].force,undefined,'snapshot normalization must not force regeneration');
});
