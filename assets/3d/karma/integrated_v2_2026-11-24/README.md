# Karma integrated v2 (EXPERIMENT, NOT FINAL)
Built with HEADPKL=parts_v4.pkl ZS=1.0 ZO=0.012 DY=-0.010 python3 build_glb3.py (see src/). Changes versus v1 (integrated_v1 folder is untouched):
- Head v4 geometry (geo4.py): nose tip height 0.023 -> 0.015, cheek bumps wider and lower (0.018 -> 0.010), chin bump 0.005 -> 0.002, lower face recedes more (0.06 -> 0.16). Result: the profile muzzle is smaller. Lips are still surface displacement plus colour, no new lip geometry.
- Head lowered 0.010 and z offset/scale simplified (x1.0 +0.012); neck tube shortened (y 0.60-0.70) with a flare at the base.
- Small disconnected hair/skin fragments (welded components under 600 triangles, above y 0.60) removed from the TRELLIS mesh.
Remaining visible problems (see evidence/head_closeups_v2.png and before_after_v1_v2.png): ragged hair edge at the temple, nose still smeared/low volume, neck still a plain tube with a jagged collar, hair texture blotchy, mouth/lips pale, no ears, face generic. Not mobile-optimised (about 32 MB). No likeness claim. 
