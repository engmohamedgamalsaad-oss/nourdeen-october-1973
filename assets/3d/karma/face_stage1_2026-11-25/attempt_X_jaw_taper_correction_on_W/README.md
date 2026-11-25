# attempt_X: jaw taper correction on attempt W (face only)
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops and outline overlays only). Attempts A-W, site files and main are untouched. Geometry comes from W (MakeHuman CC0 assets, licence list in ../attempt_V_makehuman_cc0_limited_fit_test/CREDITS_and_per_file_license_check.md). The only new step is one scripted deformation (src/taper.py), my own code, no new asset files.

## What was measured first
The front outline of the W smile mesh (silhouette rendered from the GLB, src/outline_profile.py) against the face outline in the three reference photos, read by eye on the pupil-aligned crops (uncertainty about .05 IPD; hair hides the sides at cheek level, so only the jaw and chin outline from y -0.75 down is used). Half-widths, IPD units, eye line = 0:
| y | reference (by eye) | W | X |
|---|---|---|---|
| -0.75 | 1.03 | 1.11 | 1.03 |
| -1.00 | 0.90 | 0.98 | 0.90 |
| -1.25 | 0.67 | 0.82 | 0.69 |
So the W front form was not too wide at the cheeks (face width at eye line -0.5 is 2.31, about the same as the photos). The mismatch was a jaw and chin that stay too wide: +.08 at the jaw and +.15 (+22%) near the chin. (This corrects my earlier remark that the 2.31 cheek width was unmeasured.)

## The correction (X)
A smooth lateral scale x -> x * (1 - (1-s(y)) * w(|x|)), applied to the exported W GLBs, same vertex order. s(y) is a monotone-cubic curve through the ratios reference/W at the three levels (1.0 above y -0.55, .93, .92, .82, then .84 below the chin). w(|x|) is 0 inside |x| < .45 and 1 beyond .80, so the mouth, nose and chin centre are not moved. Same map for neutral and smile. X numbers above are therefore fitted to the same by-eye numbers, not independent; the overlay on all three photos (evidence/outline_overlay_W_yellow_X_red_on_refs.png, W yellow, X red) is the visual check: the X jaw outline follows the photo jaw in all three, the W outline sits outside it.

## Checks (what they are, and are not)
- Landmark ratios re-measured from the X GLBs (MH_measured_from_GLB.json): identical to W except mouth width and face width measures that depend on the outline; mouth width neutral .864, smile .919, same as W (the |x| weight keeps the mouth).
- Triangle normal flips and area ratios (loop_check_from_GLB.json, from the GLBs): 0 flipped triangles neutral and smile; smallest area ratio .266 (neutral vs child base), .267 (smile vs own neutral); 4 smile triangles turn more than 60 deg. X vs W: 0 triangles with reversed normals, area ratio .69 to 1.35 (all in the jaw band).
- NOT checked: self-intersection or non-manifold geometry (not tested), ears, neck shape (the neck narrows with the taper; no reference value), side profile, depth.

## Cause statements
Tested: V's folds came from expression targets stacked on identity-moved nose and mouth (ablation in W README), and adding a mesh validity term removed them (W). Hypothesis, not tested: the heavy look of the W face also comes from the base child proportions; X changes only the outline, so the remaining difference (fuller cheeks, lip volume, smile creases, eyes without lids or eyeballs, flat colour) is untouched.

## Result
The outline gain is real and measurable. Likeness is not claimed and the surface forms of W are unchanged: the face still reads heavier and older than the reference because of the interior forms listed above.

## Files
karma_face_MH_neutral_X.glb, karma_face_MH_smile_X.glb (taper of the W files), MH_measured_from_GLB.json, loop_check_from_GLB.json, evidence/ (ref | Q | X smile panel, neutral panel, outline overlay), src/ (taper.py, outline_profile.py, loop_check.py; others as W), map_*.npy (vertex index maps, no photo data).
Rerun: from this folder's src/ run `V_REFDIR=<folder with the 3 reference photos> python3 taper.py && python3 measure_glb.py && python3 loop_check.py && python3 panels.py` (taper.py reads the W GLBs in the sibling folder; set V_MH_DATA to a MakeHuman clone at a8bc2d54ff0ac92e78ff71431b1023eda42bf482 for measure_glb.py and loop_check.py). To rerun the W fit itself: from W's src/ run `python3 fit_w.py 0.5 W` then `python3 exportmh.py` (fit_w.py imports through the current directory).
