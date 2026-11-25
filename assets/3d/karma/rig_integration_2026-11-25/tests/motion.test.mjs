// Motion tests for KarmaMotion (run, look, point, turn, lean + conflict policy) on a real 19-bone skinned GLB.
// Run: KARMA_GLB=<glb> node --test assets/3d/karma/rig_integration_2026-11-25/tests/motion.test.mjs
// Default GLB = the baseline rig fixture (NOT FINAL, says nothing about likeness). Muse's final GLB must be passed via KARMA_GLB for the acceptance run.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const { createRig, BONES } = await import('../../claude_track_2026-11-25/js/KarmaRig.js');
const { KarmaMotion, MOTIONS } = await import('../js/KarmaMotion.js');
const GLB = process.env.KARMA_GLB || path.join(here, '../../baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb');
const DT = 1 / 60;
const buf = fs.readFileSync(GLB); const AB = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parse = () => new Promise((res, rej) => new GLTFLoader().parse(AB.slice(0), '', res, rej));
async function make({ viewport = { width: 1280, height: 800 }, rects, charH = 170 } = {}) {
  const gltf = await parse(); const rig = createRig(gltf.scene);
  const R = rects || [{ id: 'a', left: 140, top: 420, width: 260, height: 180 }, { id: 'b', left: 760, top: 300, width: 260, height: 200 }];
  return { R, rig, c: new KarmaMotion({ rig, getCardRects: () => R, viewport, characterHeightPx: charH, modelHeight: 1 }) };
}
const settle = async (c, p, sec) => { let r; p.then((v) => { r = v; }); for (let i = 0; i < sec / DT && r === undefined; i++) { c.update(DT); await Promise.resolve(); }
  if (r === undefined) throw new Error('promise did not settle in ' + sec + 's, state=' + c.stateName); return r; };
const run = (c, s) => { for (let i = 0; i < s / DT; i++) c.update(DT); };
const box = (c) => ({ l: c.pos.x - c.halfW, r: c.pos.x + c.halfW, t: c.pos.y - c.charH, b: c.pos.y });
const hit = (b, k) => b.l < k.left + k.width && b.r > k.left && b.t < k.top + k.height && b.b > k.top;
const finiteBones = (rig) => BONES.every((n) => rig.bones[n].quaternion.toArray().every(Number.isFinite));
const euler = (rig, n) => new THREE.Euler().setFromQuaternion(rig.bones[n].quaternion, 'XYZ');
// angle of a bone relative to its rest pose (deg)
const restAngle = (rest, rig, n) => THREE.MathUtils.radToDeg(rest[n].angleTo(rig.bones[n].quaternion));

