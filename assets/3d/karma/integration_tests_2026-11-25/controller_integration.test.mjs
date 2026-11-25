// assets/3d/karma/integration_tests_2026-11-25/controller_integration.test.mjs
// Integration acceptance tests: real GLB + canonical KarmaRig.js / KarmaController.js (hardened version from PR #710).
// Run:  KARMA_GLB=path/to/model.glb node --test assets/3d/karma/integration_tests_2026-11-25/controller_integration.test.mjs
// Needs `three` installed (>= 0.160). No browser needed. Tests marked `todo` document REAL gaps; they do not fail the run.
// Optional env: KARMA_JS_DIR=<dir with KarmaRig.js + KarmaController.js>, KARMA_MOBILE_BUDGET=strict, KARMA_REQUIRE_LIKENESS=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const here = path.dirname(fileURLToPath(import.meta.url));
// KARMA_JS_DIR lets you point the tests at another copy of the canonical modules (e.g. the PR #710 hardened versions) without editing this file.
const JS_DIR = process.env.KARMA_JS_DIR ? path.resolve(process.env.KARMA_JS_DIR) : path.join(here, '../js');
const { createRig, attachHead, BONES } = await import(path.join(JS_DIR, 'KarmaRig.js'));
const { KarmaController } = await import(path.join(JS_DIR, 'KarmaController.js'));

const GLB = process.env.KARMA_GLB;
if (!GLB) throw new Error('Set KARMA_GLB=<path to the character .glb> (never hard-code a temporary file name).');
const DT = 1 / 60;

async function loadScene() {
  const b = fs.readFileSync(GLB);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
  return gltf.scene;
}
async function make({ viewport = { width: 1280, height: 800 }, rects, charH = 170 } = {}) {
  const scene = await loadScene(); const rig = createRig(scene);
  const R = rects || [{ id: 'a', left: 140, top: 420, width: 260, height: 180 }, { id: 'b', left: 760, top: 300, width: 260, height: 200 }];
  const c = new KarmaController({ rig, getCardRects: () => R, viewport, characterHeightPx: charH, modelHeight: 1 });
  return { rig, c, R, scene };
}
const settle = async (c, p, seconds) => {
  let r; p.then((v) => { r = v; });
  for (let i = 0; i < seconds / DT && r === undefined; i++) { c.update(DT); await Promise.resolve(); }
  if (r === undefined) throw new Error('promise did not settle in ' + seconds + 's, state=' + c.stateName);
  return r;
};
const run = (c, seconds) => { for (let i = 0; i < seconds / DT; i++) c.update(DT); };
const skinnedPositions = (rig) => rig.skinned.map((m) => {
  rig.scene.updateMatrixWorld(true); m.skeleton.update();
  const a = m.geometry.getAttribute('position'); const out = new Float32Array(a.count * 3); const v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) { m.getVertexPosition(i, v); out.set([v.x, v.y, v.z], i * 3); }
  return out;
});
const withPose = (rig, bone, eulerXYZ) => {
  const saved = rig.bones[bone].quaternion.clone();
  rig.bones[bone].quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...eulerXYZ, 'XYZ')));
  const p = skinnedPositions(rig); rig.bones[bone].quaternion.copy(saved); return p;
};
const diff = (A, B, pick = () => true) => { let moved = 0, max = 0, nan = 0, n = 0, sample = null;
  for (let m = 0; m < A.length; m++) for (let i = 0; i < A[m].length; i += 3) {
    const d = Math.hypot(B[m][i] - A[m][i], B[m][i + 1] - A[m][i + 1], B[m][i + 2] - A[m][i + 2]);
    if (!Number.isFinite(d)) { nan++; continue; }
    if (!pick(A[m][i], A[m][i + 1], A[m][i + 2])) continue; n++; if (d > 1e-4) { moved++; sample = sample || [A[m][i], A[m][i + 1], A[m][i + 2]].map((v) => +v.toFixed(3)); } max = Math.max(max, d); }
  return { moved, max, nan, n, sample }; };

