# attempt_AE_regional_sculpt_on_AD
Per-vertex regional sculpt on the AD GLBs (new folder, AD untouched). Face only. Likeness NOT claimed, no hair/body/Rig/final head.
Files: karma_face_MH_smile_AE.glb (637,612 B, 31,636 tris), karma_face_MH_neutral_AE.glb (634,876 B, 31,524 tris). Same topology as AD.
Method (src/sculpt.py, params src/p3.json; compared against pupil-aligned crops of the 3 original references, which are NOT published):
- Cheek/jaw fullness: Gaussian-weighted outward push on cheeks and lower jaw sides (the AD lower face was narrow and jowly versus the round child face).
- Smile-crease and hollow-cheek relax: weighted Laplacian relaxation (8 iters, weight .8) in the cheek/mouth zone.
- Eyes: skin around each eye scaled wider (.10) and taller (.34 up, .6x of that down) about the pupil centre. Eyeballs unmoved.
- Nose: alar width pulled toward the midline (12%).
- Mouth zone (lips+teeth): 9% narrower, .05 lower; lower lip .035 lower; small cupid-bow raise (.012) on the upper lip.
Validity (src/validity.py, numeric): skin self-intersection 0 pairs in both states (AD neutral had 28 at the lip seam; the neutral lip seam is no longer overlapping, but not separately modelled). Teeth vs skin 0 pairs (AD 3). Eyeball vs skin crossing 1,868 pairs (AD 1,662), still not split into legitimate lid contact vs poke-through.
Limits: nose shape, lid shape (no lash line/crease), lip contour fidelity, ears, brows remain far from the reference. Depth is estimated; side/3-4 views are inspection only. Maxdisp .23 IPD units.
