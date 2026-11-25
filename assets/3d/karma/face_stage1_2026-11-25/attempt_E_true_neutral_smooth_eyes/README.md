# attempt E: true neutral mouth + smooth eye colour. EXPERIMENT_NOT_FINAL, likeness NOT approved. Attempt D is kept unchanged next to it.

GLBs (flat colours, no photo projection):
- karma_face_stage1_E_smile_EXPERIMENT.glb, 9,455,532 bytes, 481,330 triangles (head 465,970 + 12 teeth), sha256 679c436a97d7ec6f71967cdfed1fe10bde59ed792593908cb4228d33b855a916
- karma_face_stage1_E_neutral_EXPERIMENT.glb, 8,840,656 bytes, 441,018 triangles, sha256 03d5ddc28abbc4e4464db123bc7ddb9047a022bf50264eaa83143e64625acd86
Triangle count rose because the eye and mouth regions are subdivided twice so vertex colours can have smooth edges. This is not a final count. Reduction only after approval.

Fixes vs D: (1) neutral mouth redone as a closed, flat slit with corners slightly down, narrower and shallower lower lip (D reused the smile outline, so it still looked like a smile). (2) Jagged iris, pupil and lid colour edges were a vertex-colour sampling problem on a coarse mesh, not geometry: the regions are now subdivided and colour-blended with soft edges. (3) lid cut edge rounding reduced (0.02 to 0.008).
Still wrong: a ring groove remains around the outer part of each eye (the fill ellipsoid versus lid margin, a real geometry problem); eyes smaller and flatter than the reference, no lid fold or lashes; nose bridge and cheek mass heavy; thin lips; chin not re-fitted. Reference pose match is approximate (inter-pupil scale, roll and yaw taken from landmarks), not a calibrated camera match. No 3/4 reference exists; the 35 degree sheet is labelled NOT matched.
Build: src/sdf_head_E.py (EXPR=smile|neutral DECIMATE=0.5) then src/export_E.py.