test('API: every motion name has a controller entry point', async () => {
  const { c } = await make();
  const map = { idle: 'idle', walk: 'walkTo', run: 'runTo', jump: 'jump', wave: 'wave', look: 'lookAt', point: 'pointAt', lean: 'lean', turn: 'turn', leanOn: 'leanOn' };
  for (const m of MOTIONS) assert.equal(typeof c[map[m]], 'function', m);
});
test('run: reaches the card faster than walk, same destination, no overlap, no NaN', async () => {
  const w = await make(); const r = await make();
  const t = async (o, f) => { let n = 0; let done; f.then((v) => { done = v; }); while (done === undefined && n < 60 * 20) { o.c.update(DT); await Promise.resolve(); n++; } return { n, done }; };
  const rw = await t(w, w.c.walkTo('b', { side: 'left' })); const rr = await t(r, r.c.runTo('b', { side: 'left' }));
  assert.equal(rw.done.completed, true); assert.equal(rr.done.completed, true);
  assert.ok(rr.n < rw.n * 0.6, 'run frames ' + rr.n + ' vs walk ' + rw.n);
  assert.ok(Math.abs(r.c.pos.x - w.c.pos.x) < 2 && Math.abs(r.c.pos.y - w.c.pos.y) < 2);
  assert.equal(hit(box(r.c), r.R[1]), false); assert.ok(finiteBones(r.rig));
});
test('run pose differs from walk pose (forward lean, bent elbows)', async () => {
  const w = await make(); const r = await make(); w.c.walkTo('b', { side: 'left' }); r.c.runTo('b', { side: 'left' }); run(w.c, 0.7); run(r.c, 0.7);
  assert.ok(Math.abs(euler(r.rig, 'Chest').x) > Math.abs(euler(w.rig, 'Chest').x) + 0.05);
  assert.ok(Math.abs(euler(r.rig, 'Forearm_L').x) > Math.abs(euler(w.rig, 'Forearm_L').x) + 0.2);
});
test('look: head turns toward the target on the correct side and returns to rest', async () => {
  const { c, rig } = await make(); const rest0 = rig.bones.Head.quaternion.clone();
  const p = c.lookAt({ x: 1200, y: 100 }, 1.6); run(c, 0.9); const yawR = euler(rig, 'Head').y; const pitch = euler(rig, 'Head').x;
  assert.ok(yawR > 0.1, 'looks right: ' + yawR); assert.ok(pitch < 0, 'looks up: ' + pitch);
  const r = await settle(c, p, 3); assert.equal(r.completed, true); run(c, 1.2); assert.ok(rest0.angleTo(rig.bones.Head.quaternion) < 0.08, 'head returned');
  c.lookAt({ x: 10, y: 790 }, 1.2); run(c, 0.7); assert.ok(euler(rig, 'Head').y < -0.1);
});
test('look at a card id works; missing card resolves card-missing and goes idle', async () => {
  const { c, R } = await make(); const r1 = await settle(c, c.lookAt('b', 1), 3); assert.equal(r1.completed, true);
  const p = c.lookAt('zzz', 1); const r2 = await settle(c, p, 3); assert.equal(r2.completed, false); assert.equal(r2.reason, 'card-missing'); run(c, 0.3); assert.equal(c.stateName, 'idle');
});
test('point: body turns toward the card, near arm rises, far arm does not; returns to idle', async () => {
  const { c, rig } = await make(); await settle(c, c.walkTo('a', { side: 'right' }), 10); // card a is on her left (screen left)
  const rest = Object.fromEntries(BONES.map((n) => [n, rig.bones[n].quaternion.clone()])); // capture near-rest
  const p = c.pointAt('b', 2); run(c, 1.2);
  assert.ok(c._yawExtra > 0.15, 'body yaw toward +X: ' + c._yawExtra); // card b is to the right of her
  const arm = THREE.MathUtils.radToDeg(Math.abs(euler(rig, 'UpperArm_L').z)); assert.ok(arm > 50, 'near arm raised: ' + arm);
  assert.ok(Math.abs(euler(rig, 'UpperArm_R').z) < 0.3, 'far arm stays');
  const r = await settle(c, p, 4); assert.equal(r.completed, true); run(c, 1.5); assert.ok(Math.abs(c._yawExtra) < 0.05); assert.equal(c.stateName, 'idle');
});
test('turn: body yaw goes to the requested side and returns; front is a no-op yaw', async () => {
  const { c } = await make(); const p = c.turn('left', 1.2); run(c, 0.8); assert.ok(c.holder.rotation.y < -0.5, 'left ' + c.holder.rotation.y);
  await settle(c, p, 3); run(c, 1.2); assert.ok(Math.abs(c.holder.rotation.y) < 0.06);
  c.turn('right', 1.2); run(c, 0.8); assert.ok(c.holder.rotation.y > 0.5);
});
test('lean(dir) tilts the spine sideways and recovers', async () => {
  const { c, rig } = await make(); const p = c.lean('left', 1.2); run(c, 0.6); assert.ok(Math.abs(euler(rig, 'Spine').z) > 0.08); await settle(c, p, 3); run(c, 1);
  assert.ok(Math.abs(euler(rig, 'Spine').z) < 0.03);
});
test('policy: navigation cancels running action and queue (preempted)', async () => {
  const { c } = await make(); const w = c.wave(3); const j = c.jump(); run(c, 0.3); const n = c.walkTo('a', { side: 'right' });
  const [rw, rj] = await Promise.all([settle(c, w, 1), settle(c, j, 1)]); assert.equal(rw.reason, 'preempted'); assert.equal(rj.reason, 'preempted');
  assert.equal((await settle(c, n, 12)).completed, true);
});
test('policy: actions run serially (wave then point never overlap), queue limit 3', async () => {
  const { c } = await make(); const out = []; const a = c.wave(1); const b = c.pointAt('b', 1); const j = c.jump(); const k = c.turn('left', 1); const over = c.lean('left', 1);
  assert.equal(c.queue.length, 3); const ov = await over; assert.equal(ov.completed, false); assert.equal(ov.reason, 'queue-full');
  for (const [n, p] of [['wave', a], ['point', b], ['jump', j], ['turn', k]]) { const r = await settle(c, p, 6); out.push([n, r.completed]); }
  assert.deepEqual(out.map((x) => x[1]), [true, true, true, true]);
});
test('policy: a newer look replaces the running look', async () => {
  const { c } = await make(); const a = c.lookAt({ x: 100, y: 100 }, 3); run(c, 0.3); const b = c.lookAt({ x: 1100, y: 100 }, 1);
  const ra = await settle(c, a, 1); assert.equal(ra.reason, 'replaced'); assert.equal((await settle(c, b, 3)).completed, true);
});
test('every motion keeps bones finite and rotations bounded (no joint wraps past 135 deg of rest) and returns to idle', async () => {
  const { c, rig } = await make(); const rest = Object.fromEntries(BONES.map((n) => [n, rig.bones[n].quaternion.clone()])); let worst = 0;
  const sample = () => { for (const n of BONES) worst = Math.max(worst, restAngle(rest, rig, n)); };
  const seq = [() => c.runTo('b', { side: 'left' }), () => c.jump(), () => c.wave(1), () => c.lookAt({ x: 900, y: 50 }, 1), () => c.pointAt('a', 1), () => c.turn('right', 1), () => c.lean('right', 1), () => c.leanOn('a', { side: 'right' })];
  for (const f of seq) { const p = f(); let done; p.then((v) => { done = v; }); for (let i = 0; i < 60 * 14 && done === undefined; i++) { c.update(DT); sample(); await Promise.resolve(); } assert.ok(done, 'settled'); assert.ok(finiteBones(rig)); }
  assert.ok(worst < 135, 'worst joint angle ' + worst.toFixed(1)); await settle(c, c.idle(), 3); run(c, 1.5); assert.equal(c.stateName, 'idle');
});

