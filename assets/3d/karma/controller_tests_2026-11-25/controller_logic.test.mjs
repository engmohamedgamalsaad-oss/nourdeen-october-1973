// assets/3d/karma/controller_tests_2026-11-25/controller_logic.test.mjs
// Unit tests for the placement and state logic in assets/3d/karma/js/KarmaController.js.
// Written 2026-11-25 against the CURRENT controller implementation. This is a new file; it is NOT the earlier 25-test file.
// No GLB is needed: the rig is synthetic (plain Object3D bones). Geometry is plain rectangles in canvas CSS px.
// Run:  npm i three@0.170.0  &&  node --test assets/3d/karma/controller_tests_2026-11-25/controller_logic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KarmaController } from '../js/KarmaController.js';

// ---------- fixtures ----------
const BONES = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'UpperArm_L', 'UpperArm_R', 'Forearm_L', 'Forearm_R', 'Hand_L', 'Hand_R',
  'UpperLeg_L', 'UpperLeg_R', 'LowerLeg_L', 'LowerLeg_R', 'Foot_L', 'Foot_R']; // the bones the controller drives
const VIEW = { width: 800, height: 600 };
const CH = 100; // character height px -> halfW 30, side gap 36 (halfW + 6), lean gap 10
const DT = 1 / 60;

function makeRig(rest = {}) {
  const scene = new THREE.Group(); const bones = {};
  for (const n of BONES) {
    const b = new THREE.Object3D(); b.name = n;
    if (rest[n]) b.quaternion.copy(rest[n]);
    scene.add(b); bones[n] = b;
  }
  return { scene, bones };
}
const card = (id, left, top, width, height) => ({ id, left, top, width, height });
/** Card A: feet spots are top-centre (400,300), left (264,380), right (536,380) on an 800x600 canvas. */
const A = () => card('a', 300, 300, 200, 80);

function setup({ cards = [], keepOut = null, viewport = VIEW, rig = makeRig() } = {}) {
  const env = { cards, keepOut };
  env.c = new KarmaController({
    rig, viewport: { ...viewport }, characterHeightPx: CH,
    getCardRects: () => env.cards, getKeepOutRects: () => env.keepOut,
  });
  return env;
}
const run = (c, seconds) => { for (let i = 0, n = Math.round(seconds / DT); i < n; i++) c.update(DT); };
const runUntil = (c, pred, max = 10) => { for (let i = 0, n = Math.round(max / DT); i < n; i++) { if (pred()) return true; c.update(DT); } return pred(); };
const peek = (p) => Promise.race([p, new Promise((r) => setImmediate(() => r('pending')))]);
const near = (actual, expected, eps = 1e-6, label = '') => assert.ok(Math.abs(actual - expected) <= eps, `${label} expected ${expected}, got ${actual}`);
const overlap = (box, k) => {
  const w = Math.min(box.r, k.left + k.width) - Math.max(box.l, k.left);
  const h = Math.min(box.b, k.top + k.height) - Math.max(box.t, k.top);
  return w > 0 && h > 0 ? w * h : 0;
};

// ---------- basics ----------
test('basics: starts at the bottom centre, idle, scaled to the character height', () => {
  const { c } = setup();
  near(c.pos.x, 400); near(c.pos.y, 600);
  near(c.object3D.position.x, 0); near(c.object3D.position.y, -300);
  near(c.object3D.scale.x, 100);
  assert.equal(c.stateName, 'idle');
});

test('basics: walking speed is 1.05 x character height per second', () => {
  const { c } = setup({ cards: [card('a', 100, 100, 200, 50)] });
  c.walkTo('a'); run(c, 1);
  near(Math.hypot(c.pos.x - 400, c.pos.y - 600), 105, 0.5);
});

test('basics: the controller works without a getKeepOutRects option', async () => {
  const c = new KarmaController({ rig: makeRig(), viewport: { ...VIEW }, characterHeightPx: CH, getCardRects: () => [A()] });
  const p = c.walkTo('a'); run(c, 6);
  assert.equal((await peek(p)).completed, true);
  near(c.pos.x, 400); near(c.pos.y, 300);
});

