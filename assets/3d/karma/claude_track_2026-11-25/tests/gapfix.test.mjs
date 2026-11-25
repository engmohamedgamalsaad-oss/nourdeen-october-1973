// Gap-fix tests: the 3 gaps that integration_tests_2026-11-25 reports as `todo`, now as real tests, plus regression vs the verbatim #710 controller.
// Run: KARMA_GLB=<rig glb with 19-bone skin> node --test assets/3d/karma/claude_track_2026-11-25/tests/gapfix.test.mjs
// Default rig GLB = baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb (a RIG fixture; says nothing about likeness).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const { createRig } = await import('../js/KarmaRig.js');
const { KarmaController: Fixed } = await import('../js/KarmaController.js');
const { KarmaController: V710 } = await import('../js/KarmaController.v710.js');
const GLB = process.env.KARMA_GLB || path.join(here, '../../baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb');
const DT = 1 / 60;
const buf = fs.readFileSync(GLB); const AB = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parse = () => new Promise((res, rej) => new GLTFLoader().parse(AB.slice(0), '', res, rej));
async function make({ Ctor = Fixed, viewport = { width: 1280, height: 800 }, rects, charH = 170, extra = {} } = {}) {
  const gltf = await parse(); const rig = createRig(gltf.scene);
  const R = rects || [{ id: 'a', left: 140, top: 420, width: 260, height: 180 }, { id: 'b', left: 760, top: 300, width: 260, height: 200 }];
  return { R, c: new Ctor({ rig, getCardRects: () => R, viewport, characterHeightPx: charH, modelHeight: 1, ...extra }) };
}
const settle = async (c, p, sec) => { let r; p.then((v) => { r = v; }); for (let i = 0; i < sec / DT && r === undefined; i++) { c.update(DT); await Promise.resolve(); }
  if (r === undefined) throw new Error('promise did not settle in ' + sec + 's, state=' + c.stateName); return r; };
const run = (c, s) => { for (let i = 0; i < s / DT; i++) c.update(DT); };
const box = (c) => ({ l: c.pos.x - c.halfW, r: c.pos.x + c.halfW, t: c.pos.y - c.charH, b: c.pos.y });
const hit = (b, k) => b.l < k.left + k.width && b.r > k.left && b.t < k.top + k.height && b.b > k.top;

// ---- GAP 1: keep following the card after walkTo(top)
test('GAP1 after walkTo(top) the character follows that card when it moves (x and y)', async () => {
  const { c, R } = await make(); const r = await settle(c, c.walkTo('b', { side: 'top' }), 10); assert.equal(r.completed, true);
  R[1].left += 120; R[1].top -= 40; run(c, 2);
  assert.ok(Math.abs(c.pos.x - (R[1].left + R[1].width / 2)) < 3, 'x=' + c.pos.x); assert.ok(Math.abs(c.pos.y - R[1].top) < 3, 'y=' + c.pos.y);
});
test('GAP1 perch survives jump / wave / tilt and still follows afterwards', async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top' }), 10);
  await settle(c, c.jump(), 3); await settle(c, c.wave(1), 3); await settle(c, c.tilt('right', 1), 3); R[1].left -= 90; run(c, 2);
  assert.ok(Math.abs(c.pos.x - (R[1].left + R[1].width / 2)) < 3);
});
test('GAP1 card jumps far while perched: character re-walks to it (no teleport), ends on top', async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top' }), 10); const x0 = c.pos.x;
  R[1].left = 200; R[1].top = 250; run(c, 0.2); assert.ok(Math.abs(c.pos.x - x0) < 0.5 * 170 * 3, 'jumped instantly'); assert.notEqual(c.pos.x, 200 + 130);
  run(c, 8); assert.ok(Math.abs(c.pos.x - (200 + 130)) < 3 && Math.abs(c.pos.y - 250) < 3);
});
test('GAP1 perch is released by stand() and by walking to another card', async () => {
  const a = await make(); await settle(a.c, a.c.walkTo('b', { side: 'top' }), 10); await settle(a.c, a.c.stand(), 2); const x = a.c.pos.x; a.R[1].left += 100; run(a.c, 2);
  assert.equal(a.c.pos.x, x, 'stand() must release the perch');
  const b = await make(); await settle(b.c, b.c.walkTo('b', { side: 'top' }), 10); await settle(b.c, b.c.walkTo('a', { side: 'top' }), 12); b.R[1].left += 100; run(b.c, 2);
  assert.ok(Math.abs(b.c.pos.x - (b.R[0].left + b.R[0].width / 2)) < 3, 'must follow the NEW card only');
});
test('GAP1 perched card removed: perch released, character drops to the ground, state idle, no NaN', async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top' }), 10); R.splice(1, 1); run(c, 3);
  assert.equal(c.perch, null); assert.equal(c.stateName, 'idle'); assert.ok(Math.abs(c.pos.y - 800) < 1, 'y=' + c.pos.y); assert.ok(Number.isFinite(c.pos.x));
});

