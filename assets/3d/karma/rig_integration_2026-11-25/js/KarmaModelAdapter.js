// KarmaModelAdapter.js (Instinct), 2026-11-27.
// Load-time adapter between a delivered GLB and the contract rig in
// ../../claude_track_2026-11-25/js/KarmaRig.js (verbatim from PR #710; NOT edited).
//
// Two accepted model shapes:
//  A) contract-native: the GLB already has the 19 contract bone names and HeadMount/HairMount.
//     The verbatim createRig runs unchanged; behaviour is identical to before this file existed.
//  B) Muse B29 shape: Mixamo-style bone names, head already skinned to the Head bone, no mounts.
//     Bones are renamed in memory per ALIAS_B29, then the SAME checks createRig performs are
//     applied, except HeadMount/HairMount are omitted as contract section 3 allows when
//     "Muse delivers a head that is already skinned to Head".
// Status: shape B is a PROPOSED contract change (section 7: bone names), posted to Muse on
// 2026-11-27 and recorded in CONTRACT_CHANGE_PROPOSAL_B29_ALIAS_2026-11-27.md. Until Muse
// confirms, every artifact built on shape B stays NOT_FINAL.
import * as THREE from 'three';
import { BONES, createRig } from '../../claude_track_2026-11-25/js/KarmaRig.js';

// contract name -> B29 (Mixamo-style) node name. Names absent here (Hips, Spine, Neck, Head) match already.
export const ALIAS_B29 = {
  Chest: 'Spine2',
  Shoulder_L: 'LeftShoulder', UpperArm_L: 'LeftArm', Forearm_L: 'LeftForeArm', Hand_L: 'LeftHand',
  Shoulder_R: 'RightShoulder', UpperArm_R: 'RightArm', Forearm_R: 'RightForeArm', Hand_R: 'RightHand',
  UpperLeg_L: 'LeftUpLeg', LowerLeg_L: 'LeftLeg', Foot_L: 'LeftFoot',
  UpperLeg_R: 'RightUpLeg', LowerLeg_R: 'RightLeg', Foot_R: 'RightFoot',
};

function collectSkinned(scene) {
  const skinned = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; skinned.push(o); } });
  return skinned;
}

// The same validations createRig performs, minus the HeadMount/HairMount requirement,
// plus proof the Head joint really carries skinned vertices (the contract section 3 mounts-omitted case).
function createRigHeadSkinned(scene) {
  const bones = {};
  for (const n of BONES) {
    const b = scene.getObjectByName(n);
    if (!b) throw new Error('Karma rig: missing bone ' + n);
    bones[n] = b;
  }
  const skinned = collectSkinned(scene);
  if (!skinned.length) throw new Error('Karma rig: no SkinnedMesh found');
  const nonBones = BONES.filter((name) => bones[name].isBone !== true);
  if (nonBones.length) throw new Error('Karma rig: named joints are not THREE.Bone nodes: ' + nonBones.join(', '));
  const fullRigSkins = skinned.filter((mesh) => BONES.every((name) => mesh.skeleton.bones.includes(bones[name])));
  if (!fullRigSkins.length) {
    const skeletons = skinned.map((mesh) => new Set(mesh.skeleton.bones));
    const missingJoints = BONES.filter((name) => !skeletons.some((set) => set.has(bones[name])));
    throw new Error('Karma rig: no single SkinnedMesh skeleton contains all 19 controller joints' +
      (missingJoints.length ? '; absent from every skin: ' + missingJoints.join(', ') : ''));
  }
  // head actually skinned: at least one vertex with positive weight on the Head joint
  let headWeighted = false;
  for (const mesh of fullRigSkins) {
    const hj = mesh.skeleton.bones.indexOf(bones.Head);
    if (hj < 0) continue;
    const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count && !headWeighted; i++) {
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hj && sw.getComponent(i, k) > 0) { headWeighted = true; break; }
    }
    if (headWeighted) break;
  }
  if (!headWeighted) throw new Error('Karma rig (B29 mode): no HeadMount/HairMount and no vertex is skinned to Head; contract section 3 omission case does not apply');
  return { scene, bones, skinned, headMount: null, hairMount: null, headPlaceholder: scene.getObjectByName('HEAD_PLACEHOLDER_replace_with_karma_head') || null };
}

/** Wrap a parsed glTF scene into a rig object, accepting shape A (verbatim contract path) or shape B (B29 alias). */
export function adaptRig(scene) {
  const hasContractNames = BONES.every((n) => scene.getObjectByName(n));
  if (hasContractNames && scene.getObjectByName('HeadMount') && scene.getObjectByName('HairMount')) {
    return { rig: createRig(scene), mode: 'contract', renamed: {} };
  }
  const missing = Object.entries(ALIAS_B29).filter(([, mix]) => !scene.getObjectByName(mix)).map(([c, mix]) => c + '<-' + mix);
  if (missing.length) {
    throw new Error('KarmaModelAdapter: GLB matches neither the contract bone names nor the B29 alias; missing alias sources: ' + missing.join(', '));
  }
  const renamed = {};
  for (const [contract, mixamo] of Object.entries(ALIAS_B29)) {
    const node = scene.getObjectByName(mixamo);
    if (scene.getObjectByName(contract)) continue; // a contract-named node already exists: do not clobber it
    node.name = contract; renamed[mixamo] = contract;
  }
  return { rig: createRigHeadSkinned(scene), mode: 'b29-alias', renamed };
}

/** Measured bind-pose height of the model in metres (feeds KarmaMotion modelHeight; the stage used to hard-code 1). */
export function measureModelHeight(scene) {
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(scene);
  if (bb.isEmpty()) throw new Error('KarmaModelAdapter: empty model bounds');
  return bb.max.y - bb.min.y;
}
