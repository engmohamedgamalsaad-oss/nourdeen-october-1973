// Face-stage intake tests (head-only GLBs from Instinct's face_stage1_* folders). READ-ONLY: no GLB is modified, decimated or re-exported.
// Passing here = the file is technically well-formed and mountable in principle. It is NEVER a likeness approval.
// Run: node --test assets/3d/karma/claude_track_2026-11-25/tests/face_intake.test.mjs
// Env: KARMA_FACE_GLBS=a.glb,b.glb (default: every *.glb under ../../face_stage1_2026-11-25) | KARMA_MOBILE_BUDGET=strict | KARMA_REQUIRE_LIKENESS=1 | KARMA_REQUIRE_MOUNT_READY=1
//      KARMA_RIG_GLB (rig fixture for the mount simulation) | KARMA_TARGET_HEAD_H (metres, test assumption for the mount simulation, default 0.24)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const THREE = await import('three'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const here = path.dirname(fileURLToPath(import.meta.url)); const KARMA = path.join(here, '../..');
const { createRig, attachHead } = await import('../js/KarmaRig.js');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.glb') ? [path.join(d, e.name)] : []);
const FILES = (process.env.KARMA_FACE_GLBS ? process.env.KARMA_FACE_GLBS.split(',') : walk(path.join(KARMA, 'face_stage1_2026-11-25'))).map((f) => path.resolve(f)).sort();
const attemptOf = (f) => (f.match(/attempt_([A-Z])_/) || [, '?'])[1];
const exprOf = (f) => { const b = path.basename(f); return /_neutral_/i.test(b) ? 'neutral' : /_smile_/i.test(b) ? 'smile' : 'single'; };
const jsonOf = (b) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
const loaded = new Map();
async function load(f) {
  if (loaded.has(f)) return loaded.get(f);
  const b = fs.readFileSync(f); const j = jsonOf(b); const g = await new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej));
  const meshes = []; g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); }); meshes.sort((p, q) => q.geometry.getAttribute('position').count - p.geometry.getAttribute('position').count);
  const o = { f, b, j, scene: g.scene, meshes, head: meshes[0], sha: crypto.createHash('sha256').update(b).digest('hex') }; loaded.set(f, o); return o;
}
const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
const pts = (m) => { const a = m.geometry.getAttribute('position'); return a.array; };
const pct = (arr, p) => { if (!arr.length) return 0; const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

for (const f of FILES) {
  const tag = `${attemptOf(f)}/${exprOf(f)}`; const name = path.basename(f);
  test(`[${tag}] ${name}: loads in GLTFLoader, vertex colours only, no textures / UVs / images (structural check; see the flat-colour gate for colour provenance), naming is EXPERIMENT`, async () => {
    const m = await load(f); assert.ok(m.meshes.length >= 1);
    assert.equal((m.j.images || []).length, 0, 'embedded image found'); assert.equal((m.j.textures || []).length, 0, 'texture found');
    for (const k of m.meshes) { assert.ok(k.geometry.getAttribute('color'), 'mesh without COLOR_0'); assert.equal(k.geometry.getAttribute('uv'), undefined, 'UV set present (texture projection route)'); }
    assert.match(name, /EXPERIMENT|NOT_FINAL/, 'non-final file must be marked');
  });
  test(`[${tag}] ${name}: geometry sane (finite, indices in range, colours 0..1, degenerate + spike statistics)`, async () => {
    const m = await load(f); let bad = 0, deg = 0, T = 0, edges = [];
    for (const k of m.meshes) { const P = pts(k), C = k.geometry.getAttribute('color'), I = k.geometry.index, n = P.length / 3;
      for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) bad++;
      for (let i = 0; i < C.count; i++) for (let c = 0; c < 3; c++) { const v = C.getComponent(i, c); if (!(v >= 0 && v <= 1)) bad++; }
      const nt = I.count / 3; T += nt;
      for (let t = 0; t < nt; t++) { const a = I.getX(t * 3), b = I.getX(t * 3 + 1), c = I.getX(t * 3 + 2); if (a >= n || b >= n || c >= n) { bad++; continue; }
        const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
        const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; if (Math.hypot(cx, cy, cz) < 1e-12) deg++;
        if (k === m.head && t % 7 === 0) { edges.push(Math.hypot(ux, uy, uz)); } } }
    const med = pct(edges, 0.5), mx = Math.max(...edges); const rep = { gate: 'geometry', file: name, triangles: T, nonFiniteOrOutOfRange: bad, degenerateTriangles: deg, edgeMedian: +med.toFixed(5), edgeMaxSampled: +mx.toFixed(4), spikeRatio: +(mx / med).toFixed(1) };
    console.log(JSON.stringify(rep)); assert.equal(bad, 0); assert.ok(deg / T < 0.001, 'too many degenerate triangles'); assert.ok(mx / med < 60, 'edge-length outlier (spike / tear) ratio ' + mx / med);
  });
  test(`[${tag}] ${name}: orientation + mount-readiness report (faces +Z? pivot? scale?)`, async () => {
    const m = await load(f); const box = new THREE.Box3().setFromObject(m.scene); const size = box.getSize(new THREE.Vector3()); const P = pts(m.head);
    let zi = 0, zmax = -1e9; const cx = (box.min.x + box.max.x) / 2; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - cx) < 0.15 * size.x && P[i + 2] > zmax) { zmax = P[i + 2]; zi = i; }
    const noseY = P[zi + 1], noseX = P[zi]; const backCut = (() => { let n = 0; for (let i = 2; i < P.length; i += 3) if (P[i] < box.min.z + 0.01) n++; return n; })();
    const originInBox = box.containsPoint(new THREE.Vector3(0, 0, 0));
    const pivotAtNeckBase = Math.abs(box.min.y) < 0.05 * size.y && Math.abs((box.min.x + box.max.x) / 2) < 0.05 * size.x;
    const heightOk = size.y >= 0.15 && size.y <= 0.35;
    const rep = { gate: 'mount-readiness', file: name, bboxSize: size.toArray().map((v) => +v.toFixed(3)), bboxMin: box.min.toArray().map((v) => +v.toFixed(3)), noseTip: [noseX, noseY, zmax].map((v) => +v.toFixed(3)), noseFacesPlusZ: zmax > (box.min.z + box.max.z) / 2, backFlatCutVertices: backCut, originInsideBBox: originInBox, pivotAtNeckBase, realWorldScale: heightOk, ready: pivotAtNeckBase && heightOk };
    console.log(JSON.stringify(rep)); assert.equal(rep.noseFacesPlusZ, true, 'nose not toward +Z');
    if (process.env.KARMA_REQUIRE_MOUNT_READY === '1') assert.ok(rep.ready, 'not mount-ready: ' + JSON.stringify(rep));
  });
  test(`[${tag}] ${name}: GATE flat-colour route - distinct vertex colours (photo-derived colouring has tens of thousands; flat/authored colour has a handful; enforced with KARMA_FLAT_COLOUR=strict)`, async () => {
    const m = await load(f); const C = m.head.geometry.getAttribute('color'), S = new Set(); for (let i = 0; i < C.count; i++) S.add((Math.round(C.getX(i) * 255) << 16) | (Math.round(C.getY(i) * 255) << 8) | Math.round(C.getZ(i) * 255));
    const rep = { gate: 'flat-colour', file: name, attempt: attemptOf(f), headVertices: C.count, distinctColours: S.size, flatColourRoute: S.size <= 5000, note: S.size <= 5000 ? 'consistent with authored flat colours (soft edge blends allowed)' : 'consistent with colours derived from an image; structural tests cannot prove the source, owner/Instinct must confirm' };
    console.log(JSON.stringify(rep)); if (process.env.KARMA_FLAT_COLOUR === 'strict') assert.ok(rep.flatColourRoute, 'not on the flat-colour route: ' + S.size + ' distinct colours');
  });
  test(`[${tag}] ${name}: GATE mobile budget <= 60,000 triangles, textures <= 2048 px (recorded per model; enforced with KARMA_MOBILE_BUDGET=strict)`, async () => {
    const m = await load(f); const T = m.meshes.reduce((s, k) => s + tris(k), 0); const rep = { gate: 'mobile-budget', file: name, attempt: attemptOf(f), expression: exprOf(f), fileMB: +(m.b.length / 1048576).toFixed(2), triangles: T, overBudgetBy: +(T / 60000).toFixed(1) + 'x', textures: 0, pass: T <= 60000 };
    console.log(JSON.stringify(rep)); if (process.env.KARMA_MOBILE_BUDGET === 'strict') assert.ok(rep.pass, 'mobile budget NOT met: ' + T + ' triangles');
  });
  test(`[${tag}] ${name}: GATE likeness - needs LIKENESS_APPROVAL.json bound to THIS file hash (report; enforced with KARMA_REQUIRE_LIKENESS=1)`, async () => {
    const m = await load(f); const p = path.join(path.dirname(f), 'LIKENESS_APPROVAL.json'); let approved = false, why = 'no LIKENESS_APPROVAL.json next to the GLB';
    if (fs.existsSync(p)) { const a = JSON.parse(fs.readFileSync(p, 'utf8')); approved = a.sha256 === m.sha && !!a.approvedBy && !!a.date && !!a.comparisonEvidence; why = approved ? 'ok' : 'approval file does not match this GLB hash or lacks approvedBy/date/comparisonEvidence'; }
    console.log(JSON.stringify({ gate: 'likeness', file: name, sha256: m.sha, approved, why })); if (process.env.KARMA_REQUIRE_LIKENESS === '1') assert.ok(approved, why);
  });
  if (exprOf(f) === 'neutral') test(`[${tag}] ${name}: neutral has no teeth meshes (closed mouth)`, async () => { const m = await load(f); assert.equal(m.meshes.length, 1, 'extra meshes (teeth?) in a neutral file: ' + m.meshes.length); });
  if (exprOf(f) === 'smile') test(`[${tag}] ${name}: smile teeth are separate meshes and sit inside the head, below the eye line`, async () => {
    const m = await load(f); assert.ok(m.meshes.length > 1, 'no separate teeth meshes'); const hb = new THREE.Box3().setFromObject(m.head), eyeY = (hb.min.y + hb.max.y) / 2 + 0.2 * (hb.max.y - hb.min.y);
    for (const t of m.meshes.slice(1)) { const c = new THREE.Box3().setFromObject(t).getCenter(new THREE.Vector3()); assert.ok(hb.containsPoint(c), 'tooth centre outside head bbox'); assert.ok(c.y < eyeY, 'tooth above eye line'); }
  });
}

