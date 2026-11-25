# attempt G: one continuous eye/lid surface. EXPERIMENT_NOT_FINAL, likeness NOT approved. A to F kept unchanged.

GLBs (flat colours, no photo projection, no reduction):
- karma_face_stage1_G_smile_EXPERIMENT.glb, 9,518,092 bytes, 484,934 triangles, sha256 837483a3c2a4a64125ddc903b6261597182a2e8e9347a2327176886862fd7832
- karma_face_stage1_G_neutral_EXPERIMENT.glb, 9,189,424 bytes, 458,938 triangles, sha256 8cc74352d0e2cbe3fd571a461dfeb99bf877e1edae1c22c36b5afa59648c7ac3
Triangle counts are high (grid .01 plus one local subdivision for colour edges). Not final; reduction only after approval.

## Diagnosis of F (evidence/eye_isolation)
Isolated right eye, same method switch, rendered at 0, 35 and 75 degrees plus a y-z cross-section through the eye centre.
1. F method: the eyeball ellipsoid was unioned with the skin envelope clipped at +0.02, but the ellipsoid is larger than the aperture, so it added a raised ring OUTSIDE the opening (the ring ridge). The lid "rim" and "crease" were capsules extruded and unioned onto the surface, so they read as separate stacked outlines (detached double shell).
2. Offset-shell method (tried in isolation, rejected): a lid shell offset from an eyeball ellipsoid gave a pouch under the eye and a deep pit at the inner corner, because the skin around the eye curves away (skin z from -0.10 at the inner corner to -0.28 at the outer corner) while a sphere does not.
3. G method: no unions of extra bodies. Inside the aperture the surface is the skin envelope itself shifted back .015 and bulged .04 toward the centre, around it the same skin field is thickened by a soft ring and a soft crease, blended through a .012 ramp at the aperture margin. It follows the head curvature by construction, so there is no ring, no pouch, no pit.
Can the SDF method represent this? Yes for a continuous margin (it is one scalar field, so the margin is continuous by construction). Limits: the margin is a step of about .03 IPD, which needs grid .01 or finer to resolve (hence the slab builder in sdf_head_G.py, MODE=slab then MODE=mesh); real lid folds, lashes and tear duct detail are not modelled.

## Still wrong
Eyes are drawn in flat vertex colour, with a dark margin line from shading; no lashes or gloss; eye still smaller/flatter than the reference; brow outer end heavy; cheek/nose/mouth transition not fitted; thin lips; chin not refit; a tiny stray bump under the nose (philtrum cap). Camera match is approximate. No 3/4 reference exists; the 35 degree sheet is NOT matched.
Build: src/runG.sh smile|neutral (needs only contours.json and polyutil.py). eye_patch.py reproduces the isolated eye (EYEMODE=old|new|blend).