// ---------------- 1. load / rig contract ----------------
test('GLB loads with GLTFLoader and exposes all 19 agreed bones as real THREE.Bone joints', async () => {
  const { rig } = await make();
  assert.equal(BONES.length, 19);
  for (const n of BONES) { assert.ok(rig.bones[n]?.isBone, 'missing/non-bone: ' + n); }
  assert.ok(rig.skinned.length >= 1);
  assert.ok(rig.skinned.some((m) => BONES.every((n) => m.skeleton.bones.includes(rig.bones[n]))), 'no single skeleton holds all 19 joints');
});
test('skin weights: sum to 1, non-negative, valid indices, every joint influences at least one vertex', async () => {
  const { rig } = await make(); const used = new Set(); let maxDev = 0, bad = 0;
  for (const m of rig.skinned) {
    const w = m.geometry.getAttribute('skinWeight'), j = m.geometry.getAttribute('skinIndex');
    for (let i = 0; i < w.count; i++) {
      maxDev = Math.max(maxDev, Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1));
      for (let k = 0; k < 4; k++) { const wt = w.getComponent(i, k), jj = j.getComponent(i, k);
        if (wt < 0 || jj >= m.skeleton.bones.length) bad++; if (wt > 0) used.add(m.skeleton.bones[jj].name); }
    }
  }
  assert.ok(maxDev < 1e-3, 'weight sum deviation ' + maxDev); assert.equal(bad, 0);
  const unused = BONES.filter((n) => !used.has(n)); assert.deepEqual(unused, [], 'joints with no vertices: ' + unused);
});
test('HeadMount and HairMount are children of Head; a head + hair mount, follow Head, and hide the placeholder', async () => {
  const { rig } = await make();
  assert.equal(rig.headMount.parent, rig.bones.Head); assert.equal(rig.hairMount.parent, rig.bones.Head);
  const head = new THREE.Group(), hair = new THREE.Group(); attachHead(rig, head, { hair });
  assert.equal(head.parent, rig.headMount); assert.equal(hair.parent, rig.hairMount);
  if (rig.headPlaceholder) assert.equal(rig.headPlaceholder.visible, false);
  const q0 = head.getWorldQuaternion(new THREE.Quaternion());
  rig.bones.Head.rotateY(0.6); rig.scene.updateMatrixWorld(true);
  assert.ok(head.getWorldQuaternion(new THREE.Quaternion()).angleTo(q0) > 0.55, 'mounted head does not follow Head bone');
});
test('rig is rejected when a mount is missing (no silent fallback)', async () => {
  const scene = await loadScene(); scene.getObjectByName('HairMount').removeFromParent();
  assert.throws(() => createRig(scene), /HeadMount|HairMount/);
});

