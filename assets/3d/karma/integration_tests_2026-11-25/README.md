# Karma 3D - integration acceptance suite (2026-11-25)

New folder only. No existing file, GLB, or PR #710 file was changed.

## Run
```
npm i three@0.170.0
KARMA_GLB=<model.glb> KARMA_JS_DIR=<dir with KarmaRig.js + KarmaController.js> \
  node --test assets/3d/karma/integration_tests_2026-11-25/controller_integration.test.mjs
```
- `KARMA_JS_DIR` defaults to `../js`. **The suite needs the PR #710 versions of `KarmaRig.js` / `KarmaController.js`** (see results below). Until #710 is merged, point `KARMA_JS_DIR` at the #710 copies.
- `KARMA_MOBILE_BUDGET=strict` makes the mobile-budget gate fail the run. `KARMA_REQUIRE_LIKENESS=1` makes the likeness gate fail the run. Without them both gates only report.
- Pure Node + three.js. No browser, no GPU.

## What it checks (28 tests)
GLB loads through `GLTFLoader` | all 19 agreed bones are real `THREE.Bone` joints in one skeleton | skin weights sum to 1, valid indices, no empty joint | `HeadMount`/`HairMount` are children of `Head`, mounted head + hair follow the Head bone, placeholder hides, missing mount is rejected | deformation of shoulders, elbows, hips, knees (limb moves, no NaN, distant parts stay within 1% of body height) | neck and head carry the head, lower body untouched | the six actions (`walkTo`, `leanOn`, `stand`, `jump`, `wave`, `tilt`) complete | preemption, queueing, card removed mid-walk | card drifts / jumps far / viewport shrinks to phone size | no body overlap with cards when standing beside them | simulated phone CPU profile | **mobile budget gate** | **likeness gate**.
Locality limits are derived from the tested model's own joint positions, so they work for any proportions.

## Measured results (2026-11-25, three 0.170.0, Node 22)
JS = head of `feat/karma-controller-rig-hardening-2026-11-24` (PR #710) as fetched on 2026-11-25.

| Model (shared branch) | Tests | Mobile budget (<=60k tris, tex <=2048) | Likeness |
|---|---|---|---|
| baseline_NOT_FINAL | 25 pass / 0 fail / 3 todo | FAIL: 283,229 tris, 20.4 MB, tex 2048 | not approved |
| weights_v2 experiment | 25 / 0 / 3 | FAIL: same size as baseline | not approved |
| integrated_v1 experiment | 25 / 0 / 3 | FAIL: 445,601 tris, 32.2 MB | not approved |
| integrated_v3 experiment | 25 / 0 / 3 | FAIL: 441,352 tris, 30.3 MB, tex 2048 | not approved |

The suite separates versions: on the **pre-#710** shared-branch JS (baseline GLB) 3 tests FAIL: mount validation is missing, and `stand()` never resolves (so the six-action test and the preemption test fail). On the #710 JS all pass. So #710's fixes are needed, and they work.

Simulated phone profile (Node CPU only: controller + skeleton update): about 0.03 ms/frame on all four models. **This is not a phone measurement.** It excludes GPU skinning, draw calls, texture upload, memory pressure, thermal throttling and the browser compositor. A model with 280k-445k triangles passes this CPU check and is still unsuitable for phones. Only a real device test can decide; none has been run.

## Known gaps (tests marked `todo`; real behavior, not test errors)
1. **After `walkTo(card, {side:'top'})` completes, the anchor is dropped**, so if that card later moves (layout change, resize) Karma stays where she was. `leanOn` does follow moving cards; standing on top does not.
2. **No side fallback near screen edges**: x is clamped to the viewport, so a card close to the screen edge on a phone makes the body overlap the card instead of choosing the other side.
3. **No keep-out API for text** (headings, paragraphs). The controller only knows card rectangles, so it cannot avoid text. Proposed: `setKeepOutRects(rects)` consumed in `_resolve`.
These touch the canonical controller that PR #710 is still changing, so they are NOT patched here; fix them after #710 lands.

## Not covered yet (needs a browser on the real site)
- Karma entering real story pages and her overlap with real text/cards on small and large screens. The tests above use rectangles; they do not read the site's DOM.
- Any real-device performance.
- Visual likeness (see gate below).

## Likeness gate (independent acceptance criterion)
Animation passing never approves the character. To approve, the owner places `LIKENESS_APPROVAL.json` next to the GLB:
```json
{ "sha256": "<sha256 of this exact GLB>", "approvedBy": "<name>", "date": "YYYY-MM-DD", "comparisonEvidence": "<path of the front/three-quarter/side comparison against the reference photos>" }
```
Any change to the GLB changes the hash and voids the approval.
