# Karma archive 2026-11-24 (preservation only)

Versioned copies of earlier project artifacts. No new tests, no edits to models. Nothing here is a verified likeness, and none of it is the final Karma.

- trellis_original_glb/karma.glb, karma2.glb: raw TRELLIS.2 outputs (MIT licensed model), unchanged. Textures are baked UV atlases.
- prototype_sources/karma3d, karma3d_face: earlier React/three prototype code. meshData.ts.gz is the original mesh data (gunzip to use). karmaRig_vc.ts and karmaRig_stand_in.ts.bak are earlier rig variants. These are not the canonical js/KarmaRig.js.
- meshdata_variants: 136k, v3 and good mesh-data variants (gz). meshData_prev equals an older copy of good with small differences and is not archived separately.
- build_scripts: prep, cut, patch, proj, build and render scripts used to make the above.

## Held back, deliberately (dependencies not in this folder)
- Raw reference photos, the A-pose input image, face landmark arrays (.npy): private source material, not pushed.
- faceData.ts (embedded face photo, base64) and patchData.ts (face-patch texture): stripped from the prototype folders. The patch texture is already embedded in baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb.
- Bundled vendor three.module.min.js: use three from npm (MIT).
- 3DDFA_V2 / BFM: non-commercial license, quarantined, never committed.
- Build scripts reference local /downloads paths to the withheld inputs, so they will not run as-is.