test('basics: update() clamps huge and negative time steps and never produces NaN', () => {
  const { c } = setup({ cards: [A()] });
  c.walkTo('a'); c.update(-1); c.update(10);
  assert.ok(c.time <= 0.05 + 1e-12, `time advanced by ${c.time}`);
  assert.ok(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y));
});

test('basics: setViewport pulls her back onto a smaller canvas', () => {
  const { c } = setup();
  c.setViewport(300, 400);
  near(c.pos.x, 270); near(c.pos.y, 400);
});

test('basics: authored rest rotations are preserved (idle does not drift bones that it does not drive)', () => {
  const restHips = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const restChest = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const rig = makeRig({ Hips: restHips, Chest: restChest });
  const { c } = setup({ rig });
  run(c, 1);
  near(rig.bones.Hips.quaternion.angleTo(restHips), 0, 1e-6, 'Hips');
  assert.ok(rig.bones.Chest.quaternion.angleTo(restChest) < 0.05, 'Chest only breathes by a small delta');
});

// ---------- perch-follow ----------
test('perch: walkTo(top) arrives on the card, resolves completed, ends idle and remembers the perch', async () => {
  const { c } = setup({ cards: [A()] });
  const p = c.walkTo('a'); run(c, 6);
  assert.equal((await peek(p)).completed, true);
  near(c.pos.x, 400); near(c.pos.y, 300);
  assert.equal(c.stateName, 'idle');
  assert.deepEqual(c.perch, { cardId: 'a', along: 0.5 });
});

test('perch: a small card move (< 0.45 x character height) is followed smoothly without starting a walk', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.walkTo('a'); run(c, 6);
  env.cards = [card('a', 320, 290, 200, 80)]; // +20 x, -10 y
  c.update(DT);
  assert.ok(c.pos.x > 400 && c.pos.x < 420, `first frame should move only part of the way, x=${c.pos.x}`);
  for (let i = 0; i < 180; i++) { c.update(DT); assert.equal(c.stateName, 'idle'); }
  near(c.pos.x, 420, 0.01); near(c.pos.y, 290, 0.01);
});

test('perch: a big card move starts a new walk, then she is perched on the card again', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.walkTo('a'); run(c, 6);
  env.cards = [card('a', 500, 300, 200, 80)]; // +200 x
  c.update(DT);
  assert.equal(c.stateName, 'walk');
  run(c, 6);
  assert.equal(c.stateName, 'idle');
  near(c.pos.x, 600); near(c.pos.y, 300);
  assert.equal(c.perch.cardId, 'a');
});

test('perch: keeps the requested along and clamps it to 0.05..0.95', () => {
  const env = setup({ cards: [A()] });
  env.c.walkTo('a', { along: 0.15 }); run(env.c, 6);
  near(env.c.pos.x, 330);
  env.cards = [card('a', 320, 300, 200, 80)]; run(env.c, 3);
  near(env.c.pos.x, 350, 0.01);
  const lo = setup({ cards: [A()] }); lo.c.walkTo('a', { along: 0 }); run(lo.c, 6); near(lo.c.pos.x, 310);
  const hi = setup({ cards: [A()] }); hi.c.walkTo('a', { along: 5 }); run(hi.c, 6); near(hi.c.pos.x, 490);
});

test('perch: walkTo, leanOn and stand each end perch-following immediately', () => {
  for (const [name, cmd] of [['walkTo', (c) => c.walkTo('b')], ['leanOn', (c) => c.leanOn('b')], ['stand', (c) => c.stand()]]) {
    const { c } = setup({ cards: [A(), card('b', 50, 100, 100, 40)] });
    c.walkTo('a'); run(c, 6);
    assert.ok(c.perch, `${name}: perch should exist before the command`);
    cmd(c);
    assert.equal(c.perch, null, `${name} should clear the perch`);
  }
});