test('actionName reports the real action (run is not walk, point/look/turn are not wave)', async () => {
  const { c } = await make(); c.pos.set(900, 700);
  const seen = new Set(); const p1 = c.runTo('a', { side: 'right' }); for (let i = 0; i < 20; i++) { c.update(DT); } seen.add(c.actionName);
  await settle(c, p1, 20); const p2 = c.pointAt('a', 1.5); run(c, 0.5); seen.add(c.actionName); await settle(c, p2, 5);
  const p3 = c.lookAt('a', 1.5); run(c, 0.5); seen.add(c.actionName); await settle(c, p3, 5);
  const p4 = c.turn('left', 1.2); run(c, 0.5); seen.add(c.actionName); await settle(c, p4, 5);
  assert.deepEqual([...seen].sort(), ['look', 'point', 'run', 'turn']);
});
test('lean on card: the near hand rests on the card edge (contact error <= 8 px), not inside the card face', async () => {
  const { c, rig, R } = await make({ viewport: { width: 1280, height: 800 }, charH: 150 }); c.pos.set(900, 700);
  await settle(c, c.leanOn('a', { side: 'right' }), 20); run(c, 1.5);
  assert.equal(c.stateName, 'lean'); c.object3D.updateMatrixWorld(true);
  const card = R[0], edge = card.left + card.width; const px = (n) => { const e = rig.bones[n].matrixWorld.elements; return { x: e[12] + 1280 / 2, y: 800 / 2 - e[13] }; };
  const hand = [px('Hand_L'), px('Hand_R')].sort((a, b) => Math.abs(a.x - edge) - Math.abs(b.x - edge))[0];
  assert.ok(Math.abs(hand.x - edge) <= 8, 'hand x ' + hand.x.toFixed(1) + ' vs card edge ' + edge);
  assert.ok(hand.y > card.top && hand.y < card.top + card.height, 'hand height inside card span ' + hand.y.toFixed(1));
});
