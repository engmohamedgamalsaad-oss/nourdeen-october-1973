import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { createRig } = await import('./KarmaRig.node-test-adapter.js');
const { KarmaController } = await import('./KarmaController.node-test-adapter.js');

const file = process.argv[2];
if (!file) throw new Error('Usage: node test_skin_anim.mjs <character.glb> [report.json]');
const bytes = fs.readFileSync(file);
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, '', resolve, reject));
const skinned = [];
gltf.scene.traverse((node) => { if (node.isSkinnedMesh) skinned.push(node); });
const rig = createRig(gltf.scene);

const report = {
  file,
  bytes: bytes.length,
  skinnedMeshes: skinned.length,
  joints: skinned.map((mesh) => mesh.skeleton.bones.length),
  inverseBindMatrices: skinned.map((mesh) => mesh.skeleton.boneInverses.length),
  rigBones: Object.keys(rig.bones).length,
  mounts: { head: !!rig.headMount, hair: !!rig.hairMount, placeholder: !!rig.headPlaceholder },
  tests: {}
};

let maxWeightDeviation = 0;
let invalidJointIndices = 0;
for (const mesh of skinned) {
  const weights = mesh.geometry.getAttribute('skinWeight');
  const joints = mesh.geometry.getAttribute('skinIndex');
  if (!weights || !joints) throw new Error('SkinnedMesh is missing JOINTS_0 / WEIGHTS_0 attributes');
  for (let i = 0; i < weights.count; i++) {
    const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    maxWeightDeviation = Math.max(maxWeightDeviation, Math.abs(sum - 1));
    for (let k = 0; k < 4; k++) {
      const joint = joints.getComponent(i, k);
      const weight = weights.getComponent(i, k);
      if (!Number.isInteger(joint) || joint < 0 || joint >= mesh.skeleton.bones.length) invalidJointIndices++;
      if (!Number.isFinite(weight) || weight < 0) invalidJointIndices++;
    }
  }
}
report.maxWeightSumDeviation = maxWeightDeviation;
report.invalidJointIndices = invalidJointIndices;
report.triangles = skinned.reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute('position').count) / 3, 0);