// ---- expression pairs: neutral <-> smile of the same attempt, tested separately above and compared here
const byAttempt = {}; for (const f of FILES) (byAttempt[attemptOf(f)] ||= {})[exprOf(f)] = f;
for (const [A, e] of Object.entries(byAttempt)) if (e.neutral && e.smile) {
  test(`[${A}] expression switch neutral <-> smile: same size and pivot, forehead/skull unchanged, no tearing or spikes, change confined to the lower face`, async () => {
    const n = await load(e.neutral), s = await load(e.smile); const bn = new THREE.Box3().setFromObject(n.head), bs = new THREE.Box3().setFromObject(s.head); const H = bn.max.y - bn.min.y;
    for (const k of ['x', 'y', 'z']) { assert.ok(Math.abs(bn.min[k] - bs.min[k]) < 0.01 * H && Math.abs(bn.max[k] - bs.max[k]) < 0.01 * H, 'bbox differs on ' + k); }
    const CELL = 0.1, grid = (P) => { const g = new Map(); for (let i = 0; i < P.length; i += 3) { const key = Math.floor(P[i] / CELL) + ',' + Math.floor(P[i + 1] / CELL) + ',' + Math.floor(P[i + 2] / CELL); (g.get(key) || g.set(key, []).get(key)).push(i); } return g; };
    const Pn = pts(n.head), Ps = pts(s.head), gn = grid(Pn), gs = grid(Ps); 
    const bands = Array.from({ length: 8 }, () => []); const far = { cnt: 0, tot: 0 }; const farBand = Array(8).fill(0);
    // symmetric nearest distance: query each vertex of A in B's grid
    const q = (PA, PB, gB) => { for (let i = 0; i < PA.length; i += 6) { const cx = Math.floor(PA[i] / CELL), cy = Math.floor(PA[i + 1] / CELL), cz = Math.floor(PA[i + 2] / CELL); let best = CELL;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const l = gB.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (l) for (const j of l) { const d = Math.hypot(PA[i] - PB[j], PA[i + 1] - PB[j + 1], PA[i + 2] - PB[j + 2]); if (d < best) best = d; } }
        const band = Math.min(7, Math.max(0, Math.floor(((PA[i + 1] - bn.min.y) / H) * 8))); bands[band].push(best); far.tot++; if (best >= CELL) { far.cnt++; farBand[band]++; } } };
    q(Pn, Ps, gs); q(Ps, Pn, gn);
    const table = bands.map((b, i) => ({ band: i + '/8 of head height (0 = chin)', samples: b.length, p50: +pct(b, 0.5).toFixed(4), p99: +pct(b, 0.99).toFixed(4), max: +Math.max(0, ...b).toFixed(4) }));
    console.log(JSON.stringify({ gate: 'expression-switch', attempt: A, headHeightUnits: +H.toFixed(3), unmatchedFraction: +(far.cnt / far.tot).toFixed(5), unmatchedPerBand: farBand, nearestCapUnits: CELL, bands: table }));
    for (const i of [6, 7]) assert.ok(pct(bands[i], 0.99) <= 0.01, `skull/forehead band ${i} changed between expressions (p99=${pct(bands[i], 0.99).toFixed(4)})`);
    assert.equal(farBand[5] + farBand[6] + farBand[7], 0, 'vertices of the upper face (brow/forehead/skull) moved more than ' + CELL + ' between expressions');
    assert.ok(far.cnt / far.tot < 0.05, 'too many vertices with no counterpart within ' + CELL + ' (tearing / large local change)');
  });
  test(`[${A}] mount: swapping neutral <-> smile on HeadMount keeps one head, same pivot, follows the Head bone (SIMULATION; normalisation applied in the test only, GLB untouched)`, async () => {
    const RIG = process.env.KARMA_RIG_GLB ? path.resolve(process.env.KARMA_RIG_GLB) : path.join(KARMA, 'baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb'); const rb = fs.readFileSync(RIG);
    const g = await new Promise((res, rej) => new GLTFLoader().parse(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength), '', res, rej)); const rig = createRig(g.scene);
    const TH = Number(process.env.KARMA_TARGET_HEAD_H || 0.24); const wrap = async (file) => { const m = await load(file); const root = m.scene.clone(true); const b = new THREE.Box3().setFromObject(root); const sc = TH / (b.max.y - b.min.y);
      const w = new THREE.Group(); w.name = 'SIM_NORMALISED_HEAD'; root.scale.setScalar(sc); root.position.set(-(b.min.x + b.max.x) / 2 * sc, -b.min.y * sc, -(b.min.z + b.max.z) / 2 * sc); w.add(root); return w; };
    const wn = await wrap(e.neutral), ws = await wrap(e.smile); attachHead(rig, wn); const centre = (w) => new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
    rig.scene.updateMatrixWorld(true); const cN = centre(wn); rig.headMount.remove(wn); attachHead(rig, ws); rig.scene.updateMatrixWorld(true); const cS = centre(ws);
    assert.equal(rig.headMount.children.filter((o) => o.name === 'SIM_NORMALISED_HEAD').length, 1, 'more than one expression head on the mount after swap'); assert.ok(cN.distanceTo(cS) < 0.01 * TH * 10, 'pivot jumped between expressions: ' + cN.distanceTo(cS));
    const hb = rig.bones.Head, wp = () => hb.getWorldPosition(new THREE.Vector3()); const rel0 = centre(ws).sub(wp()).length(); hb.rotateX(0.5); rig.scene.updateMatrixWorld(true); const rel1 = centre(ws).sub(wp()).length();
    assert.ok(Math.abs(rel0 - rel1) < 1e-6, 'mounted head does not move rigidly with the Head bone'); assert.ok(centre(ws).distanceTo(cS) > 1e-3, 'Head rotation did not carry the mounted head');
  });
}