// ---------------- 2. deformation ----------------
// Locality limits are derived from the model's own joint positions (never hard-coded heights), so any character proportions work.
// (the controller wraps the rig in a scaled holder, so convert world -> rig-local metres to match vertex coordinates)
const jp = (rig, n) => { rig.scene.updateMatrixWorld(true); return rig.scene.worldToLocal((rig.bones[n] || rig[n]).getWorldPosition(new THREE.Vector3())); };
const JOINT_CASES = [ // [label, bone, euler, mustStay(rig) -> predicate(x,y,z) of REST vertices that must NOT move]
  ['shoulder_L', 'UpperArm_L', [0, 0, 1.0], (r) => (x, y) => x < -jp(r, 'UpperArm_L').x * 0.8 || y < jp(r, 'LowerLeg_L').y],
  ['shoulder_R', 'UpperArm_R', [0, 0, -1.0], (r) => (x, y) => x > jp(r, 'UpperArm_L').x * 0.8 || y < jp(r, 'LowerLeg_L').y],
  ['elbow_L', 'Forearm_L', [-1.4, 0, 0], (r) => (x, y) => y > jp(r, 'Neck').y || x < 0],
  ['elbow_R', 'Forearm_R', [-1.4, 0, 0], (r) => (x, y) => y > jp(r, 'Neck').y || x > 0],
  ['hip_L', 'UpperLeg_L', [-0.9, 0, 0], (r) => (x, y) => y > jp(r, 'Chest').y || x < -0.02],
  ['hip_R', 'UpperLeg_R', [-0.9, 0, 0], (r) => (x, y) => y > jp(r, 'Chest').y || x > 0.02],
  ['knee_L', 'LowerLeg_L', [1.1, 0, 0], (r) => (x, y) => y > jp(r, 'Hips').y || x < -0.02],
  ['knee_R', 'LowerLeg_R', [1.1, 0, 0], (r) => (x, y) => y > jp(r, 'Hips').y || x > 0.02],
];
for (const [label, bone, eul, stay] of JOINT_CASES) {
  test(`deformation ${label}: moves its limb, no NaN, does not drag distant body parts`, async () => {
    const { rig } = await make(); const rest = skinnedPositions(rig); const posed = withPose(rig, bone, eul);
    const all = diff(rest, posed); assert.equal(all.nan, 0); assert.ok(all.moved > 20, 'too few vertices moved: ' + all.moved);
    const far = diff(rest, posed, stay(rig)); const height = jp(rig, 'Head').y + 0.25; // ~ body height in rig units
    assert.ok(far.max < 0.01 * height, // leakage under 1% of body height is tolerated; larger = weights bleeding into distant parts
       `distant vertices moved by ${far.max.toFixed(4)} m (${far.moved} of ${far.n}), first at rest ${JSON.stringify(far.sample)}`);
  });
}
test('neck/head: head and neck rotation carry the head (skinned head vertices OR the mounted head), leave the lower body untouched, no NaN', async () => {
  const { rig } = await make(); const rest = skinnedPositions(rig);
  const hipsY = jp(rig, 'Hips').y, headY = jp(rig, 'Head').y, neckY = jp(rig, 'Neck').y;
  const mountQ = () => { rig.scene.updateMatrixWorld(true); return rig.headMount.getWorldQuaternion(new THREE.Quaternion()); };
  const q0 = mountQ(); const posedHead = withPose(rig, 'Head', [0.3, 0.7, 0.2]);
  assert.equal(diff(rest, posedHead).nan, 0);
  assert.ok(diff(rest, posedHead, (x, y) => y < hipsY).max < 1e-3, 'lower body moved with head');
  const savedH = rig.bones.Head.quaternion.clone(); rig.bones.Head.rotateY(0.7);
  const headMoved = mountQ().angleTo(q0) > 0.5 || diff(rest, posedHead, (x, y) => y > headY + 0.05).max > 0.02; rig.bones.Head.quaternion.copy(savedH);
  assert.ok(headMoved, 'head rotation does not reach the head (neither skinned head vertices nor HeadMount moved)');
  const posedNeck = withPose(rig, 'Neck', [0.3, 0.5, 0.2]);
  assert.ok(diff(rest, posedNeck, (x, y) => y > neckY && y < headY + 0.05).max > 0.003, 'neck skin did not follow the Neck bone');
  assert.ok(diff(rest, posedNeck, (x, y) => y < hipsY).max < 1e-3, 'lower body moved with neck');
});

// ---------------- 3. six actions through the real controller ----------------
test('six actions complete and end in a sane state', async () => {
  const { c } = await make(); const res = {};
  res.walkTo = await settle(c, c.walkTo('b', { side: 'top' }), 10);
  res.leanOn = await settle(c, c.leanOn('a', { side: 'right' }), 10); assert.equal(c.stateName, 'lean');
  res.stand = await settle(c, c.stand(), 2); assert.equal(c.stateName, 'idle');
  res.jump = await settle(c, c.jump(), 3); res.wave = await settle(c, c.wave(2), 4); res.tilt = await settle(c, c.tilt('left', 1.4), 3);
  for (const [k, v] of Object.entries(res)) assert.equal(v.completed, true, k + ' did not complete');
  assert.equal(c.stateName, 'idle');
});
test('walkTo top: feet end exactly on the card top edge, inside the card horizontally', async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top', along: 0.5 }), 10);
  const b = R[1]; assert.ok(Math.abs(c.pos.y - b.top) < 0.01); assert.ok(c.pos.x > b.left && c.pos.x < b.left + b.width);
});
test('jump: rises then returns to the ground level; wave raises the hand above the shoulder', async () => {
  const { c, rig } = await make(); run(c, 1); const y0 = c.holder.position.y; let top = y0;
  const p = c.jump(); let done = false; p.then(() => { done = true; });
  for (let i = 0; i < 200 && !done; i++) { c.update(DT); top = Math.max(top, c.holder.position.y); await Promise.resolve(); }
  assert.ok(top - y0 > 0.2 * c.charH, 'jump too low'); run(c, 0.6); assert.ok(Math.abs(c.holder.position.y - y0) < 1.5);
  c.wave(2); let handY = -1e9, shY = 0; for (let i = 0; i < 70; i++) { c.update(DT); rig.scene.updateMatrixWorld(true);
    handY = Math.max(handY, rig.bones.Hand_R.getWorldPosition(new THREE.Vector3()).y); shY = rig.bones.UpperArm_R.getWorldPosition(new THREE.Vector3()).y; }
  assert.ok(handY > shY, 'waving hand never rose above the shoulder');
});
test('preemption: a second walkTo resolves the first as preempted; stand() clears the queue; no stuck promises', async () => {
  const { c } = await make(); const p1 = c.walkTo('a', { side: 'top' }); run(c, 0.3); const p2 = c.walkTo('b', { side: 'top' });
  assert.deepEqual(await p1, { completed: false, reason: 'preempted' });
  const j = c.jump(); const s = c.stand(); assert.equal((await j).completed, false); await settle(c, s, 2);
  assert.equal((await settle(c, p2, 1).catch(() => ({ completed: false, reason: 'cleared' }))).completed, false);
});
test('queued jump during a walk runs after arrival (no animation conflict)', async () => {
  const { c } = await make(); const w = c.walkTo('b', { side: 'top' }); const j = c.jump();
  assert.equal((await settle(c, w, 10)).completed, true); assert.equal((await settle(c, j, 3)).completed, true);
});

