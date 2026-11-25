# Karma face stage 1, attempt C (EXPERIMENT, NOT FINAL, likeness NOT approved)

Attempts A and B are preserved next to this folder and unchanged.

- karma_face_stage1_C_EXPERIMENT.glb: 5,048,084 bytes. Head mesh 183,050 triangles, plus 18 small separate meshes (eyeball sclera, iris and pupil for each eye, 12 teeth). Total 210,986 triangles. Not rigged, no hair.
- Units: inter-pupil distance = 1, origin between the pupils, +y up, +z forward.

## What is geometry now
- Eyes: the openings are cut into the skin using the averaged reference eye outlines (src/contours.json, numbers only). Each eye has a separate sclera sphere, iris cap and pupil cap, each with its own flat material colour, so the clay render shows the opening.
- Mouth: an open smile cut from the averaged reference inner-lip outline. The lips are a rounded slab from the outer-lip outline, blended into the mouth area. The teeth are separate geometry (7 upper, 5 lower). Lips are pink and the mouth interior is dark red, from geometry regions, not from the photo.
- Cheek lift: a soft cheek mound on each side.
- Ears: plate with helix rim, antihelix ridge, concha cavity, tragus and lobe.
- Nose, brows, chin and jaw: as in B, with extra lower-lip and chin support so the lower lip is not a flap in profile.

## Not achieved / assumptions
- Likeness is not approved. The refs are near-frontal, so profile depth (nose projection, chin, ear shape) is an assumption. Judge the clay renders against the reference.
- Teeth are plain rounded ellipsoids. Gum line, lip thickness and lid thickness are simple.
- The skin colour is a front projection of the private reference. The side views have no real texture. The reference images are not in the repo.
- Not decimated for mobile and not rigged.

## Rebuild
DECIMATE=0.5 python3 sdf_head_C.py, then python3 color_export_C.py. The colour step needs the private landmark file and reference crop, so it will not run as-is. renderall.sh and shot.sh render the evidence in headless Chrome.
