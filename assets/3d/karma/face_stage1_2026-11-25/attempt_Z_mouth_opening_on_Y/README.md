# attempt_Z: mouth opening (interior form) on attempt Y, face only
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops only). Attempts A-Y, site files and main untouched. Geometry: MakeHuman CC0 assets via W, X, Y (licence list in ../attempt_V_makehuman_cc0_limited_fit_test/CREDITS_and_per_file_license_check.md); new step is one scripted deformation (src/opening.py), own code, no new asset files.

## Scope note
The user's instruction 15211026 (Nov 25, 10:51) is to continue from the existing front references; additional photos are optional and not blocking. This test therefore works from the front photos only and uses estimated depth, as stated below.

## Evidence read from the frontal photos (by eye on pupil-aligned crops, about +-.03 IPD)
The smile shows a lens-shaped opening with teeth: at the centre the opening runs from about y -0.87 (lower edge of the upper lip) to -0.98 (upper edge of the lower lip), height about .11 IPD. Mesh Y: -0.837 to -0.919, height .081 (vertex 520 and 540, read from the Y GLB). The lower lip bottom in the photos is about -1.10 to -1.13; Y has -1.109.

## The change
Lower lip and its upper edge move down by up to .035 IPD at the centre (full weight below y -0.90 and for |x|<.25, smoothstep to zero by y -1.25 and by |x|=.55). Mouth corners and everything above y -0.84 do not move. Same map for neutral and smile. Minimum d(y')/dy on a dense grid is .79 (monotone). Depth: z is NOT changed (estimated, held at Y's values); no depth measurement exists and none is claimed.

## Measured from the Z GLBs (IPD units; reference approximate)
| measure | reference | Y smile | Z smile |
|---|---|---|---|
| opening height at centre | about .11 (by eye) | .081 | .116 |
| outer lip height | .317 | .311 | .332 (4.7% over) |
| eye line to mouth centre | .953 | .953 | .964 |
| mouth width | .989 | .987 | .987 |
Other landmarks unchanged. Opening height is a by-eye reference and the correction was aimed at it, so it is fitted, not independent. Outer lip height and mouth centre moved away from the reference slightly: the cost of the lower lip moving down.

## Checks (what they are, and are not)
loop_check_from_GLB.json: 0 flipped triangles, neutral and smile; smallest area ratio .273 neutral, .243 smile; 4 smile triangles under 25%, 6 turned more than 60 deg (same counts as Y). NOT checked: self-intersection, depth, side profile.

## Result and limit
The opening is now about the photo's height; evidence/mouth_zoom_ref_stand_clasp_W_Y_Z_smile.png shows ref, W, Y, Z. The mouth is still not like the photo: the opening is a skin-coloured slit with no teeth, the upper lip has no cupid's bow shape, lip colour is flat, and the corners still show creases. Geometry limit actually met: the base mesh's lip edge loops cannot form the lens-shaped opening, teeth line and lip contour by smooth warping alone without moving vertices individually. That would be a per-vertex sculpt by eye (and teeth need a CC0 teeth asset checked per file); not done here. No likeness is claimed.

## Files
karma_face_MH_neutral_Z.glb, karma_face_MH_smile_Z.glb, MH_measured_from_GLB.json, loop_check_from_GLB.json, evidence/, src/ (opening.py new; others as Y), map_*.npy.
Rerun from this src/: set V_REFDIR, V_MH_DATA (MakeHuman clone at a8bc2d54ff0ac92e78ff71431b1023eda42bf482), then `python3 opening.py && python3 measure_glb.py && python3 loop_check.py && python3 panels.py` (opening.py reads the Y GLBs from the sibling folder).
