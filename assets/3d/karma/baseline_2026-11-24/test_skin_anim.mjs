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
    for (let k = 0; k < 4; k++) if (joints.getComponent(i, k) >= mesh.skeleton.bones.length) invalidJointIndices++;
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
const bbox = () => {
  rig.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const mesh of skinned) {
    const attr = mesh.geometry.getAttribute('position');
    for (let i = 0; i < attr.count; i += 12) {
      mesh.getVertexPosition(i, p);
      p.applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(p);
    }
  }
  return { min: box.min.toArray(), max: box.max.toArray() };
};

const restBox = bbox();
const walk = await advance(controller.walkTo('b', { side: 'top' }), 8);
report.tests.walkTo = { ...walk, position: controller.pos.toArray(), target: [475, 260] };
report.tests.walkTo.pass = walk.completed && Math.hypot(controller.pos.x - 475, controller.pos.y - 260) < 0.01;

const lean = await advance(controller.leanOn('a', { side: 'right' }), 8);
for (let i = 0; i < 30; i++) controller.update(dt);
const leanSpine = angle('Spine');
const leanBox = bbox();
report.tests.leanOn = { ...lean, state: controller.stateName, spineDeltaRadians: leanSpine };
report.tests.leanOn.pass = lean.completed && controller.stateName === 'lean' && leanSpine > 0.02;

const stand = await advance(controller.stand(), 0.6);
report.tests.stand = { ...stand, state: controller.stateName };
report.tests.stand.pass = stand.completed && controller.stateName === 'idle';

let jumpRise = -Infinity;
const jump = await advance(controller.jump(), 1.5, () => { jumpRise = Math.max(jumpRise, controller.holder.position.y); });
report.tests.jump = { ...jump, risePx: jumpRise - 0 };
report.tests.jump.pass = jump.completed && jumpRise > controller.vh / 2 + 5;

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
  leanBounds: { min: leanBox.min.toArray(), max: leanBox.max.toArray() },
  changed: JSON.stringify(restBox.min) !== JSON.stringify(leanBox.min.toArray()) ||
           JSON.stringify(restBox.max) !== JSON.stringify(leanBox.max.toArray())
};
report.tests.skinData.pass = maxWeightDeviation < 1e-3 && invalidJointIndices === 0;
report.tests.allSixMotionsPass = ['walkTo','leanOn','stand','jump','wave','tilt'].every((name) => report.tests[name].pass);
const t0 = performance.now();
for (let i = 0; i < 1200; i++) controller.update(dt);
report.controllerUpdate1200FramesMs = +(performance.now() - t0).toFixed(2);
report.tests.overallPass = report.tests.skinData.pass && report.tests.allSixMotionsPass;
console.log(JSON.stringify(report, null, 2));
const output = process.argv[3] || 'RESULT_skin_anim.json';
fs.writeFileSync(output, JSON.stringify(report, null, 2));
if (!report.tests.overallPass) process.exitCode = 1;
