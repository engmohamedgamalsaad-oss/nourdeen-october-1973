# Evaluation: karma_face_stage1_C_EXPERIMENT.glb (2026-11-25)

sha256 32321e13e38c351f86c9e2d1fa75f281cc7078f185b09e70ff62e7df6a835b5e - 4.81 MB. Status: EXPERIMENT, not final, not approved.

## What the file is (measured from the GLB)
Head only. 19 meshes: `head` (183,050 tris) + eyes (sclera/iris/pupil each side) + 12 teeth segments. Total 210,986 triangles. No skin, no skeleton, no UVs, no textures, no materials: colour comes from vertex colours (`COLOR_0`). Generator: trimesh. Loads in `GLTFLoader` (19 meshes, all with `vertexColors`).

## Acceptance results
| Check | Result |
|---|---|
| Mobile budget gate (<= 60k tris) | FAIL: 210,986 tris (3.5x over) |
| Likeness gate | NOT APPROVED (no approval file) |
| Body/rig/controller suite | Not applicable: it is a head, there is no rig to test |
| Mount compatibility | NOT READY (see below) |

## Mounting on `HeadMount` (spec: origin at neck base, faces +Z)
- Faces +Z: yes (nose is the +Z extreme).
- Origin is NOT at the neck base: it sits on the eye line (iris centres at x=+-0.5, y=0, z=-0.2). Units are arbitrary: bounding box 2.70 x 3.83 x 2.17 units.
- Mounted as-is on the 1.0-unit-tall test rig the head spans y -1.44 to 2.39, about 4x too large and mis-pivoted.
- The mesh includes a neck tube with the yellow shirt colour baked in; the body already has a neck and collar, so this duplicates it.
- No transform was applied or invented. The scale and pivot must be fixed at export (pivot at neck base, real-world scale), then re-tested.

## Visual observations (software render of the GLB's own vertices next to the reference photo; not an approval)
Good: real 3D profile (nose, lips, chin), brown eyes, smile with teeth, ears; eyes and teeth are separate meshes, which allows blinking and mouth work later.
Problems: no hair geometry (hair is painted on the skull; no pigtails, braids, bows or pom-poms); side and back colours are stretched (looks like a front projection); ears stick out far more than in the reference; skin tone looks duller than the reference. Likeness judgement belongs to the owner.

## Next for this asset
Export with pivot at the neck base and real scale; remove or hide the neck tube; reduce triangles without scrambling colour; add real UVs and a texture instead of 183k vertex colours; build hair as separate geometry on `HairMount`. Then re-run `controller_integration.test.mjs` with the head attached to a body.
