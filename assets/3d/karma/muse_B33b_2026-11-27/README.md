# Muse B33b full-body model (EXPERIMENT, NOT FINAL)

Received 2026-11-27 from the Muse side (via the geometry owner agent): B29 plus ears, and the current
default model wired into the stage loader. B29 stays in `../muse_B29_2026-11-27/` as the fallback
(selectable with `?glb=`). Not likeness-approved. Both files keep `EXPERIMENT_NOT_FINAL` in the name
per the interface contract.

- `karma_hyper3d_fullbody_MASTER_EXPERIMENT_NOT_FINAL_B33b.glb` (10,105,624 bytes): full textures.
- `karma_hyper3d_fullbody_MOBILE_EXPERIMENT_NOT_FINAL_B33b.glb` (1,398,616 bytes): downscaled textures.

Measured facts: same skeleton as B29 (55 joints, Mixamo-style names, alias in
`../rig_integration_2026-11-25/js/KarmaModelAdapter.js` applies unchanged), clips `Walking`/`Idle`
(present, ignored per contract section 5), morphs `eyeBlink_L`/`eyeBlink_R`, bind height 1.838 m,
faces +Z, pivot at soles, 6 skinned primitives (ears added, skinned to Head).
Known model defects (from the geometry owner, 2026-11-27): dark band on the viewer-right cheek near
the jaw (side view); faceted brown patches behind/under the ears; white slivers by the left ear;
flat-colour ears; painted teeth with a constant jaw; mid-blink lid disc 0.3-0.6; no lashes in master;
pigtail is a flat rectangle.
