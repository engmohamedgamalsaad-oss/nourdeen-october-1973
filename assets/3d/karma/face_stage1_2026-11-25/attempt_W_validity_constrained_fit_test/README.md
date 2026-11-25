# attempt_W: validity-constrained MakeHuman (CC0) face fit, Karma stage 1
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops only, as in attempt V). Earlier attempts (A-V), site files and main are untouched. Same CC0 asset set as attempt V (MakeHuman commit a8bc2d54ff0ac92e78ff71431b1023eda42bf482, assets only, no code); no new files were used, see ../attempt_V_makehuman_cc0_limited_fit_test/CREDITS_and_per_file_license_check.md.

## Cause of the attempt V folds (measured, not assumed)
Measured on the mesh before and after each target (src/ diagnosis, front-facing faces in the nose-to-chin region, counted as flipped when the face normal reverses):
- The base mesh with each expression unit alone at weight 1: 0 flipped faces. Identity targets alone (neutral fit): 0 flipped. So the MakeHuman targets and the mesh are valid.
- The folds appeared only when the expression targets were stacked on the fitted identity: 28 flipped faces (quads) in the fitted smile, centred between the subnasale and the lip top (y -0.89 to -0.69 IPD).
- Reason: expression targets are fixed vertex offsets made for the unmodified base. V's fit moved the nose and mouth with identity targets (nose up/down, mouth width and height) and then added corner-puller 0.90 and elevation 0.47 on top. The fit had no term that checked the mesh, only 12 ratios, so it was free to land in a folded state. Fit validity was never part of the objective. That, not the base mesh, was the cause.

## What W changed (one change)
The same bounded least squares and the same 11 reference ratios, plus a penalty on the mesh: in the face region, front-facing faces may not turn over (normal dot below 0.5), the neutral may not shrink a face below 35% of its base area, and the smile may not shrink one below 45% of the fitted neutral's area. Ridge weight 0.5 (V used 0.15). Starting point: all weights zero.

## Post-export loop check (from the exported GLBs, src/loop_check.py, loop_check_from_GLB.json)
| | V neutral | W neutral | V smile | W smile |
|---|---|---|---|---|
| flipped triangles | 2 | 0 | 66 | 0 |
| turned over more than 60 deg | 24 | 0 | 92 | 2 |
| triangles under 25% area | 12 | 0 | 14 | 0 |
| smallest area ratio | .16 | .27 | .14 | .27 |
Evidence: evidence/smile_nose_mouth_wire_V_vs_W.png (same camera, V left, W right). The W smile loops stay ordered around the nose, lip and corners.

## Numbers from the W GLBs (IPD units, MH_measured_from_GLB.json)
Reference = U-table values (original landmark arrays were not retained; detector is adult-trained, so approximate).
| measure | reference | W neutral | W smile |
|---|---|---|---|
| eye width | .447 | .443 | .443 |
| eye aperture | .1455 | .146 | .146 |
| alar width | .676 | .674 | .680 |
| eye line to subnasale | .687 | .672 | .671 |
| subnasale to chin | .847 | .844 | .862 |
| eye line to chin | 1.533 | 1.516 | 1.533 |
| mouth width (smile ref) | .989 | .864 | .919 (7% short) |
| outer lip height (smile ref) | .317 | .264 | .311 |
| eye line to mouth centre (smile ref) | .953 | 1.010 | 1.004 (mouth 5% too low) |
Cheek-level face width (eye line -.5): W 2.31. The reference has no measured value; Q 1.70 was narrower. Not a comparison. The face-width at jaw level printed by measure_glb.py (1.976) uses all GLB vertices and differs from the 1.71 the optimiser used; do not quote either as a match.

## Findings
- The fold is fixed with no smoothing: validity as a constraint worked.
- The cost is visible: the fit could not reach the smile mouth width (.919 vs .989) with valid loops. `mouth-scale-horiz` sits at 0.98 of its design range, so this is a capability limit of this target set under validity, not an optimiser stall.
- Likeness: the front render is still a heavy, broad, jowly lower face with a long chin and flat-coloured lips with no teeth or eyeballs. Ratios match but it does not read as the reference child. No claim of likeness. Matching ratios with 30 free weights does not show likeness.
- Not measured: depth, cheek volume, brow, socket, neutral lip shape.

## Files
karma_face_MH_neutral_W.glb, karma_face_MH_smile_W.glb (glb_info.json), MH_measured_from_GLB.json, loop_check_from_GLB.json, Q_measured_from_GLB_renders.json (copied from V), map_*.npy (vertex index maps, no photo data), evidence/, src/ (fit_w.py is the new fit, loop_check.py, wire_zoom.py; others as V). src/fit_x.json holds the W weights, fit_x_V_original.json the V weights. Rerun notes: same as attempt V README (paths via src/cfg.py env overrides; needs MakeHuman clone at the pinned commit). Run `python3 src/fit_w.py 0.5 W` then `python3 src/exportmh.py`.
