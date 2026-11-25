# Karma 3D Interface Contract v0.1 (proposal, Instinct side)

Status: PROPOSED by Instinct for Muse's confirmation. Nothing here is final until Muse replies "accepted" or lists changes in its own repo file. Each side edits only its own files. Instinct owns rig, motion, controller, page integration. Muse owns the model, face and likeness. Likeness approval belongs to the owner, never to either assistant.

## 1. File and loading
- Final GLB path (Muse proposes, Instinct accepts any path): proposed `assets/3d/karma/final/karma_final.glb`. Code never hard-codes it: the page reads `window.KARMA_GLB_URL` or the `data-glb` attribute, tests read env `KARMA_GLB`.
- Interim test GLBs must have `NOT_FINAL` or `EXPERIMENT` in the file name. The final one must not.
- three.js 0.170.0 (importmap, `three` and `three/addons/`). Loader: `GLTFLoader`. No Draco, no Meshopt, no KTX2 required. Embedded textures only if each is at most 2048 px.
- One glTF scene, one root node. Binary GLB 2.0.

## 2. Units, axes, pivot, scale
- Metres. Character faces +Z. Karma's left hand is +X. +Y is up.
- Root/pivot: scene origin at the soles, centred between the feet. Total height about 1.0 m (body plus head plus hair), `modelHeight` is passed to the controller.
- No non-uniform scale on any node. Scale baked into vertices or a single uniform root scale.

## 3. Skeleton: exactly these 19 bones (glTF joints in ONE skin)
`Hips, Spine, Chest, Neck, Head, Shoulder_L, UpperArm_L, Forearm_L, Hand_L, Shoulder_R, UpperArm_R, Forearm_R, Hand_R, UpperLeg_L, LowerLeg_L, Foot_L, UpperLeg_R, LowerLeg_R, Foot_R`
Hierarchy: Hips > Spine > Chest > Neck > Head. Chest > Shoulder_x > UpperArm_x > Forearm_x > Hand_x. Hips > UpperLeg_x > LowerLeg_x > Foot_x. Hand is the wrist, Foot is the ankle. Extra joints are allowed only if the 19 are all present with these names. (Same list as `assets/3d/karma/js/KarmaRig.js` `BONES` and `integration_tests_2026-11-25/INSTINCT_MODEL_REQUIREMENTS.md`.)
- Skin: at most 4 influences per vertex, weights sum to 1, non-negative, all 19 joints influence something, smooth ramps at neck, shoulders, elbows, hips, knees.
- Nodes `HeadMount` and `HairMount` are direct children of `Head`. Optional `HEAD_PLACEHOLDER_replace_with_karma_head` is hidden when a head is attached. If Muse delivers a head that is already skinned to Head, say so and the mounts may be omitted (then the rig test uses the skinned head directly).

## 4. Neutral stand pose (bind pose)
Standing, feet flat and parallel, shoulder-width apart, weight even. Arms in a relaxed A-pose, about 25 to 35 degrees from the torso, clear of the thighs. Palms facing the thighs. Head level, looking +Z. Rest rotations may be non-identity: the controller applies motion as a delta on the authored rest rotation.

## 5. Motion names (programmatic, on the real skinned mesh, no baked video, no 2D animation, no lip-sync)
`idle` (breathing), `walk`, `run`, `jump`, `wave`, `look`, `point`, `lean`, `turn`, `leanOnCard`.
GLB animation clips are NOT required and not read. If the GLB contains clips they are ignored.
Controller API (Instinct, `rig_integration_2026-11-25/js/KarmaController.js`): `idle()`, `walkTo(cardId,{side,along})`, `runTo(cardId,opts)`, `jump()`, `wave(sec)`, `lookAt(target)`, `pointAt(cardId)`, `lean(dir,sec)`, `turn(dir)`, `leanOn(cardId,{side})`, `stand()`. Every call returns a promise `{completed, reason}`; a navigation call cancels the previous one; actions queue only behind compatible states.

## 6. What Muse must supply and what Instinct tests
Muse: the GLB per sections 1 to 4, a one-paragraph note of anything that deviates.
Instinct: runs `rig_integration_2026-11-25/tests` on it (loading, 19 bones, weights, deformation of neck/shoulders/elbows/knees, face does not distort when the head turns, head/hair stay attached in every motion, then each motion). Results are published as files in Instinct's branch. A test pass is a technical result, not likeness approval.
Budget gate: at most 60,000 triangles and textures at most 2048 px for the final delivery (existing project gate).

## 7. Change rule
Any change to bone names, axes, pivot, or GLB path is proposed to the other side first and recorded in this file's changelog before code depends on it.

Changelog: v0.1 proposed by Instinct, 2026-11-25.
