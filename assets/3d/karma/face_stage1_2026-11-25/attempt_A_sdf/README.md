# Karma face stage 1, attempt A (EXPERIMENT, NOT FINAL, likeness NOT approved)

New face built from scratch as geometry (signed-distance field of separate primitives, marching cubes). It is not a patch of v1/v2/v3 and does not use the TRELLIS mesh.

- karma_face_stage1_A_EXPERIMENT.glb: 3.58 MB, 178,832 triangles, 89,519 vertices, head plus short neck stub, vertex colours. Not rigged yet (stage 3). No hair (stage 2); the dark cap on top and back is a placeholder.
- Units are inter-pupil distance (IPD) = 1, origin between the pupils, +y up, +z forward.

## Real geometry
nose bridge, tip and two alae with nostril cuts; eyeballs with upper and lower eyelid shells; brow ridges; upper and lower lips with a mouth cavity; ears (shell, lobe, concha cavity); cheeks, chin, jaw.

## How it was measured
MediaPipe face landmarker on the 3 private reference images (standing, waving, hands clasped; all near-frontal, not side profiles). Averaged IPD-normalised metrics are in src/landmark_metrics_ipd_units.json. Face width about 2.2 IPD, nose width about 0.68, mouth width about 0.99, nose tip 0.63 below the pupils. Profile depth (nose projection, chin, ears) is NOT observed in the references. It is a prior from the landmarker plus my choices, so it is an assumption.

## Colour
Orthographic projection of the standing reference onto the front of the mesh (landmark aligned). Skin tone, eyes and teeth come from the photo. This is texture on top of authored geometry, not the geometry itself. The reference images are not in the repo.

## Known faults (honest)
- Likeness is not reached. Compared with the reference, the face is too wide and flat, the cheeks are too full, the nose is too long and large, ears are too small, lips are the wrong shape, and the lower lids show a dark band.
- Teeth and lips are smeared by the front projection. The side views have no real texture.
- Hair strands baked into the forehead by the projection. Hair geometry is stage 2.
- Triangle count (179k) is high for mobile; decimation is not done.

## Rebuild
src/sdf_head.py writes head_raw.ply. src/color_export.py projects the private reference and writes the GLB. These need the private reference images in /downloads, so they will not run as-is. Needs numpy, scipy, scikit-image, trimesh, pillow. shot.sh plus view.html render the evidence in headless Chrome with three.js.
