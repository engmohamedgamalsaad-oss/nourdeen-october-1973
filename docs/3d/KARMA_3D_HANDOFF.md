# Karma 3D — handoff package (2026-11-24)

## Purpose
This is a starter body blockout for the Khaledoon Karma character workflow. It is **not** a likeness model and must not be presented as the finished character.

## Actual model facts
- Source asset: `karma_body_blockout_A_pose.glb` (GLB 2.0).
- This repository stores the binary as gzip-compressed `karma_body_blockout_A_pose.glb.gz`; decompress it to obtain the original GLB.
- Decompressed GLB size: 25,928 bytes.
- Geometry: 708 triangles across 10 shared meshes.
- Scene graph: 33 nodes, including named body-part / joint-like nodes.
- Materials: 7 embedded PBR base-color materials; no image texture maps.
- glTF skins: 0. Vertex skin weights: none. Animations: 0.

## Visual / identity limitations
- The head is a blank skin-colored placeholder. It has no face, hair, braids, bows, or identity details.
- This blockout is deliberately low-poly and only establishes rough body parts and color regions.
- It does not prove that Karma's face or body likeness has been preserved.
- Do not project a flat face image onto the head as a substitute for true facial geometry.
- The supplied references are mainly frontal. Side, three-quarter depth, rear skull shape, and hidden hair construction remain unknown and must be labelled as inferred.

## Restore the GLB
The GitHub asset is gzip-compressed. On a machine with Python:
```bash
python -c "import gzip; open('karma_body_blockout_A_pose.glb','wb').write(gzip.open('karma_body_blockout_A_pose.glb.gz','rb').read())"
```
Then load the resulting `.glb` with Three.js `GLTFLoader`.

## Next work for Claude
1. Inspect the current Three.js Karma implementation in the repository before changing anything. Preserve working movement and avoid unrelated edits.
2. Compare this starter blockout with the existing body; decide whether to adapt, replace, or discard it. Do not merge or publish.
3. Develop the head separately using geometry-first modelling. Preserve the supplied face proportions; no generic child face and no flat face card.
4. Clearly mark side/back anatomy as inferred because the references do not show those views.
5. Before claiming likeness, render the same actual 3D head from front, three-quarter, and profile, and compare those renders beside the supplied references.
6. For a production rig, create a real glTF skin with JOINTS_0 / WEIGHTS_0 and inverse bind matrices, or rig and weight in Blender before exporting.
7. Test the actual GLB in Three.js and report triangle count, file size, materials, texture sizes, skin/joint counts, and animation tests.

## Safety / scope
- Do not upload the original reference photos to external services.
- Do not start paid subscriptions.
- Do not modify Supabase, secrets, workflows, the published branch, or the live site.
- No merge or publication is authorized by this handoff.
