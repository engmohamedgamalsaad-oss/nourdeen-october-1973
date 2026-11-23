'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/shared/story-quiz.js', 'utf8');
function fixture(pathname = '/site/stories/october/001/') {
  const listeners = {}, requests = [];
  const start = { disabled: false, hidden: false, textContent: 'Start', addEventListener(type, fn) { this[type] = fn; } };
  const app = { hidden: true, innerHTML: '', querySelectorAll() { return []; } };
  const submit = { addEventListener() {} };
  let resolveBank;
  const promise = new Promise(resolve => { resolveBank = resolve; });
  const document = { documentElement: { lang: 'en' }, addEventListener(type, fn) { listeners[type] = fn; }, getElementById(id) { return { 'story-quiz-start': start, 'story-quiz-app': app, 'story-quiz-submit': submit }[id] || null; } };
  vm.runInNewContext(source, { document, location: { pathname }, window: {}, fetch(url) { requests.push(url); return promise; }, console });
  return { start, app, requests, listeners, async load(questions) { resolveBank({ ok: true, json: async () => ({ questions }) }); await new Promise(resolve => setImmediate(resolve)); } };
}
const questions = Array.from({ length: 5 }, (_, i) => ({ q: 'Arabic ' + i, o: ['A', 'B'], a: 0, e: 'Arabic explanation', i18n: { en: { q: 'English ' + i, o: ['C', 'D'], e: 'English explanation' } } }));
test('quiz supports both directory and explicit index.html story URLs', async () => {
  for (const path of ['/site/stories/october/001/', '/site/stories/october/001/index.html']) {
    const f = fixture(path);
    assert.deepEqual(f.requests, ['/site/stories/quizzes/001.json']);
    await f.load(questions);
    f.start.click();
    assert.match(f.app.innerHTML, /English/);
  }
});
test('quiz cannot start until the question bank has loaded', async () => {
  const f = fixture();
  assert.equal(f.start.disabled, true);
  assert.doesNotThrow(() => f.start.click());
  assert.equal(f.app.hidden, true);
  await f.load(questions);
  assert.equal(f.start.disabled, false);
  f.start.click();
  assert.equal(f.app.hidden, false);
  assert.match(f.app.innerHTML, /Question 1 of 5/);
});
test('malformed translated options fall back to valid Arabic instead of crashing', async () => {
  const f = fixture();
  const partial = questions.map(q => ({ ...q, i18n: { en: { q: 'Incomplete' } } }));
  await f.load(partial);
  assert.doesNotThrow(() => f.start.click());
  assert.match(f.app.innerHTML, /Arabic/);
  assert.doesNotMatch(f.app.innerHTML, /Incomplete/);
});
