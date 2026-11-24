// assets/3d/karma/js/KarmaRig.js
// Loads the Karma body GLB and exposes bones / head mount. Needs an import map for "three" (see docs/3d/KARMA_BODY_RIG_README.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const BONES = ['Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'Shoulder_L', 'UpperArm_L', 'Forearm_L', 'Hand_L', 'Shoulder_R', 'UpperArm_R', 'Forearm_R', 'Hand_R',
  'UpperLeg_L', 'LowerLeg_L', 'Foot_L', 'UpperLeg_R', 'LowerLeg_R', 'Foot_R'];

/** Wrap a parsed glTF scene into a rig object. */
export function createRig(gltfScene) {
  const bones = {};
  for (const n of BONES) {
    const b = gltfScene.getObjectByName(n);
    if (!b) throw new Error('Karma rig: missing bone ' + n);
    bones[n] = b;
  }
  const skinned = [];
  gltfScene.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; skinned.push(o); } });
  if (!skinned.length) throw new Error('Karma rig: no SkinnedMesh found');

  // A matching node name is not enough: every controller bone must be a real
  // joint in at least one skin used by the character.
  const skeletons = skinned.map((mesh) => new Set(mesh.skeleton.bones));
  const missingJoints = BONES.filter((name) => !skeletons.some((set) => set.has(bones[name])));
  if (missingJoints.length) {
    throw new Error('Karma rig: named nodes are not skin joints: ' + missingJoints.join(', '));
  }

  const headMount = gltfScene.getObjectByName('HeadMount');
  const hairMount = gltfScene.getObjectByName('HairMount');
  if (!headMount || !hairMount) {
    throw new Error('Karma rig: missing required HeadMount or HairMount node');
  }
  if (headMount.parent !== bones.Head || hairMount.parent !== bones.Head) {
    throw new Error('Karma rig: HeadMount and HairMount must be children of Head');
  }

  return {
    scene: gltfScene, bones, skinned, headMount, hairMount,
    headPlaceholder: gltfScene.getObjectByName('HEAD_PLACEHOLDER_replace_with_karma_head'),
  };
}

export async function loadKarmaRig(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return createRig(gltf.scene);
}

/** Parse an in-memory ArrayBuffer (used by tests and by loaders that fetch themselves). */
export function parseKarmaRig(arrayBuffer) {
  return new Promise((res, rej) => new GLTFLoader().parse(arrayBuffer, '', (g) => res(createRig(g.scene)), rej));
}

/** Mount Karma's real head (any Object3D) on the Head bone and hide the neutral placeholder.
 *  The head asset is expected to be authored with its origin at the base of the neck, facing +Z. */
export function attachHead(rig, headObject, { hair = null } = {}) {
  if (!headObject || !headObject.isObject3D) {
    throw new TypeError('Karma rig: attachHead expects a THREE.Object3D head');
  }
  if (!rig.headMount || (hair && !rig.hairMount)) {
    throw new Error('Karma rig: required head/hair mount is missing');
  }
  if (rig.headPlaceholder) rig.headPlaceholder.visible = false;
  rig.headMount.add(headObject);
  if (hair) rig.hairMount.add(hair);
  return headObject;
}
