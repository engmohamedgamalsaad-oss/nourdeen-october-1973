# attempt_AF_lids_nose_mouth_width_on_AE
Second regional per-vertex pass on the AE GLBs (inputs: attempt_AE_regional_sculpt_on_AD). New folder, earlier ones untouched. Face only, likeness NOT claimed, no hair/body/Rig/final head.
Files: karma_face_MH_smile_AF.glb (637,612 B, 31,636 tris) sha256 83dbf1a80cdde8e5d62f1bda140e3441951ddd5f46e9cb73aca88100d4f2b6a8; karma_face_MH_neutral_AF.glb (634,876 B, 31,524 tris) sha256 46614eadee663699325ac36c535d0ebbec1f0666a81715e19ca5d8d2fc65ee37.
Params: src/q2.json (src/sculpt2.py).
## Mouth width, measured on the exported lip-colour vertices (IPD units, eye line y=0)
AD smile 1.014 -> AE 1.048 (AE went the wrong way: the cheek push widened the mouth) -> AF 0.969. Reference smile by reading the aligned clasp crop: about .97 (earlier worker table: .989), eyeballed from a 0.5-grid, so a visual reading with roughly +-.03 error. AF neutral 0.872 (inferred, no neutral photo). Lip y extent smile -1.192..-0.820; reference read about -1.17..-0.83 (visual).
## Changes
- Lids: upper lid margin raised .03 near each eye, crease groove (z -.025 at y .20) and lid fullness (z +.015 at y .10), outer corner extended .06. A first try with .07 raise exposed the whole iris and sclera and was rejected on visual inspection.
- Nose: alar width pulled in 8% more, tip/alae Laplacian smoothing (5 iters). This only removes the hard nostril hooks; it is mesh cleanup, not likeness evidence. Reference alar width about .61, AE about .66 by the same visual read; AF not re-measured numerically.
- Mouth zone narrowed 13% (Gaussian), lips, teeth and nearby skin together.
## Checks on THESE exported meshes
Skin vs AE, per triangle: flipped 0, turned over >60 deg 0, area ratio min .326 (smile) / .331 (neutral), under .25: 0 (normal_area_check_vs_AE.json). Numeric self-intersection (validity_final_GLBs.json): skin 0 pairs both states, teeth vs skin 0, eyeball vs skin 1,798 pairs (AE 1,868, AD 1,662), still not split into legitimate lid contact vs poke-through.
## Not done
No lash line, lid colour or lip contour beyond the colour already there; nose tip/bridge shape still generic; ears, brows untouched; neutral shows a lip seam line only; depth and side profile estimated.