test('perch: after stand() she no longer follows the card', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.walkTo('a'); run(c, 6); c.stand(); run(c, 0.5);
  const before = { x: c.pos.x, y: c.pos.y };
  env.cards = [card('a', 320, 290, 200, 80)]; run(c, 2);
  near(c.pos.x, before.x); near(c.pos.y, before.y);
});

test('perch: if the card disappears the perch is dropped and she stays where she is', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.walkTo('a'); run(c, 6);
  env.cards = []; run(c, 1);
  assert.equal(c.perch, null);
  near(c.pos.x, 400); near(c.pos.y, 300);
  env.cards = [card('a', 320, 290, 200, 80)]; run(c, 1); // a card that comes back does not pull her
  near(c.pos.x, 400); near(c.pos.y, 300);
});

// ---------- edge fallback (side placement) ----------
test('edge: with room on both sides the requested side is used (left and right)', async () => {
  for (const [side, x] of [['left', 264], ['right', 536]]) {
    const { c } = setup({ cards: [A()] });
    const p = c.walkTo('a', { side }); run(c, 8);
    assert.equal((await peek(p)).completed, true, side);
    near(c.pos.x, x, 1e-6, side); near(c.pos.y, 380, 1e-6, side);
    assert.equal(c.perch, null, 'standing beside a card is not a perch');
  }
});

test('edge: a card at the left screen edge puts her on its right side instead', () => {
  const { c } = setup({ cards: [card('a', 20, 300, 100, 80)] });
  c.walkTo('a', { side: 'left' }); run(c, 8);
  near(c.pos.x, 156); near(c.pos.y, 380);
});

test('edge: a card at the right screen edge puts her on its left side instead', () => {
  const { c } = setup({ cards: [card('a', 680, 300, 100, 80)] });
  c.walkTo('a', { side: 'right' }); run(c, 8);
  near(c.pos.x, 644); near(c.pos.y, 380);
});

test('edge: a card spanning the whole width puts her on top of it and she perches there', async () => {
  const { c } = setup({ cards: [card('a', 0, 300, 800, 80)] });
  const p = c.walkTo('a', { side: 'left' }); run(c, 8);
  assert.equal((await peek(p)).completed, true);
  near(c.pos.x, 400); near(c.pos.y, 300);
  assert.equal(c.perch.cardId, 'a');
});

test('edge: leanOn on the normal side leans toward the card (state lean, side left)', () => {
  const { c } = setup({ cards: [A()] });
  c.leanOn('a', { side: 'left' }); run(c, 6);
  assert.equal(c.stateName, 'lean');
  assert.equal(c.state.side, 'left');
  near(c.pos.x, 290); near(c.pos.y, 380);
  assert.ok(c.facing > 0.25, `facing ${c.facing}`);
});

test('edge: leanOn at the left screen edge flips to the right side and the lean pose mirrors', () => {
  const { c } = setup({ cards: [card('a', 20, 300, 100, 80)] });
  c.leanOn('a', { side: 'left' }); run(c, 6);
  assert.equal(c.stateName, 'lean');
  assert.equal(c.state.side, 'right');
  near(c.pos.x, 130); near(c.pos.y, 380);
  assert.ok(c.facing < -0.25, `facing ${c.facing}`);
});

test('edge: leanOn a full-width card stands on top instead of leaning', async () => {
  const { c } = setup({ cards: [card('a', 0, 300, 800, 80)] });
  const p = c.leanOn('a', { side: 'left' }); run(c, 8);
  assert.equal((await peek(p)).completed, true);
  assert.equal(c.stateName, 'idle');
  near(c.pos.x, 400); near(c.pos.y, 300);
  assert.equal(c.perch.cardId, 'a');
});

// ---------- keep-out rectangles ----------
const KEEP_MID = { left: 380, top: 200, width: 40, height: 100 }; // covers the middle of card A's top spot

