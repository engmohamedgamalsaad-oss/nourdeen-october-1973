# Rebuild attempt C from this folder (no private input needed)

    pip install -r requirements.txt   # mediapipe line only needed for lm.py
    DECIMATE=0.5 python3 sdf_head_C.py       # reads contours.json + polyutil.py, writes head_raw.ply and parts.pkl
    python3 export_noprivate.py              # writes karma_face_stage1_C_flatcolour.glb (flat colours, no photo)

Checked in a clean directory on 2026-11-25: 183,050 head triangles, 210,986 total, same geometry as the committed karma_face_stage1_C_EXPERIMENT.glb. Only the vertex colours differ (the committed GLB also carries a photo projection on the skin; the flat-colour build does not).

Private inputs, NOT in the repo: the 3 reference images, the MediaPipe landmark arrays made from them (lm.py), and the face crop. extract_contours.py shows how contours.json was derived from them. contours.json (averaged outline numbers) is committed, so the geometry does not need the images.
face_landmarker.task (for lm.py only): https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
Rendering evidence: shot.sh and renderall.sh use headless Chrome and three.js from npm (npm i three), serving the folder over http.
