# attempt_AB: lip colour, teeth strip and mouth interior on attempt AA (face only)
Status: EXPERIMENT, face only. NOT a likeness approval. No hair, body, clothes or Rig. No reference image used as texture or projection (aligned display crops only; colours are flat values I chose, no pixel sampling). Attempts A-AA, site files and main untouched. Skin geometry is unchanged from AA/Z. Teeth and colour regions are my own geometry and scripting (src/lips.py), no asset file, no licence question.

## Scope
Lip step of the interior-form pass under user instruction 15211026 (front references only, no extra photos needed).

## Evidence from the photos (by eye, +-.03 IPD)
Lips are pink, outer lip outline: corners (+-.49, -.83), top at centre about -.77, bottom at centre about -1.12. Teeth show through a lens-shaped opening in the smile; the mouth interior is dark at the corners.

## The change
- Lip colour: skin vertices inside a lens outline from the numbers above (178 vertices in the smile, 241 in the neutral, where the lower edge is the same outline) get a flat pink vertex colour. The mesh is coarse, so the boundary is soft.
- Teeth: one curved off-white strip (3x29 vertices) behind the opening, upper edge from the upper-lip lower edge, lower edge from the Z opening. DEPTH ESTIMATED: z .46 at centre curving back to .43 at the sides, behind the lip edge ring (z .52 to .54). No tooth separation, one strip.
- The neutral gets a smaller opening (about .09 IPD, inferred, not photographed) so it is not just the smile copied; the neutral skin mesh is Z's neutral and is not recomputed here.

## Checks
Visual: evidence/mouth_zoom_ref_stand_clasp_AA_AB_smile.png (ref stand, ref clasp, AA, AB) and front panels (ref|ref|ref|Q|AB smile, Q|AB neutral). NOT checked: teeth-to-lip intersection or poke-through at other angles, depth, side view, the neutral mouth shape against any reference (none exists). Skin loop checks are Z's; skin did not change.

## What is still different from the photos
Teeth read as one blocky white bar with no tooth separation or shading; the upper lip has no cupid's bow shape and no highlight; the lip contour is the soft vertex-colour boundary, not a modelled edge; corner creases remain; no dark corners inside the mouth. Cheek fullness, brow and hair are not modelled.

## Files
karma_face_MH_neutral_AB.glb, karma_face_MH_smile_AB.glb, glb_sha.txt (sha256 and bytes), evidence/, src/ (lips.py new; others as AA), map_*.npy (skin vertices come first in the AB vertex list in their original order).
Rerun from this src/: set V_REFDIR, V_MH_DATA, then `python3 lips.py && python3 panels.py` (reads the AA GLBs from the sibling folder).
