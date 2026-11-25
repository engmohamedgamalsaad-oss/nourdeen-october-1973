# Karma model requirements for integration (for Instinct)

A GLB is accepted by the integration side only if it satisfies this list. Items 1-6 are enforced by `controller_integration.test.mjs`; items 7-8 by its gates.

1. **Skeleton**: one skin that contains exactly these 19 joints, as glTF joint nodes (they load as `THREE.Bone`), named exactly:
   `Hips, Spine, Chest, Neck, Head, Shoulder_L, UpperArm_L, Forearm_L, Hand_L, Shoulder_R, UpperArm_R, Forearm_R, Hand_R, UpperLeg_L, LowerLeg_L, Foot_L, UpperLeg_R, LowerLeg_R, Foot_R`.
   Hierarchy: Hips > Spine > Chest > Neck > Head; Chest > Shoulder_x > UpperArm_x > Forearm_x > Hand_x; Hips > UpperLeg_x > LowerLeg_x > Foot_x. Hand = wrist, Foot = ankle. Extra joints may exist, but the 19 must be in the same skin as every body mesh that needs them. A named node that is not a skin joint is rejected.
2. **Mounts**: nodes `HeadMount` and `HairMount` must be direct children of `Head`. Mounted heads are authored with their origin at the neck base and face +Z. `HEAD_PLACEHOLDER_replace_with_karma_head` (optional) is hidden when a head is attached.
3. **Skin weights**: at most 4 influences per vertex, weights sum to 1, all non-negative, indices inside the skin, every one of the 19 joints influences at least one vertex. Ramps must be smooth across shoulder, elbow, hip, knee and neck (no hard cut). Rotating a limb must not move distant body parts (limit: 1% of body height).
4. **Rest rotations** may be non-identity; the controller applies pose values as deltas on the authored rest.
5. **Orientation and units**: metres, character faces +Z, Karma's left is +X, origin at the soles, total height about 1.0 m (the controller is told `modelHeight`). A-pose with arms clear of the torso.
6. **Separation**: hair, head, arms and legs as separate meshes/primitives where possible; hair must not fuse with face, hands or body.
7. **Mobile budget (gate)**: <= 60,000 triangles total and every texture <= 2048 px. Do not decimate in a way that scrambles UVs (integrated_v3 recorded one failed decimation for this reason); weld vertices and transfer UVs properly, or reduce by authoring. Report file size, triangles and texture sizes before and after for every optimized copy.
8. **Likeness (gate)**: separate from everything above; see `LIKENESS_APPROVAL.json` in README.md.
9. **Naming**: files that are not final must contain `NOT_FINAL` or `EXPERIMENT` in the name. A final delivery must not, and then strict checks apply to it. Code must never reference a temporary file name; the tests take the model path from `KARMA_GLB`.
10. Never overwrite an existing GLB. Optimized copies go in their own clearly named folder.
