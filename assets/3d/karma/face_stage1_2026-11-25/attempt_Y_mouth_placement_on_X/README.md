# attempt_Y: mouth width and mouth height placement on attempt X (face only)
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops only). Attempts A-X, site files and main untouched. Geometry: MakeHuman CC0 assets via W and X (licence list in ../attempt_V_makehuman_cc0_limited_fit_test/CREDITS_and_per_file_license_check.md); the new step is one scripted deformation (src/mouth.py), own code, no new asset files.

## Why this step
After W and X the two front measurements still off the reference were the smile mouth width (.919 vs .989, 7% short) and the mouth height (eye line to mouth centre 1.004 vs .953, 5% low). W could not reach them with MakeHuman targets under the validity constraint (mouth-scale-horiz was at its range). A smooth direct deformation can.

## The change
Applied to the X GLBs, same vertex order, same map for neutral and smile:
- mouth band moves up 0.051 IPD (full weight for |y+1.0|<.18 and |x|<.7, zero beyond y distance .30 or |x|>1.0, smoothstep falloff, so the nose at the subnasale is not moved);
- mouth region stretches in x by 7.5% (full for |x|<.5, zero beyond .9).
Both maps are monotone: the smallest d(x')/dx is .83 and the smallest d(y')/dy is .36 on a dense grid (mouth.py prints it).

## Measured from the Y GLBs (IPD units; ref = U-table, approximate)
| measure | reference | X smile | Y smile |
|---|---|---|---|
| mouth width | .989 | .919 | .987 |
| eye line to mouth centre | .953 | 1.004 | .953 |
| outer lip height | .317 | .311 | .311 |
Other landmark ratios (eyes, alae, subnasale, chin) are unchanged from W. Neutral (no reference value): mouth width .929, eye to mouth centre .959. The face_w_y-0.95 value printed by measure_glb.py changes (1.33) because the mouth band moved through its measuring height; do not read it as face width.
These two numbers were targeted by the correction, so they are fitted, not independent. The visual check is evidence/mouth_zoom_ref_W_X_Y_smile.png (ref, W, X, Y).

## Checks (what they are, and are not)
From the Y GLBs (loop_check_from_GLB.json): 0 flipped triangles, neutral and smile. Smallest area ratio .273 neutral vs child base, .243 smile vs own neutral (4 smile triangles below 25%, 6 turned more than 60 deg; slightly worse than X, .267 and 4). NOT checked: self-intersection or non-manifold geometry, depth, side profile.

## What this does not fix (observed, not measured)
The mouth opening is a thin slit with no visible upper-lip shape or lip volume; the reference shows a wide open smile with teeth. The stretched mouth corners show creases. Cheek fullness, eyelids and eyeballs, teeth and colour are not modelled. The interior forms (lip volume, cheek apples, depth) cannot be measured from three front smiling photos with no side view, so any further push on them would be by eye, not a measured fit.

## Files
karma_face_MH_neutral_Y.glb, karma_face_MH_smile_Y.glb, MH_measured_from_GLB.json, loop_check_from_GLB.json, evidence/ (panel ref|Q|Y smile, neutral panel, mouth zoom), src/ (mouth.py new; others as X), map_*.npy.
Rerun from this src/: set V_REFDIR (the 3 reference photos), V_MH_DATA (MakeHuman clone at a8bc2d54ff0ac92e78ff71431b1023eda42bf482), then `python3 mouth.py && python3 measure_glb.py && python3 loop_check.py && python3 panels.py`. mouth.py reads the X GLBs from the sibling folder.
