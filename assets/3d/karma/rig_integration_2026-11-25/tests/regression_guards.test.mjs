// Guards against two reporting errors found on 2026-11-25: a lenient on-screen tolerance in the reliability test,
// and hidden-recovery timed by a clock that differs from the clock the harness advances.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const rel = fs.readFileSync(here + 'collection_reliability.py', 'utf8');
const stage = fs.readFileSync(new URL('../../../../../khaledoon/assets/karma-stage.js', 'file://' + here).pathname, 'utf8');
test('on-screen check has zero tolerance', () => {
  assert.match(rel, /onScreen:c\.pos\.x<innerWidth&&c\.pos\.y<=innerHeight[^+\d]/);
  assert.doesNotMatch(rel, /innerHeight\s*\+\s*\d/);
});
test('hidden recovery is timed by the same simulated clock the frame loop and fastForward advance', () => {
  assert.match(stage, /simT \+= d/);
  assert.match(stage, /tNow = simT \* 1000/);
  const rec = stage.slice(stage.indexOf('const tNow'), stage.indexOf('const tNow') + 200);
  assert.doesNotMatch(rec, /performance\.now|Date\.now/);
});
test('real frame loop feeds tick with a clamped dt (long stalls do not count as hidden time)', () => {
  assert.match(stage, /Math\.min\([^)]*0\.\d+\)/);
});
