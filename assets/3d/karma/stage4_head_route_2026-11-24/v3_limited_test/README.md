# Karma 3D — v3 limited face test (Custom Topology, NOT final)

Branch: `muse/karma-custom-topology-face-test-2026-11-25`
Base branch: `feat/karma-controller-rig-hardening-2026-11-24` (PR #710)
Repo path: `assets/3d/karma/stage4_head_route_2026-11-24/v3_limited_test/`
No merge to `main`, no deletion of prior attempts, no production files touched.

## What this test is

A limited, numeric, geometric parameter test on the existing
code-built head v2, not a new final head.

v2 is documented in its own README as:
- dense geometric head, 88k vertices, no photo texture
- known defects: lips too wide and pale, brows too thick and high,
  nose has too little volume, eyes slightly round, shading flat,
  no hair, no ears, not attached to the body
- metric: mean error 0.038 pupil-distance units (MediaPipe on render
  vs front reference, layout only — says nothing about likeness)
- mouth width: ref 0.95, v2 1.00
- face width: ref 2.18, v2 2.11

## What v3 changes — three defects only

Source parameters are taken from the v2 files already in the repo:
- `v2/build2.py`: mouth half-width `L = 0.54*u`, brow thickness
  `0.0028*(0.55+0.9*sin(...))`, brow offset `-0.17`
- `v2/geo2.py`: nose tip bump height `0.014`, bridge `0.007`
- `v2/metric_v2_summary.txt`: mouth ref 0.95 / v2 1.00
- `assets/3d/karma/baseline_2026-11-24/KARMA_VISUAL_SPEC_sections1-6_clean_transcription.txt`:
  skin #FCCFB8 / #F3AD8D, hair #412F27 / #62291B, front reference only,
  side/back depth is guessed, not confirmed

v3 parameters (see `params_v3.json`):
1. Mouth: `L` 0.54u -> 0.51u
   Geometric mouth width 1.08u -> 1.02u.
   Calibration from v2 only: measured / geometric = 1.00 / 1.08 = 0.926.
   Predicted rendered mouth width = 1.02 * 0.926 = 0.944,
   target 0.95 +/- 0.03. This is a prediction, not a render measurement.
2. Brows: thickness factor 1.00 -> 0.70 (-30%), offset -0.17 -> -0.12
   (lowered by 0.05u). Max thickness 0.00406 -> 0.00284.
3. Nose: tip height 0.014 -> 0.018 (+28.6%), bridge 0.007 -> 0.009 (+28.6%).

Nothing else changes in this test. No eyes, no hair, no ears,
no body, no clothes, no Rig, no GLB output, no photo texture,
no reference-photo projection.

## How to run

```sh
python3 test_face_params.py
```

Stdlib only. No numpy, no scipy, no PIL, no cv2, no MediaPipe,
no reference photo, no external files.
It writes `test_face_params_result.json` next to the script
and exits 0 only if every check passes.

## What this does NOT prove

- It does not prove visual likeness.
- It does not prove the rendered mouth will measure 0.95.
  Render + MediaPipe verification by the team is still required,
  because the reference photos are held back locally and are
  not in the public repo, and cv2/MediaPipe are not available here.
- It does not start the final head, hair, body, clothes, or Rig.
  Those start only after a prototype is reviewed and approved.

## Files in this test

- `README.md` — this file
- `params_v3.json` — machine-readable v2 vs v3 parameters
- `test_face_params.py` — the test, stdlib only
- `test_face_params_result.json` — output of the test (generated on run)