test('keep-out: with no keep-out rectangles the requested top spot is used', () => {
  const { c } = setup({ cards: [A()] });
  c.walkTo('a'); run(c, 6);
  near(c.pos.x, 400); near(c.pos.y, 300);
});

test('keep-out: a covered top spot moves to the first clear fraction (0.15) of the card, via live or static rects', () => {
  const live = setup({ cards: [A()], keepOut: [KEEP_MID] });
  live.c.walkTo('a'); run(live.c, 6);
  const stat = setup({ cards: [A()] });
  stat.c.setKeepOutRects([KEEP_MID]); stat.c.walkTo('a'); run(stat.c, 6);
  for (const { c } of [live, stat]) {
    near(c.pos.x, 330); near(c.pos.y, 300);
    const box = { l: c.pos.x - 30, r: c.pos.x + 30, t: c.pos.y - CH, b: c.pos.y };
    assert.equal(overlap(box, KEEP_MID), 0);
  }
});

test('keep-out: when every spot is equally covered the requested one wins', () => {
  const { c } = setup({ cards: [A()], keepOut: [{ left: 0, top: 0, width: 800, height: 300 }] });
  c.walkTo('a'); run(c, 6);
  near(c.pos.x, 400);
});

test('keep-out: rectangles supplied by getKeepOutRects are read every frame (she moves away, and back when cleared)', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.walkTo('a'); run(c, 6); near(c.pos.x, 400);
  env.keepOut = [KEEP_MID]; run(c, 6);
  near(c.pos.x, 330); assert.equal(c.stateName, 'idle');
  assert.equal(c.perch.along, 0.5, 'the requested along is kept so she can return');
  env.keepOut = []; run(c, 6);
  near(c.pos.x, 400);
});

test('keep-out: a side spot covered by text moves her to the other side', () => {
  const { c } = setup({ cards: [A()], keepOut: [{ left: 500, top: 280, width: 100, height: 100 }] });
  c.walkTo('a', { side: 'right' }); run(c, 8);
  near(c.pos.x, 264); near(c.pos.y, 380);
});

test('keep-out: being pushed off-screen is worse than overlapping keep-out text', () => {
  const { c } = setup({ cards: [card('a', 20, 300, 100, 80)], keepOut: [{ left: 0, top: 0, width: 400, height: 600 }] });
  c.walkTo('a', { side: 'left' }); run(c, 8);
  near(c.pos.x, 156); near(c.pos.y, 380); // right side: overlaps text but fits on screen
});

test('keep-out: invalid rectangles are dropped, valid ones are copied, [] and non-arrays clear the list', () => {
  const { c } = setup();
  c.setKeepOutRects([null, undefined, 'x', { left: NaN, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 0, height: 10 },
    { left: 0, top: 0, width: 10, height: -5 }, { left: Infinity, top: 0, width: 10, height: 10 }]);
  assert.equal(c.keepOutStatic.length, 0);
  const good = { left: 1, top: 2, width: 3, height: 4, extra: 'ignored' };
  c.setKeepOutRects([good, null]);
  assert.deepEqual(c.keepOutStatic, [{ left: 1, top: 2, width: 3, height: 4 }]);
  c.setKeepOutRects([{ left: 9, top: 9, width: 9, height: 9 }]);
  assert.equal(c.keepOutStatic.length, 1, 'a new list replaces the previous one');
  c.setKeepOutRects([]); assert.equal(c.keepOutStatic.length, 0);
  c.setKeepOutRects([good]); c.setKeepOutRects('nope'); assert.equal(c.keepOutStatic.length, 0);
});

test('keep-out: a getKeepOutRects that returns a non-array is ignored without throwing', () => {
  const env = setup({ cards: [A()], keepOut: 'bad' }); const { c } = env;
  c.walkTo('a'); run(c, 6);
  assert.equal(c.keepOutLive.length, 0);
  near(c.pos.x, 400);
});

