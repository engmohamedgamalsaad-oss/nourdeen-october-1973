# Controller + deformation harness (TEST, canonical JS unchanged)
harness_v2.mjs loads a GLB with GLTFLoader, runs createRig, runs all six KarmaController actions (walkTo, jump, wave, tilt, leanOn, stand) and awaits their promises (the earlier walk "failure" was the harness reading a promise result before it resolved), then rotates each joint hard and measures vertex displacement and edge stretch.
Run: place KarmaRig.js and KarmaController.js (unmodified) next to it with three installed, `node harness_v2.mjs model.glb out.json`.
Result for the unchanged baseline GLB: RESULT_harness_v2_baseline.json. All 6 actions complete. Shoulder/hip hard rotations (1.0-1.2 rad) stretch about 0.15 percent of sampled edges over 2x (max about 12x at seams), neck/head about 0.5-0.7 percent. Visual deformation screenshots are not yet captured.

## Browser deformation render (baseline GLB, headless Chrome + SwiftShader, three.js GLTFLoader + createRig)
poses_baseline_browser.png: rest, shoulders up, elbows bent, hips forward, knees bent, neck/head turn. pose_page.html is the page (needs three in ./node_modules, the two canonical JS files and the GLB beside it).
Observed: shoulders, knees and hips deform plausibly. Elbow bend toward the camera is hard to judge in this view. Neck/head turn shears the head patch and hair visibly (hard neck weights). Not final.
