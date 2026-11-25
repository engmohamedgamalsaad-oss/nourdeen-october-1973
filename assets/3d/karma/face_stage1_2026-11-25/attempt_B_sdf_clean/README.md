# Karma face stage 1, attempt B (EXPERIMENT, NOT FINAL, likeness NOT approved)

Second authored SDF face. Attempt A is preserved next to it in ../attempt_A_sdf (not replaced).

- karma_face_stage1_B_EXPERIMENT.glb: 3,251,256 bytes, 162,449 triangles, 81,305 vertices (grid 0.014 IPD, then 55% quadric decimation). Head plus neck stub, vertex colours, not rigged, no hair.
- Units: inter-pupil distance = 1, origin between the pupils, +y up, +z forward.

## Changes from A (reviewed against clay renders first)
- Eyes: almond openings are cut into one continuous skin surface; the lid margins are the cut edges and an eyeball sits behind, clipped to the opening. The separate lid shells (the "black bags") are gone.
- Nose: low child bridge, soft tip, small alae blended in, small nostril cuts. The large bridge and the alar bulbs are gone.
- Cheeks: separate cheek balls removed. Fullness comes from the lower-face ellipsoid.
- Lips: ridges blended into the mouth area, a mouth cavity and a lip line carried to the corners. Lips are still a single pillow shape.
- Ears larger. Finer grid and Taubin smoothing remove the faceting.

## Not achieved
- Likeness. The clay face is a clean child face, but it is generic. It lacks her rounded smile with cheek lift, larger eyes, the lip shape, the small chin and ear detail.
- Profile (nose projection, chin, ear shape) is not observed in the references, which are all near-frontal. It is an assumption.
- The lower lip lump in profile and the hollow eye opening seen from the side.
- Colour is a front projection of the private reference. It hides geometry faults and bakes in teeth, lip and hair shading. Judge the clay renders. The side and 3/4 textured views have no real texture.
- Not decimated for mobile, not rigged.

## Rebuild
src/sdf_head_B.py (DECIMATE=0.55 python3 sdf_head_B.py) writes head_raw.ply. src/color_export.py needs the private reference images and the landmark file, so it will not run as-is. The reference images are not in the repo.
