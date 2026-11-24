# Controller test result: harness failure, not a proven model bug

Script: `test_skin_anim.mjs` (Node 22, three 0.187.0, `KarmaController.node-test-adapter.js`). The skin/joint/IBM/weights/createRig part of the same run is valid. The `controller` section is not.

No exception was thrown and no error message exists for it: the script completed and wrote numbers. The numbers are wrong because of how the script reads them:
- `walkReached: false` while `pos = [475, 260]`: the controller did arrive at the target (card b: left 400 + 0.5 x width 150 = 475, top 260). The script read the `completed` flag synchronously after stepping frames, before the promise `.then` callback had run, so it saw its initial `false`.
- `waveHandRaisePx: 11845`: the script multiplied a world-space hand height (already scaled by the controller holder, scale 170) by the scale a second time, so the value is meaningless.
- `leanBox` (z from -9.9 to 19, y up to 169.7): bounding box sampled every 40th vertex under the 170x holder scale, with mixed units in the comparison; not interpreted.
- `jumpRisePx: 51` and `state: lean`, `leanSpineZ: 0.137` were produced but have no valid reference check.
Conclusion: no valid animation test of this GLB exists yet. The controller has not been shown to work or to fail on the model. A browser render of real states is still needed.
