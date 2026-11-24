# Karma integrated v1 (EXPERIMENT, NOT FINAL)
Model: EXPERIMENT_NOT_FINAL_karma_integrated_v1.glb (about 32 MB, about 446k triangles; heavy for mobile, not yet optimised).
What it is: the TRELLIS baseline body (19-bone rig, same bones/IBM method as the baseline, canonical JS unchanged) with
- the TRELLIS face/skin above the neck and the TRELLIS facial features removed (face-zone triangles deleted),
- the TRELLIS curly hair kept, its dark hair texels recoloured to brown (hair texel mask only; shirt, denim, skin, shoes, pom-pom/bow texels protected),
- my authored head v3 (displaced sphere, almond eyes, lips, vertex colours, depth z-scaled x1.12) bound to Head, plus a skin neck tube weighted Neck->Head.
Unchanged baseline GLB and weights_v2 GLB are still on the branch.
Evidence/: head close-ups (front, 3/4, side, back), forced pose renders, animated 6-action contact sheet + log (walkTo, jump, wave, tilt, leanOn completed; stand is a reset that only resolves when preempted), harness JSON.
Known limitations: face still generic (nose volume low, lips pale/wide, egg skull, profile depth guessed); no ears; hair is TRELLIS curls (not braid ribbons), bows/clips only as baked in the texture, hair texture blotchy with leftover dark specks; neck is a plain tube; head-hair gap/rim artifacts at the temples; hair has some stray fringe strands; file size/triangle count not mobile-optimised; deformation of neck/head not yet re-evaluated close-up; no video. Likeness is not claimed.