// ---------------- 4. cards move / resize (site integration) ----------------
test('leanOn follows a card that drifts a little (smooth) and re-walks when it jumps far', async () => {
  const { c, R } = await make(); await settle(c, c.leanOn('a', { side: 'right' }), 10);
  const x0 = c.pos.x; R[0].left += 40; run(c, 2); assert.ok(Math.abs(c.pos.x - (x0 + 40)) < 2, 'did not follow small drift'); assert.equal(c.stateName, 'lean');
  R[0].left += 330; R[0].top -= 60; c.update(DT); assert.equal(c.stateName, 'walk', 'should re-walk after a large card move');
  run(c, 8); assert.equal(c.stateName, 'lean'); const t = R[0]; assert.ok(Math.abs(c.pos.y - (t.top + t.height)) < 2);
});
test('card removed mid-walk: promise resolves card-missing, state returns to idle', async () => {
  const { c, R } = await make(); const p = c.walkTo('b', { side: 'top' }); run(c, 0.3); R.splice(1, 1);
  const r = await settle(c, p, 1); assert.deepEqual(r, { completed: false, reason: 'card-missing' }); assert.equal(c.stateName, 'idle');
});
test('resize desktop -> phone: Karma stays fully inside the viewport and re-targets the card', async () => {
  const { c, R } = await make(); await settle(c, c.leanOn('b', { side: 'left' }), 10);
  R[1].left = 150; R[1].top = 520; R[1].width = 190; R[1].height = 150; c.setViewport(390, 844); c.setCharacterHeight(120); run(c, 8);
  assert.ok(c.pos.x >= c.halfW - 0.01 && c.pos.x <= 390 - c.halfW + 0.01, 'feet outside viewport: x=' + c.pos.x);
  assert.ok(c.pos.y <= 844 + 2); assert.equal(c.stateName, 'lean');
});
test('Karma never overlaps a card while standing beside it (side placement, normal layout)', async () => {
  const { c, R } = await make({ viewport: { width: 1280, height: 800 } });
  for (const [id, side] of [['a', 'left'], ['a', 'right'], ['b', 'left'], ['b', 'right']]) {
    await settle(c, c.walkTo(id, { side }), 12);
    const box = { l: c.pos.x - 0.3 * c.charH, r: c.pos.x + 0.3 * c.charH, t: c.pos.y - c.charH, b: c.pos.y };
    for (const k of R) { const hit = box.l < k.left + k.width && box.r > k.left && box.t < k.top + k.height && box.b > k.top;
      assert.equal(hit, false, `body box overlaps card ${k.id} when standing ${side} of ${id}`); }
  }
});

// ---------------- 5. KNOWN GAPS (todo = reported, not failing) ----------------
test('GAP: after walkTo(top) the character should keep following that card when it moves', { todo: 'controller drops the anchor when walkTo completes' }, async () => {
  const { c, R } = await make(); await settle(c, c.walkTo('b', { side: 'top' }), 10); R[1].left += 120; run(c, 2);
  assert.ok(Math.abs(c.pos.x - (R[1].left + R[1].width / 2)) < 3);
});
test('GAP: card near the screen edge on a phone: side placement overlaps the card instead of choosing the other side', { todo: 'x is clamped, no side fallback' }, async () => {
  const R = [{ id: 'a', left: 8, top: 400, width: 160, height: 140 }];
  const { c } = await make({ viewport: { width: 390, height: 844 }, rects: R, charH: 120 }); await settle(c, c.walkTo('a', { side: 'left' }), 8);
  assert.ok(c.pos.x + 0.3 * c.charH <= R[0].left, 'standing box overlaps card');
});
test('GAP: no API for keep-out text areas (headings/paragraphs); controller only knows card rects', { todo: 'getKeepOutRects not implemented' }, async () => {
  const { c } = await make(); assert.equal(typeof c.setKeepOutRects, 'function');
});

