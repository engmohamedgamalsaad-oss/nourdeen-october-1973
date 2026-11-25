# attempt_AA: eyeballs behind the lid openings, on attempt Z (face only)
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops only; colours below are flat colours I chose, no pixel sampling). Attempts A-Z, site files and main untouched. Skin geometry is Z's unchanged (MakeHuman CC0 assets via W, X, Y, Z; licence list in ../attempt_V_makehuman_cc0_limited_fit_test/CREDITS_and_per_file_license_check.md). The two eyeballs are procedural spheres from my own script (src/eyeballs.py): no asset file, no licence question.

## Scope
User instruction 15211026 (Nov 25, 10:51): eyes, aperture and lids first, from the existing front references; extra photos optional. This is the eye step of the interior-form pass.

## Evidence from the frontal photos (by eye on pupil-aligned crops, about +-.03 IPD; viewer-left eye)
Eye corners about (-0.76, 0.02) and (-0.30, -0.04); upper lid peaks near y 0.12 at x -0.55, lower lid about -0.07; iris centre about (-0.50, 0.02), iris diameter about .24; both whites visible beside the iris; a dark lash line on the upper lid.
Mesh Z/W opening (GLB landmarks): corners (-0.721, 0.002) and (-0.279, -0.026), upper -0.475, 0.073, lower -0.48, -0.073, so the opening size already matched the photos (aperture .146 vs .1455); the opening was empty.

## The change
Two spheres (radius .30 IPD, 96x60 segments) centred at x = +-0.50, y = 0.01, z = -0.03, added to the same primitive. Flat vertex colours by angle from the straight-ahead axis: pupil (radius .05), iris (to .125, dark brown), limbal ring, off-white sclera. Gaze straight ahead, same in neutral and smile. DEPTH IS ESTIMATED: the front pole sits at z .27, behind the lid edge ring (z .21 to .31); no true depth is known or claimed. Lids, aperture and opening shape were not changed.

## Checks
Visual: evidence/eye_zoom_ref_stand_clasp_Z_AA_smile.png (ref stand, ref clasp, Z, AA) and front panels (ref|ref|ref|Q|AA smile, Q|AA neutral). Eyes read through the openings and do not show outside them in these renders. NOT checked numerically: eyeball-lid intersection, depth, side view, shading in other renderers. Skin loop checks are those of Z (nothing about the skin changed; loop_check not rerun). File sizes in glb_sha.txt.

## What is still different from the photos
No dark upper lash line or lid thickness (the opening edge is a plain polygon), no catchlight, upper lid arch is flatter than the photo, the outer corner slopes less. Eyebrows are not modelled.

## Files
karma_face_MH_neutral_AA.glb, karma_face_MH_smile_AA.glb, glb_sha.txt, evidence/, src/ (eyeballs.py new; others as Z), map_*.npy (these index the skin vertices only, which keep their original order and come first in the AA vertex list).
Rerun from this src/: set V_REFDIR, V_MH_DATA, then `python3 eyeballs.py && python3 panels.py` (reads the Z GLBs from the sibling folder).
