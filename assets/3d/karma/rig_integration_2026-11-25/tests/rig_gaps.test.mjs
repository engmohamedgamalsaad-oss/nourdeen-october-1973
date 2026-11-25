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

// ---- walk path clearance (README known gap 1): full trajectory, sampled every frame, not just the endpoint ----
const overlapFrames = (c, R, hwScale = 0.9) => { let n = 0, first = null; const hw = c.halfW * hwScale;
  for (const r of R) if (c.pos.x + hw > r.left + 0.5 && c.pos.x - hw < r.left + r.width - 0.5 && c.pos.y > r.top + 0.5 && c.pos.y - c.charH < r.top + r.height - 0.5) { n++; first = first || [Math.round(c.pos.x), Math.round(c.pos.y), r.id]; }
  return { n, first }; };
async function walkTrace(c, R, p, seconds) { let r; p.then((v) => { r = v; }); let bad = 0, first = null, frames = 0;
  for (let i = 0; i < seconds / DT && r === undefined; i++) { c.update(DT); await Promise.resolve(); frames++; const o = overlapFrames(c, R); if (o.n) { bad++; first = first || o.first; } }
  return { r, bad, first, frames }; }
for (const [name, mode] of [['walk', 'walkTo'], ['run', 'runTo']]) test('path: ' + name + ' from the far side of a card to its other side never crosses any card (every frame)', async () => {
  const R = [{ id: 'a', left: 500, top: 300, width: 260, height: 300 }];
  const { c } = await make({ rects: R }); c.pos.set(120, 650); c.update(DT);   // start left of the card, feet below it
  c.pos.x = 120; c.pos.y = 450;                                                  // beside it, same height band as the card
  const t = await walkTrace(c, R, c[mode]('a', { side: 'right' }), 20);
  assert.equal(t.r.completed, true, 'did not arrive');
  assert.equal(t.bad, 0, 'crossed a card in ' + t.bad + ' of ' + t.frames + ' frames, first at ' + JSON.stringify(t.first));
});
test('path: with no card in the way the walk is still a straight line (no needless detour)', async () => {
  const R = [{ id: 'a', left: 500, top: 300, width: 260, height: 300 }];
  const { c } = await make({ rects: R }); c.pos.set(1100, 700); c.update(DT);
  c.pos.x = 1100; c.pos.y = 700; const start = { x: c.pos.x, y: c.pos.y }; const p = c.walkTo('a', { side: 'right' });
  let maxDev = 0, r; p.then((v) => { r = v; }); const tgt = c._resolve(c.anchor);
  for (let i = 0; i < 20 / DT && r === undefined; i++) { c.update(DT); await Promise.resolve();
    const L = Math.hypot(tgt.x - start.x, tgt.y - start.y) || 1; maxDev = Math.max(maxDev, Math.abs((tgt.x - start.x) * (start.y - c.pos.y) - (start.x - c.pos.x) * (tgt.y - start.y)) / L); }
  assert.equal(r.completed, true); assert.ok(maxDev < 2, 'deviated from the straight line by ' + maxDev.toFixed(1) + ' px');
});

// Seeded fuzz: random non-overlapping card layouts (desktop and phone sized), random start, random card and side, walk or run.
// Counts frames where the standing box overlaps ANY card. A route may legitimately not exist (cards packed edge to edge): those are counted
// separately as `noRoute` (she then walks straight, the old behaviour) and are NOT hidden in the pass count.
test('path fuzz: 60 seeded scenarios, no frame crosses a card', async () => {
  let seed = 1234567; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let ran = 0, crossed = 0, arrived = 0, endpointInOtherCard = 0, held = 0; const bad = [];
  for (let k = 0; k < 60; k++) {
    const phone = k % 2 === 1, vp = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, charH = phone ? 120 : 170;
    const R = []; const want = 2 + Math.floor(rnd() * 3);
    for (let t = 0; t < 60 && R.length < want; t++) { const w = phone ? 150 + rnd() * 100 : 200 + rnd() * 160, h = 90 + rnd() * 140;
      const r = { id: 'c' + R.length, left: 10 + rnd() * (vp.width - w - 20), top: 60 + rnd() * (vp.height - h - 240), width: w, height: h };
      if (R.every((o) => r.left > o.left + o.width + 0.35 * charH + 4 || r.left + r.width + 0.35 * charH + 4 < o.left || r.top > o.top + o.height + charH + 4 || r.top + r.height + charH + 4 < o.top)) R.push(r); }
    if (!R.length) continue;
    const { c } = await make({ viewport: vp, rects: R, charH });
    c.pos.set(c.halfW + rnd() * (vp.width - 2 * c.halfW), charH + rnd() * (vp.height - charH)); c.update(DT);
    const hw0 = c.halfW * 0.9; if (R.some((r) => c.pos.x + hw0 > r.left && c.pos.x - hw0 < r.left + r.width && c.pos.y > r.top && c.pos.y - c.charH < r.top + r.height)) continue; // started inside a card: not a path test
    const id = R[Math.floor(rnd() * R.length)].id, side = ['left', 'right', 'top'][Math.floor(rnd() * 3)];
    const t = await walkTrace(c, R, rnd() < 0.5 ? c.walkTo(id, { side }) : c.runTo(id, { side }), 25);
    if (process.env.FUZZ_DEBUG && k === +process.env.FUZZ_DEBUG) console.log('# DBG', JSON.stringify({R: R.map(r=>({id:r.id,l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)})), id, side, start: t.first, pos: [Math.round(c.pos.x), Math.round(c.pos.y)], halfW: c.halfW, tgt: c._resolve({cardId:id,side,along:0.5}), route: c._route}));
    ran++; if (t.r && t.r.completed) { arrived++; const e = c.pos; if (R.some((r) => r.id !== id && e.x + hw0 > r.left && e.x - hw0 < r.left + r.width && e.y > r.top && e.y - c.charH < r.top + r.height)) endpointInOtherCard++; } else held++; if (t.bad) { crossed++; if (c._route === null && c._routeFor) { } bad.push({ k, vp: phone ? 'phone' : 'desk', side, first: t.first, bad: t.bad }); }
  }
  console.log('# FUZZ ' + JSON.stringify({ ran, arrived, endsInsideOtherCard: endpointInOtherCard, held, crossedScenarios: crossed, details: bad.slice(0, 8) }));
  assert.ok(ran >= 30, 'too few valid scenarios: ' + ran);
  assert.equal(endpointInOtherCard, 0, 'walks that ended inside a neighbour card: ' + endpointInOtherCard);
  assert.equal(arrived + held, ran);
  assert.equal(crossed, 0, 'scenarios with a crossing: ' + JSON.stringify(bad.slice(0, 5)));
});