// ---------- state transitions ----------
test('state: a new navigation command preempts the running walk and queued actions', async () => {
  const { c } = setup({ cards: [A(), card('b', 50, 100, 100, 40)] });
  const p1 = c.walkTo('a'); run(c, 0.5);
  const pw = c.wave(0.5);
  c.walkTo('b');
  assert.deepEqual(await peek(p1), { completed: false, reason: 'preempted' });
  assert.deepEqual(await peek(pw), { completed: false, reason: 'preempted' });
});

test('state: stand() resolves completed only after the neutral pose has had time to blend in', async () => {
  const { c } = setup();
  const p = c.stand(); run(c, 0.2);
  assert.equal(await peek(p), 'pending');
  run(c, 0.2);
  assert.equal((await peek(p)).completed, true);
});

test('state: walking to a card that does not exist resolves card-missing and returns to idle', async () => {
  const { c } = setup();
  const p = c.walkTo('nope'); run(c, 0.2);
  assert.deepEqual(await peek(p), { completed: false, reason: 'card-missing' });
  assert.equal(c.stateName, 'idle');
});

test('state: a wave requested while walking is queued and plays after arrival', async () => {
  const { c } = setup({ cards: [A()] });
  const pw = c.walkTo('a'); const pv = c.wave(0.5);
  c.update(DT);
  assert.equal(c.stateName, 'walk');
  assert.ok(runUntil(c, () => c.stateName === 'wave', 6), 'wave should start after the walk');
  assert.equal((await peek(pw)).completed, true);
  assert.equal(await peek(pv), 'pending');
  assert.ok(runUntil(c, () => c.stateName === 'idle', 2));
  assert.equal((await peek(pv)).completed, true);
});

test('state: a wave from idle starts immediately and returns to idle', async () => {
  const { c } = setup();
  const p = c.wave(0.5);
  assert.equal(c.stateName, 'wave');
  run(c, 0.7);
  assert.equal((await peek(p)).completed, true);
  assert.equal(c.stateName, 'idle');
});

test('state: a jump during a lean resumes the lean afterwards', async () => {
  const { c } = setup({ cards: [A()] });
  c.leanOn('a', { side: 'left' }); run(c, 6);
  assert.equal(c.stateName, 'lean');
  const pj = c.jump();
  assert.equal(c.stateName, 'jump');
  run(c, 1.3);
  assert.equal((await peek(pj)).completed, true);
  assert.equal(c.stateName, 'lean');
});

test('state: a lean follows a small card drift, but a big move makes her walk over and lean again', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.leanOn('a', { side: 'left' }); run(c, 6);
  env.cards = [card('a', 310, 300, 200, 80)]; // +10 x
  for (let i = 0; i < 120; i++) { c.update(DT); assert.equal(c.stateName, 'lean'); }
  near(c.pos.x, 300, 0.01);
  env.cards = [card('a', 600, 300, 200, 80)]; // +290 x
  c.update(DT);
  assert.equal(c.stateName, 'walk');
  assert.ok(runUntil(c, () => c.stateName === 'lean', 8), 'should lean again after walking over');
  run(c, 1);
  near(c.pos.x, 590, 0.01);
});

test('state: keep-out text appearing beside a leaning Karma makes her walk to the other side and lean from there', () => {
  const env = setup({ cards: [A()] }); const { c } = env;
  c.leanOn('a', { side: 'left' }); run(c, 6);
  assert.equal(c.state.side, 'left');
  env.keepOut = [{ left: 200, top: 250, width: 130, height: 150 }]; // covers the left lean spot
  assert.ok(runUntil(c, () => c.stateName === 'walk', 1), 'she should start walking to the other side');
  assert.ok(runUntil(c, () => c.stateName === 'lean', 8), 'and lean again');
  run(c, 1);
  assert.equal(c.state.side, 'right');
  near(c.pos.x, 510, 0.01); near(c.pos.y, 380, 0.01);
  assert.ok(c.facing < -0.25, `facing ${c.facing}`);
});
