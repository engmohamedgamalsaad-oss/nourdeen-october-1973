# attempt F: real lid geometry, wider eye aperture, slimmer nose, lighter cheeks. EXPERIMENT_NOT_FINAL, likeness NOT approved. A to E kept unchanged.

GLBs (flat colours, no photo projection, no reduction):
- karma_face_stage1_F_smile_EXPERIMENT.glb, 10,079,372 bytes, 512,520 triangles, sha256 16f8be97d05c6a44ed9f5344c635b555c14d6b0dbe849044d70d8ccacbabcd94
- karma_face_stage1_F_neutral_EXPERIMENT.glb, 9,425,992 bytes, 470,296 triangles, sha256 2961a46b3f8574f48f88db88faa675ca42b41c691dbb3370a9f79af7883a6e5b
Counts are high because the eye and mouth regions are subdivided for clean flat-colour edges. Reduction (about 60k) only after likeness approval.

Changes vs E (priorities from user message 15032583):
1. Eyes: aperture opened 1.4x in height (reference eyes are rounder than the landmark lid outline); real lid margin rims modelled along the aperture at the skin height; an upper-lid crease groove; irises sized to the taller opening. The outer-corner hollow is gone since C.
2. Nose: bridge radius .06/.10 to .045/.078, tip .12 to .105, alae .085 to .075 (slimmer).
3. Cheeks: cheek mass ellipsoids reduced (.24x.16 to .20x.13 smile, .19x.12 neutral).
4. Smile/neutral: neutral stays an independent closed-mouth geometry (from E). Lip slab slightly thicker (.06 to .08).
Still wrong: a thin ring groove remains around the outer lower eye; lash/lid colour not modelled; brow ridge heavy at outer end; lips still thin slabs and cheek-to-nose-to-mouth transition not fitted; chin/jaw not refit. Camera match is approximate (landmark scale, roll, yaw). No 3/4 reference exists; 35 degree sheet is NOT matched.
Build: src/sdf_head_F.py (EXPR=smile|neutral DECIMATE=0.5) then src/export_F.py.
