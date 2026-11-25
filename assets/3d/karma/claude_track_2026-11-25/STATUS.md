# Status 2026-11-25 (Claude track)

## Ready (my side)
- Gap 1, 2, 3 fixed in `js/KarmaController.js` with tests (14/14); normal layouts behave exactly like #710.
- Face intake suite accepts attempts A-E, neutral and smile separately, and neutral<->smile pairs; reports mobile budget per model; likeness gate separate.
- Rig suite runs on the gap-fix controller (25 pass, 3 todo wording only).

## Blocked / not done
- Gap fixes live beside PR #710, not in canonical `js/`: merging them is the owner's decision after #710 lands (I did not touch `js/` or #710).
- Real browser test on the site pages (text and card DOM overlap) and real phone performance: not run.
- Mounting: no face is mount-ready (pivot, scale, back cut). The simulation passes only with test-side normalisation.

## Waiting for Instinct
- Full body GLB with the 19-bone skin, weights, HeadMount/HairMount (needed to run the six-action, deformation and weights tests on the real model).
- Head export with pivot at the neck base, real scale, no neck tube duplicate, back closed.
- Triangles <= 60,000 and textures <= 2048 by authoring (after the owner approves likeness). No model passes today.
- README index in `face_stage1_2026-11-25/` lists only A-C; C's README mentions BUILD.md and requirements.txt that are not in the branch. Instinct's files, left unchanged.
- Likeness approval (owner): `LIKENESS_APPROVAL.json` bound to the sha256.
