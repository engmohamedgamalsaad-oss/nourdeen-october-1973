# Stage 4, head route proof v1 (EARLY PROOF, NOT FINAL, likeness NOT verified)
Code-built 3D head (displaced sphere), 3D eyeballs, painted-texture brows/blush/mouth, rendered with a numpy rasterizer from the real geometry. Front, 3/4, side previews: head_views_v1.png.
Feature positions are numeric constants (in pupil-distance units) measured from the front reference only (face width 2.18, eye line 0, nose tip 0.65, mouth corners 0.8, chin 1.48; eye roll in the reference was levelled). Side and back depth are guesses, not confirmed from the references.
Known defects: brows/blush/mouth are on a planar texture that smears at the sides, back seam visible, mouth is paint not geometry, no hair yet, proportions not matched to the reference. Not attached to the body yet.
No reference photos or landmark arrays are in this folder; previews are renders of generated geometry only.