// Safety-hold tests: no clear route / no clear standing spot => she holds, never crosses or ends inside a card.
const inCard = (c, R, skip) => R.some((r) => r.id !== skip && c.pos.x + c.halfW * 0.9 > r.left && c.pos.x - c.halfW * 0.9 < r.left + r.width && c.pos.y > r.top && c.pos.y - c.charH < r.top + r.height);
test('no-route: a wall of cards across the whole width => she holds (completed:false, no crossing), not a straight walk through text', async () => {
  const R = [{ id: 'w1', left: 0, top: 300, width: 660, height: 120 }, { id: 'w2', left: 660, top: 300, width: 620, height: 120 }, { id: 'tg', left: 500, top: 100, width: 200, height: 80 }];
  const { c } = await make({ rects: R }); c.pos.set(300, 780); c.update(DT); c.pos.set(300, 780);
  const t = await walkTrace(c, R, c.walkTo('tg', { side: 'right' }), 20);
  assert.equal(t.r.completed, false); assert.equal(t.bad, 0, 'crossed in ' + t.bad + ' frames'); assert.ok(c.pos.y > 420, 'she went past the wall');
});
test('adjacent-card endpoint: requested side is filled by a neighbour card => she ends in a clear spot or holds, never inside the neighbour', async () => {
  const R = [{ id: 'a', left: 500, top: 300, width: 200, height: 160 }, { id: 'n', left: 705, top: 300, width: 220, height: 160 }];
  for (const side of ['right', 'left']) { const { c } = await make({ rects: R }); c.pos.set(100, 700); c.update(DT); c.pos.set(100, 700);
    const t = await walkTrace(c, R, c.walkTo('a', { side }), 25); assert.equal(t.bad, 0, side + ' crossed'); assert.ok(!inCard(c, R, 'a'), side + ': ended inside the neighbour card'); }
});
test('adjacent-card endpoint, no clear spot at all => refused (completed:false), not placed inside text', async () => {
  const R = [{ id: 'l', left: 0, top: 300, width: 590, height: 160 }, { id: 'a', left: 590, top: 300, width: 100, height: 160 }, { id: 'r', left: 690, top: 300, width: 590, height: 160 }];
  const { c } = await make({ rects: R }); c.pos.set(640, 700); c.update(DT); c.pos.set(640, 700);
  const t = await walkTrace(c, R, c.walkTo('a', { side: 'right' }), 20); assert.equal(t.r.completed, false); assert.ok(!inCard(c, R, 'a'));
});
test('moving obstruction: a card slides into the planned route mid-walk => route is re-planned, no frame crosses', async () => {
  const R = [{ id: 'a', left: 500, top: 300, width: 260, height: 300 }, { id: 'm', left: 200, top: 700, width: 120, height: 60 }];
  const { c } = await make({ rects: R }); c.pos.set(100, 450); c.update(DT); c.pos.set(100, 450);
  let n = 0; const p = c.walkTo('a', { side: 'right' }); let r; p.then((v) => { r = v; }); let bad = 0;
  for (let i = 0; i < 25 / DT && r === undefined; i++, n++) { if (n === 60) { R[1].left = 150; R[1].top = 600; R[1].width = 200; R[1].height = 120; }
    c.update(DT); await Promise.resolve(); if (n > 61 && R.some((q) => c.pos.x + c.halfW * 0.9 > q.left + 1 && c.pos.x - c.halfW * 0.9 < q.left + q.width - 1 && c.pos.y > q.top + 1 && c.pos.y - c.charH < q.top + q.height - 1 && !(q.id === 'a' && Math.hypot(c.pos.x - (q.left + q.width), c.pos.y - (q.top + q.height)) < c.charH))) bad++; }
  assert.ok(r, 'did not settle'); assert.equal(bad, 0, 'crossed in ' + bad + ' frames after the card moved');
});
test('resize obstruction: viewport narrows mid-walk (setViewport) => no frame crosses, ends inside the viewport', async () => {
  const R = [{ id: 'a', left: 300, top: 300, width: 200, height: 200 }];
  const { c } = await make({ rects: R, viewport: { width: 1280, height: 800 } }); c.pos.set(1100, 700); c.update(DT); c.pos.set(1100, 700);
  const p = c.walkTo('a', { side: 'right' }); let r; p.then((v) => { r = v; });
  for (let i = 0; i < 25 / DT && r === undefined; i++) { if (i === 30) c.setViewport(600, 800); c.update(DT); await Promise.resolve(); }
  assert.ok(r, 'did not settle'); assert.ok(c.pos.x <= 600 + 1 && c.pos.x >= 0); assert.ok(!inCard(c, R, 'a'));
});
