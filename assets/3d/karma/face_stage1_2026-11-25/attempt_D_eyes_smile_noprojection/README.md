# attempt D: eyes, lids, smile, cheeks, neutral and smile, no photo projection. EXPERIMENT_NOT_FINAL, likeness NOT approved.

GLBs (flat colours only, no photo projection):
- karma_face_stage1_D_smile_EXPERIMENT.glb, 3,767,352 bytes, 197,802 triangles (head 182,442 + 12 teeth), sha256 52392881aeac6b48daf2be491a22e4b016e3b76316d6712ef7134d65561483d6
- karma_face_stage1_D_neutral_EXPERIMENT.glb, 3,642,412 bytes, 181,998 triangles, sha256 2d1138464a6cf97bdfc84ecb1fb5658b382f3a9aee09e0b00589bc160cdae79c
No triangle reduction has been done (the SDF mesh is halved once by the mesher only).

Changes from C: eye openings are now filled by a real eyeball ellipsoid clipped to the skin envelope (no outer-corner hollow); iris and pupil are flat colour regions on that geometry (larger than C); brows are low soft ridges placed from the reference brow height; neutral variant has lowered mouth corners, closed lip slit, no teeth, smaller cheek mass.
Evidence: evidence/compare_front_matched.png (3 references x smile x neutral, same scale: inter-pupil 300 px, same pupil midpoint, render rolled to the reference roll) and compare_three_quarter.png. The references are within about 4-5 degrees of frontal (measured from landmarks), so NO reference 3/4 or side view exists: the 35 degree sheet is shown beside the front reference and is not a matched comparison. Profile depth is assumed.
Known faults: eyes still look smaller and flatter than the reference, iris/lid edges are jagged, a ring groove around each opening, lip colour regions are jagged, nose bridge and cheek mass are heavier than the reference, lips are thin slabs, chin/jaw not re-fitted. Not a likeness match yet.
Build: src/sdf_head_D.py (EXPR=smile|neutral, DECIMATE=0.5) then src/export_D.py; needs only contours.json and polyutil.py. compose_compare.py needs the private references (not in repo).
