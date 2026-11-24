# integrated_v3 - EXPERIMENT / NOT FINAL

- karma_integrated_v3_EXPERIMENT.glb: 31.75 MB, 439,892 tris. v2 plus a yellow collar ring (bound to Chest) over the jagged collar. Temple sliver removal was tested and disabled (it made the edge worse).
- karma_integrated_v3_PARTIAL_REDUCED_TEST.glb: 18.9 MB, 293,998 tris. Head decimated ~70%, body NOT decimated (decimation scrambled UVs), 1024 texture. Still too heavy for mobile. NOT a mobile pass; no device performance measured.
- evidence/FAILED_body_decimation_scrambled_UV.png: failed body decimation (nearest-vertex UV transfer on unwelded mesh). That GLB is not kept.
- evidence/joints_v3.png: close-ups of elbow, knee, hip, shoulder, neck turn/tilt. Elbow/knee/hip bend plausibly, shoulder-up pinches slightly, head moves over the neck tube without tearing.
- Harness: walkTo/jump/wave/tilt/leanOn complete; stand resolves only on preemption (reset).

## Limits
Face is generic (smeared nose, pale lips, no ears), no likeness claim. Hair is recoloured TRELLIS curls with blotchy texture and ragged temple edge; bows/pom-poms are texture only. Plain tube neck. Not mobile-optimised.

## Remaining authored geometry
Nose bridge/tip/alae, almond lids, lip volume, ears, braid ribbons, bows, pom-poms, clips, neck/collar rebuild, hair texture cleanup, UV-aware body decimation.