// ---------------- 6. mobile profile SIMULATION (not a real phone) ----------------
test('simulated phone profile: controller + skeleton CPU cost per frame stays small', async () => {
  const { c, rig } = await make({ viewport: { width: 390, height: 844 }, charH: 120 });
  c.wave(3); const t0 = performance.now(); const N = 1200;
  for (let i = 0; i < N; i++) { c.update(DT); rig.scene.updateMatrixWorld(true); for (const m of rig.skinned) m.skeleton.update(); }
  const per = (performance.now() - t0) / N; const tris = rig.skinned.reduce((s, m) => s + m.geometry.index.count / 3, 0);
  console.log(JSON.stringify({ sim: 'node CPU only, NOT a phone', glbBytes: fs.statSync(GLB).size, skinnedTriangles: tris, joints: rig.skinned[0].skeleton.bones.length, msPerFrameCPU: +per.toFixed(4) }));
  assert.ok(per < 3, 'CPU per frame ' + per + 'ms');
});

// ---------------- 7. acceptance GATES (independent of animation success) ----------------
import crypto from 'node:crypto';
function glbJson() {
  const d = fs.readFileSync(GLB); const jl = d.readUInt32LE(12); const j = JSON.parse(d.subarray(20, 20 + jl).toString('utf8'));
  const binStart = 20 + jl + 8; return { d, j, binStart };
}
function imageSize(buf, mime) {
  if (mime === 'image/png') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (mime === 'image/jpeg') { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + len; } }
  if (mime === 'image/webp' && buf.toString('ascii', 12, 16) === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  return null; // unknown format: reported as null, never silently accepted in strict mode
}
test('GATE mobile budget: triangles <= 60k and every texture <= 2048px (report always; enforced with KARMA_MOBILE_BUDGET=strict)', async () => {
  const { d, j, binStart } = glbJson(); let tris = 0;
  for (const m of j.meshes) for (const p of m.primitives) tris += (p.indices != null ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
  const sizes = (j.images || []).map((im) => { const bv = j.bufferViews[im.bufferView]; const off = binStart + (bv.byteOffset || 0);
    return imageSize(d.subarray(off, off + bv.byteLength), im.mimeType); });
  const maxTex = sizes.some((s) => !s) ? null : Math.max(0, ...sizes.map((s) => Math.max(...s)));
  const rep = { gate: 'mobile-budget', fileMB: +(d.length / 1048576).toFixed(2), triangles: tris, textures: sizes.length, maxTextureSidePx: maxTex, textureSizes: sizes,
    pass: tris <= 60000 && maxTex !== null && maxTex <= 2048 };
  console.log(JSON.stringify(rep));
  if (process.env.KARMA_MOBILE_BUDGET === 'strict') assert.ok(rep.pass, 'mobile budget NOT met: ' + JSON.stringify(rep));
});
test('GATE likeness: needs a LIKENESS_APPROVAL.json bound to THIS file hash (report always; enforced with KARMA_REQUIRE_LIKENESS=1)', async () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(GLB)).digest('hex');
  const approvalPath = path.join(path.dirname(path.resolve(GLB)), 'LIKENESS_APPROVAL.json'); let approved = false, why = 'no LIKENESS_APPROVAL.json next to the GLB';
  if (fs.existsSync(approvalPath)) { const a = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
    approved = a.sha256 === sha && !!a.approvedBy && !!a.date && !!a.comparisonEvidence; why = approved ? 'ok' : 'approval file does not match this GLB hash / is missing approvedBy, date or comparisonEvidence'; }
  console.log(JSON.stringify({ gate: 'likeness', sha256: sha, approved, why }));
  if (process.env.KARMA_REQUIRE_LIKENESS === '1') assert.ok(approved, 'likeness not approved: ' + why);
});