const rects = [
  { id: 'a', left: 100, top: 300, width: 150, height: 200 },
  { id: 'b', left: 400, top: 260, width: 150, height: 240 }
];
const controller = new KarmaController({
  rig, getCardRects: () => rects,
  viewport: { width: 800, height: 600 },
  characterHeightPx: 170, modelHeight: 1
});
const dt = 1 / 60;
const advance = async (promise, seconds, observe = () => {}) => {
  let result;
  promise.then((value) => { result = value; });
  const frames = Math.ceil(seconds / dt);
  for (let i = 0; i < frames && result === undefined; i++) {
    controller.update(dt);
    rig.scene.updateMatrixWorld(true);
    observe(i);
    await Promise.resolve();
  }
  if (result === undefined) throw new Error('Command Promise did not settle within ' + seconds + ' seconds');
  return result;
};
const angle = (name) => rig.bones[name].quaternion.angleTo(controller.restQuaternions[name]);
const snapshotSkin = () => {
  rig.scene.updateMatrixWorld(true);
  return skinned.map((mesh) => {
  mesh.skeleton.update();
  const attr = mesh.geometry.getAttribute('position');
  const points = new Float32Array(attr.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < attr.count; i++) {
    mesh.getVertexPosition(i, p);
    points.set([p.x, p.y, p.z], i * 3);
  }
  return points;
  });
};
const boundsOf = (snapshots) => {
  const box = new THREE.Box3();
  for (const points of snapshots) {
    for (let i = 0; i < points.length; i += 3) {
      box.expandByPoint(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
    }
  }
  return { min: box.min.toArray(), max: box.max.toArray() };
};
const restSnapshot = snapshotSkin();
const restBox = boundsOf(restSnapshot);
const walk = await advance(controller.walkTo('b', { side: 'top' }), 8);
report.tests.walkTo = { ...walk, position: controller.pos.toArray(), target: [475, 260] };
report.tests.walkTo.pass = walk.completed && Math.hypot(controller.pos.x - 475, controller.pos.y - 260) < 0.01;

const lean = await advance(controller.leanOn('a', { side: 'right' }), 8);
for (let i = 0; i < 30; i++) controller.update(dt);
const leanSpine = angle('Spine');
const leanSnapshot = snapshotSkin();
const leanBox = boundsOf(leanSnapshot);
let maxSkinVertexDelta = 0;
let changedSkinVertices = 0;
for (let m = 0; m < restSnapshot.length; m++) {
  for (let i = 0; i < restSnapshot[m].length; i += 3) {
    const dx = leanSnapshot[m][i] - restSnapshot[m][i];
    const dy = leanSnapshot[m][i + 1] - restSnapshot[m][i + 1];
    const dz = leanSnapshot[m][i + 2] - restSnapshot[m][i + 2];
    const delta = Math.hypot(dx, dy, dz);
    maxSkinVertexDelta = Math.max(maxSkinVertexDelta, delta);
    if (delta > 1e-5) changedSkinVertices++;
  }
}
report.tests.leanOn = { ...lean, state: controller.stateName, spineDeltaRadians: leanSpine };
report.tests.leanOn.pass = lean.completed && controller.stateName === 'lean' && leanSpine > 0.02;

const stand = await advance(controller.stand(), 0.6);
report.tests.stand = { ...stand, state: controller.stateName };
report.tests.stand.pass = stand.completed && controller.stateName === 'idle';

const jumpBase = controller.holder.position.y;
let jumpRise = jumpBase;
const jump = await advance(controller.jump(), 1.5, () => { jumpRise = Math.max(jumpRise, controller.holder.position.y); });
report.tests.jump = { ...jump, risePx: jumpRise - jumpBase };
report.tests.jump.pass = jump.completed && report.tests.jump.risePx > 5;

let wavePeak = 0;
const wave = await advance(controller.wave(2), 2.5, () => {
  wavePeak = Math.max(wavePeak, angle('UpperArm_R'), angle('Forearm_R'), angle('Hand_R'));
});
report.tests.wave = { ...wave, peakJointDeltaRadians: wavePeak };
report.tests.wave.pass = wave.completed && wavePeak > 0.1;

let tiltPeak = 0;
const tilt = await advance(controller.tilt('left', 1.4), 1.8, () => {
  tiltPeak = Math.max(tiltPeak, angle('Spine'), angle('Chest'), angle('Neck'));
});
report.tests.tilt = { ...tilt, peakJointDeltaRadians: tiltPeak };
report.tests.tilt.pass = tilt.completed && tiltPeak > 0.05;

report.deformation = {
  restBounds: { min: restBox.min, max: restBox.max },
  leanBounds: { min: leanBox.min, max: leanBox.max },
  changed: maxSkinVertexDelta > 1e-5,
  maxSkinVertexDelta,
  changedSkinVertices
};
report.deformation.pass = report.deformation.changed && changedSkinVertices > 0;
report.tests.skinData = { pass: maxWeightDeviation < 1e-3 && invalidJointIndices === 0, maxWeightSumDeviation: maxWeightDeviation, invalidJointIndices };

// Per-joint deformation sweep. Rest rotations are restored after every pose.
const deformationCases = {
  Shoulder_L: ['UpperArm_L', [0, 0, 1.2]],
  Shoulder_R: ['UpperArm_R', [0, 0, -1.2]],
  Elbow_L: ['Forearm_L', [-1.6, 0, 0]],
  Elbow_R: ['Forearm_R', [-1.6, 0, 0]],
  Hip_L: ['UpperLeg_L', [-1.0, 0, 0]],
  Hip_R: ['UpperLeg_R', [-1.0, 0, 0]],
  Knee_L: ['LowerLeg_L', [1.2, 0, 0]],
  Knee_R: ['LowerLeg_R', [1.2, 0, 0]],
  Neck: ['Neck', [0.5, 0.6, 0.4]],
  Head: ['Head', [0.4, 0.6, 0.3]],
  Spine: ['Spine', [0.3, 0, 0.4]]
};
const basePose = Object.fromEntries(Object.entries(rig.bones).map(([name, bone]) => [name, bone.quaternion.clone()]));
const neutralSnapshots = snapshotSkin();
report.deformationSweep = {};
for (const [label, [boneName, euler]] of Object.entries(deformationCases)) {
  for (const [name, bone] of Object.entries(rig.bones)) bone.quaternion.copy(basePose[name]);
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler, 'XYZ'));
  rig.bones[boneName].quaternion.copy(basePose[boneName]).multiply(delta);
  const posed = snapshotSkin();
  let movedVertices = 0, maxDisplacement = 0, nanValues = 0, maxEdgeStretch = 0;
  let sampledEdges = 0, over2x = 0, over4x = 0;
  for (let meshIndex = 0; meshIndex < skinned.length; meshIndex++) {
    const mesh = skinned[meshIndex];
    const before = neutralSnapshots[meshIndex], after = posed[meshIndex];
    for (let i = 0; i < after.length; i += 3) {
      if (!Number.isFinite(after[i]) || !Number.isFinite(after[i + 1]) || !Number.isFinite(after[i + 2])) nanValues++;
      const d = Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1], after[i + 2] - before[i + 2]);
      if (d > 1e-3) movedVertices++;
      maxDisplacement = Math.max(maxDisplacement, d);
    }
    const index = mesh.geometry.index;
    if (index) {
      const indices = index.array;
      for (let tri = 0; tri + 2 < indices.length; tri += 21) {
        for (let edge = 0; edge < 3; edge++) {
          const a = indices[tri + edge], b = indices[tri + ((edge + 1) % 3)];
          const ai = a * 3, bi = b * 3;
          const beforeLength = Math.hypot(before[ai] - before[bi], before[ai + 1] - before[bi + 1], before[ai + 2] - before[bi + 2]);
          if (beforeLength <= 1e-4) continue;
          const afterLength = Math.hypot(after[ai] - after[bi], after[ai + 1] - after[bi + 1], after[ai + 2] - after[bi + 2]);
          const ratio = afterLength / beforeLength;
          maxEdgeStretch = Math.max(maxEdgeStretch, ratio);
          sampledEdges++;
          if (ratio > 2) over2x++;
          if (ratio > 4) over4x++;
        }
      }
    }
  }
  report.deformationSweep[label] = {
    bone: boneName, euler, movedVertices, maxDisplacement: +maxDisplacement.toFixed(5),
    nanValues, maxEdgeStretch: +maxEdgeStretch.toFixed(2), sampledEdges,
    pctEdgesOver2x: sampledEdges ? +(100 * over2x / sampledEdges).toFixed(3) : 0,
    pctEdgesOver4x: sampledEdges ? +(100 * over4x / sampledEdges).toFixed(3) : 0,
    pass: movedVertices > 0 && nanValues === 0
  };
}
for (const [name, bone] of Object.entries(rig.bones)) bone.quaternion.copy(basePose[name]);
rig.scene.updateMatrixWorld(true);
report.tests.deformationSweepPass = Object.values(report.deformationSweep).every((item) => item.pass);
report.tests.allSixMotionsPass = ['walkTo','leanOn','stand','jump','wave','tilt'].every((name) => report.tests[name].pass);
const t0 = performance.now();
for (let i = 0; i < 1200; i++) controller.update(dt);
report.controllerUpdate1200FramesMs = +(performance.now() - t0).toFixed(2);
report.tests.overallPass = report.tests.skinData.pass && report.tests.allSixMotionsPass && report.deformation.pass && report.tests.deformationSweepPass;
console.log(JSON.stringify(report, null, 2));
const output = process.argv[3] || 'RESULT_skin_anim.json';
fs.writeFileSync(output, JSON.stringify(report, null, 2));
if (!report.tests.overallPass) process.exitCode = 1;
