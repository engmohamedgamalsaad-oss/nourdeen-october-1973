// The three gaps that the shared suite tracks as `todo`, as real (non-todo) tests on the shipped KarmaMotion controller.
// Gap 2 here asserts the actual requirement (the standing box never overlaps the card: either side is fine), because the shared suite's
// version only accepts the LEFT side, which is impossible for a card at the left screen edge.
// Run: KARMA_GLB=<glb> node --test assets/3d/karma/rig_integration_2026-11-25/tests/rig_gaps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { createRig } = await import('../../claude_track_2026-11-25/js/KarmaRig.js');
const { KarmaMotion } = await import('../js/KarmaMotion.js');
const GLB = process.env.KARMA_GLB; if (!GLB) throw new Error('Set KARMA_GLB');
const DT = 1 / 60;
async function make({ viewport = { width: 1280, height: 800 }, rects, charH = 170, extra = {} } = {}) {
  const b = fs.readFileSync(GLB); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const scene = (await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej))).scene;
  const R = rects || [{ id: 'a', left: 140, top: 420, width: 260, height: 180 }, { id: 'b', left: 760, top: 300, width: 260, height: 200 }];
  return { R, c: new KarmaMotion({ rig: createRig(scene), getCardRects: () => R, viewport, characterHeightPx: charH, modelHeight: 1, ...extra }) };
}
const settle = async (c, p, seconds) => { let r; p.then((v) => { r = v; });
  for (let i = 0; i < seconds / DT && r === undefined; i++) { c.update(DT); await Promise.resolve(); }
  if (r === undefined) throw new Error('did not settle in ' + seconds + 's, state=' + c.stateName); return r; };
const run = (c, s) => { for (let i = 0; i < s / DT; i++) c.update(DT); };

test('construction leaves the holder transform finite (no NaN before the first update)', async () => {
  const { c } = await make();
  for (const v of [c.holder.rotation.x, c.holder.rotation.y, c.holder.rotation.z, c.holder.position.x, c.holder.position.y, c.holder.scale.x]) assert.ok(Number.isFinite(v));
});
test('gap 1: after walkTo(top) she keeps following that card when it moves', async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top' }), 10); R[1].left += 120; run(c, 2);
  assert.ok(Math.abs(c.pos.x - (R[1].left + R[1].width / 2)) < 3);
});
for (const side of ['left', 'right']) test('gap 2: card at the phone screen edge, requested side ' + side + ': standing box does not overlap the card, stays in view', async () => {
  const R = [{ id: 'a', left: side === 'left' ? 8 : 390 - 8 - 160, top: 400, width: 160, height: 140 }];
  const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 }); await settle(c, c.walkTo('a', { side }), 8);
  const hw = c.halfW, r = R[0];
  assert.ok(c.pos.x + hw <= r.left + 0.6 || c.pos.x - hw >= r.left + r.width - 0.6 || c.pos.y <= r.top + 0.5, 'standing box overlaps card x=' + c.pos.x);
  assert.ok(c.pos.x >= hw - 0.01 && c.pos.x <= 390 - hw + 0.01, 'outside viewport x=' + c.pos.x);
});
test('gap 3: keep-out rectangles (text) push the standing position sideways, never into a card or out of view', async () => {
  const { c, R } = await make(); assert.equal(typeof c.setKeepOutRects, 'function');
  await settle(c, c.walkTo('a', { side: 'right' }), 10); const x0 = c.pos.x, hw = c.halfW;
  c.setKeepOutRects([{ left: x0 - 60, top: c.pos.y - c.charH, width: 120, height: c.charH }]); run(c, 2);
  assert.ok(c.pos.x + hw <= x0 - 60 + 0.6 || c.pos.x - hw >= x0 + 60 - 0.6, 'still inside keep-out: x=' + c.pos.x + ' (was ' + x0 + ')');
  const r = R[0]; assert.ok(!(c.pos.x + hw > r.left + 0.6 && c.pos.x - hw < r.left + r.width - 0.6), 'pushed into card a');
  assert.ok(c.pos.x >= hw - 0.01 && c.pos.x <= 1280 - hw + 0.01);
});
