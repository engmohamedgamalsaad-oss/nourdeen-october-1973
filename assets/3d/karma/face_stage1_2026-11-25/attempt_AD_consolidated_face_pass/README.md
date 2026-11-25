# attempt_AD_consolidated_face_pass

Consolidation of the bounded face pass. No new geometry. Final files = smile from AB, neutral from AC.
Files: karma_face_MH_smile_AD.glb (637,612 B, 31,636 tris, sha256 df6bfbc3a5322844d586b77a1d369e1dbcd4e68457b0a7f087a806cdd00ec78c),
karma_face_MH_neutral_AD.glb (634,876 B, 31,524 tris, sha256 e18b875e79e0a9776eaa0fadd643a6d8945d4216f3e5fb23ce3864ec03326e2b).
Evidence: evidence/final_neutral_smile_front_34_side.png (rows: neutral, smile; columns: front, 45, side 90, -45), rendered from the exported GLBs by src/angles.py.
Validity: validity_final_GLBs.json (src/validity.py), numeric triangle-triangle tests.

## Geometry edits
X jaw/chin lateral taper. Y mouth band up .051 and 7.5% x stretch (smile). Z lower lip opening .081 to .116 (smile). AA two procedural eyeball spheres (r .30). AB 3x29 teeth strip in smile (z estimated). AC neutral uses X skin (no mouth edits).
## Colouring only
Lip colour (AB, AC), eye/teeth colours. This is NOT per-vertex lip contour shaping.
## Validity (numeric)
Skin self-intersection: smile 0 pairs. Neutral 28 pairs, all at the closed lip seam (x +-.26, y about -.93, z .43-.55): the lips touch/overlap there.
Eyeball vs skin: 1,662 triangle pairs cross (267 skin tris) in both states. Expected where lids meet the sphere, but it was not separated into legitimate lid contact vs poke-through.
Teeth strip vs skin: 3 crossing pairs (smile).
Normal flips: 0 in skin (loop checks on W-Z; skin unchanged since Z for smile, X for neutral. Not rerun on AC).
## Not done / limits
No per-vertex lip contour. No lid-arch correction (upper arch still flatter than the reference). No lash line or catchlight. No nose-mass or cheek work. No brows, hair. Depth (eyes, teeth, side profile) is estimated, not measured. Side/3/4 views are inspection of the existing result only, no side shape was fitted. Likeness not claimed. Final head, hair, body, Rig not started.
