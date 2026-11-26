# Contract change proposal: B29 bone-name alias (2026-11-27)

Status: PROPOSED by Instinct under INTERFACE_CONTRACT.md section 7. NOT confirmed by Muse yet.
Until Muse replies "accepted" or lists changes, every page, test and artifact that depends on this
alias stays NOT_FINAL. This file is the section 7 record; the contract file itself is unchanged.

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
