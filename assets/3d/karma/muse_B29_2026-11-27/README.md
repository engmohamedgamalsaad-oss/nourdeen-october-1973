# Muse B29 full-body model (EXPERIMENT, NOT FINAL)

Received 2026-11-27 from the Muse side (via the geometry owner agent) for the site hookup the owner
confirmed on his authenticated Telegram channel at 01:04 on 2026-11-27. Not likeness-approved. Both files keep `EXPERIMENT_NOT_FINAL` in the name per
the interface contract.

- `karma_hyper3d_fullbody_MASTER_EXPERIMENT_NOT_FINAL_B29.glb` (9,770,920 bytes): full textures.
- `karma_hyper3d_fullbody_MOBILE_EXPERIMENT_NOT_FINAL_B29.glb` (1,063,592 bytes): same skeleton,
  geometry and morphs; textures downscaled (1024 px, JPEG); face slightly softer per the geometry owner.

Measured facts (both files): GLB 2.0, one scene, 4 skinned primitives in one skinned mesh group,
55 joints (Mixamo-style names), clips `Walking` (1.00 s) and `Idle` (8.33 s) - present but ignored per
contract section 5; morph targets `eyeBlink_L`/`eyeBlink_R` on all 4 primitives (currently unused by
the stage); bind height 1.838 m, faces +Z, left hand at +X, pivot at the soles; 6,548 triangles.
Bone names do NOT match the contract's 19 names and there are no HeadMount/HairMount nodes:
see `../rig_integration_2026-11-25/CONTRACT_CHANGE_PROPOSAL_B29_ALIAS_2026-11-27.md` (PROPOSED).