// ---- GAP 2: side fallback near screen edges
test('GAP2 phone, card at the left edge, walkTo(left): ends on the right side without overlap', async () => {
  const R = [{ id: 'a', left: 8, top: 400, width: 160, height: 140 }]; const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 });
  await settle(c, c.walkTo('a', { side: 'left' }), 10); assert.equal(hit(box(c), R[0]), false); assert.ok(c.pos.x > R[0].left + R[0].width);
  assert.ok(c.pos.x >= c.halfW - 0.01 && c.pos.x <= 390 - c.halfW + 0.01);
});
test('GAP2 phone, card at the right edge, walkTo(right): ends on the left side without overlap', async () => {
  const R = [{ id: 'a', left: 222, top: 400, width: 160, height: 140 }]; const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 });
  await settle(c, c.walkTo('a', { side: 'right' }), 10); assert.equal(hit(box(c), R[0]), false); assert.ok(c.pos.x < R[0].left);
});
test('GAP2 leanOn at the edge flips to the free side, keeps her centre off the card, lean pose mirrors', async () => {
  const R = [{ id: 'a', left: 8, top: 400, width: 160, height: 140 }]; const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 });
  await settle(c, c.leanOn('a', { side: 'left' }), 10); run(c, 1); assert.equal(c.stateName, 'lean');
  assert.ok(c.pos.x > R[0].left + R[0].width, 'centre on card, x=' + c.pos.x); assert.equal(c.state.side, 'right');
});
test('GAP2 card as wide as the phone (both sides blocked): stands on top, no body overlap, inside viewport', async () => {
  const R = [{ id: 'a', left: 10, top: 500, width: 370, height: 150 }]; const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 });
  await settle(c, c.walkTo('a', { side: 'left' }), 10); assert.equal(hit(box(c), R[0]), false); assert.ok(Math.abs(c.pos.y - 500) < 2); assert.ok(c.pos.x >= c.halfW - 0.01 && c.pos.x <= 390 - c.halfW + 0.01);
});
test('GAP2 regression: normal layout gives the SAME trajectory as the verbatim #710 controller', async () => {
  const A = await make({ Ctor: Fixed }), B = await make({ Ctor: V710 }); const out = [];
  for (const [id, side] of [['a', 'left'], ['b', 'right'], ['a', 'top'], ['b', 'left']]) { await settle(A.c, A.c.walkTo(id, { side }), 12); await settle(B.c, B.c.walkTo(id, { side }), 12); out.push([A.c.pos.x - B.c.pos.x, A.c.pos.y - B.c.pos.y]); }
  for (const [dx, dy] of out) { assert.ok(Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6, 'diverged from #710: ' + dx + ',' + dy); }
});

// ---- GAP 3: keep-out rectangles for text
const TEXT = { left: 500, top: 150, width: 300, height: 560 }; // a paragraph column in the middle of the page
test('GAP3 setKeepOutRects exists and the character stands outside text areas (card placed under the text)', async () => {
  const R = [{ id: 'a', left: 400, top: 600, width: 600, height: 150 }]; const { c } = await make({ rects: R }); assert.equal(typeof c.setKeepOutRects, 'function'); c.setKeepOutRects([TEXT]);
  await settle(c, c.walkTo('a', { side: 'top' }), 10); assert.equal(hit(box(c), TEXT), false, 'standing box overlaps text'); assert.ok(c.pos.x >= R[0].left && c.pos.x <= R[0].left + R[0].width, 'must stay on the card');
});
test('GAP3 getKeepOutRects callback is polled every frame (text that moves into her)', async () => {
  let K = []; const R = [{ id: 'a', left: 400, top: 600, width: 260, height: 150 }]; const { c } = await make({ rects: R, extra: { getKeepOutRects: () => K } });
  await settle(c, c.walkTo('a', { side: 'left' }), 10); const x0 = c.pos.x; K = [{ left: x0 - 40, top: 300, width: 120, height: 400 }]; run(c, 1);
  assert.equal(hit(box(c), K[0]), false); assert.notEqual(c.pos.x, x0); assert.equal(hit(box(c), R[0]), false, 'slid into the card');
});
test('GAP3 clearing keep-out rects restores the normal position; text spanning the whole width leaves her in place (no NaN, no crash)', async () => {
  const R = [{ id: 'a', left: 400, top: 600, width: 600, height: 150 }]; const { c } = await make({ rects: R }); await settle(c, c.walkTo('a', { side: 'top' }), 10); const x0 = c.pos.x;
  c.setKeepOutRects([TEXT]); run(c, 1); assert.notEqual(c.pos.x, x0); c.setKeepOutRects([]); run(c, 2); assert.ok(Math.abs(c.pos.x - x0) < 1.5);
  c.setKeepOutRects([{ left: 0, top: 0, width: 1280, height: 800 }]); run(c, 1); assert.ok(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y));
});

// ---- the six actions still work (same flow as the integration suite)
test('six actions complete, preemption resolves, stand() clears queue (gap-fix controller)', async () => {
  const { c } = await make(); const res = {};
  res.walkTo = await settle(c, c.walkTo('b', { side: 'top' }), 10); res.leanOn = await settle(c, c.leanOn('a', { side: 'right' }), 10); res.stand = await settle(c, c.stand(), 2);
  res.jump = await settle(c, c.jump(), 3); res.wave = await settle(c, c.wave(2), 4); res.tilt = await settle(c, c.tilt('left', 1.4), 3);
  for (const [k, v] of Object.entries(res)) assert.equal(v.completed, true, k);
  const p1 = c.walkTo('a', { side: 'top' }); const p2 = c.walkTo('b', { side: 'top' }); const r1 = await settle(c, p1, 1); assert.equal(r1.reason, 'preempted'); await settle(c, p2, 12);
});
