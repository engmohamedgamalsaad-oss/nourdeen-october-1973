# Contract change record: B29/B33b bone-name alias (2026-11-27)

Status: ACCEPTED by the Muse side (Musa) on 2026-11-27, via the Muse thread. Provenance note:
author labels on that page are unauthenticated; this acceptance is the counterpart assistant's
process decision under contract section 7, not owner authority (the owner's hookup approval was
confirmed separately on his authenticated Telegram at 01:04 on 2026-11-27).
Musa verified numerically on B33b (10,105,624 bytes from this branch): all 19 contract bones
resolve (4 directly, 15 via the alias sources, none missing or duplicated), exactly 36 extra
joints, no HeadMount/HairMount, height 1.8378 m, pivot at the feet, skin weights valid (zero
vertices whose weights do not sum to 1.0), Head carries weighted vertices in all 6 primitives,
9,172 triangles out of the 60,000 gate (Instinct's own parse counted 6,548; the counting methods
differ, both are far under the gate). Musa's naming corrections, recorded here: the eye bones are
named `eye.L`/`eye.R` in the file (three.js shows them sanitized as `eyeL`/`eyeR`); the model is
one mesh with 6 primitives; the only morph targets are the two blinks. Every artifact built on the
model still carries EXPERIMENT_NOT_FINAL and likeness approval remains the owner's. This file is
the section 7 record; the contract file itself is unchanged.

## The change

Section 3 (skeleton) is extended for the Muse B29 delivery only:

1. Bone names. B29 ships Mixamo-style names. The loader renames these nodes in memory after
   parsing, before the rig is built; the GLB file itself is never modified:

   | contract name | B29 node name |
   |---|---|
   | Chest | Spine2 |
   | Shoulder_L / Shoulder_R | LeftShoulder / RightShoulder |
   | UpperArm_L / UpperArm_R | LeftArm / RightArm |
   | Forearm_L / Forearm_R | LeftForeArm / RightForeArm |
   | Hand_L / Hand_R | LeftHand / RightHand |
   | UpperLeg_L / UpperLeg_R | LeftUpLeg / RightUpLeg |
   | LowerLeg_L / LowerLeg_R | LeftLeg / RightLeg |
   | Foot_L / Foot_R | LeftFoot / RightFoot |

   Hips, Spine, Neck, Head already match. Extra joints (fingers, eyes, jaw; 55 total) are allowed
   by section 3 ("Extra joints are allowed only if the 19 are all present") after the rename.

2. HeadMount/HairMount omitted. B29's head is already skinned to the Head bone, the case
   section 3 already allows ("the mounts may be omitted"). The rig code checks that at least one
   vertex has positive weight on the Head joint before accepting this.

3. Model height. B29 is 1.838 m tall, not about 1.0 m. The stage now measures the loaded model's
   bind-pose height and passes it as `modelHeight` (the controller parameter that already exists),
   instead of hard-coding 1. This works for any delivery height and changes nothing for a 1.0 m model.

## Why

The hookup decision was received 2026-11-27 via the Muse thread and confirmed by the owner on his
authenticated Telegram channel at 01:04 the same night ("continue and link the model"). Re-exporting
the model with contract names (the alternative) would re-risk geometry that was judged the best
build of the current set. The wired default is B33b (B29 plus ears); B29 stays as the fallback.

## Verification so far (Instinct side, on the real B29 GLB)

- After the alias, all 19 contract bones resolve to real `Bone` joints, and every one of the 4
  skinned primitives has a single skin containing all 19.
- walkTo, lookAt, pointAt, wave, leanOn, stand and 5 s of idle all complete with finite bone
  rotations (scratch run, 2026-11-27; full suite results land in `evidence/muse_b29_2026-11-27/`).

## What this does NOT change

- GLB clips are still ignored (section 5). Motion remains programmatic.
- Likeness approval is untouched and belongs to the owner.
- The contract file, the PR #710 controller and the claude_track verbatim copies are not edited.
