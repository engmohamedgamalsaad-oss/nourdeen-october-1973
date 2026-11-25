# Karma controller placement tests (2026-11-25)

Unit tests for the placement and state logic of `assets/3d/karma/js/KarmaController.js`. They use a synthetic rig (plain `Object3D` bones) and plain rectangles, so they need no character model and do not depend on the face/body being approved.

```
npm i three@0.170.0
node --test assets/3d/karma/controller_tests_2026-11-25/controller_logic.test.mjs
```

## Test status: written, NOT yet verified
- `controller_logic.test.mjs` is a **new** file with 36 tests, written against the current controller. It is not the earlier 25-test file, which is not in this repository.
- **Not yet run against real `three@0.170.0`, and not run in CI.** There is no workflow for it yet (`karma-3d-check.yml` only syntax-checks the adapter and does not run these tests).
- While the file was being written, all 36 tests were executed once against a small local stand-in for `three` (not the real library) only to debug the test logic. That is not a verification result. Deliberately broken copies of the controller were also used to check that the tests fail when they should; one near-equivalent mutation (dropping the redundant `s.side = tgt.side` line in the lean update) was not caught.
- Update this section with the real result, the three.js version and the run link once the suite has actually run.

## What changed in the controller
The three `todo` GAP tests in `integration_tests_2026-11-25/README.md` are addressed by the controller:

1. **Perch-follow.** After `walkTo(card, {side:'top'})` the controller keeps following that card: small drifts smoothly, a move larger than 0.45 x character height by walking over again. Any new `walkTo` / `leanOn` / `stand()` ends it; a removed card clears it. `stateName` stays `'idle'`.
2. **Edge fallback.** Side placement (`walkTo` left/right, `leanOn`) scores the requested side, the other side and the top of the card. A placement that must be pushed back onto the screen is heavily penalised, so a card at the screen edge puts her on the other side, and a card spanning the whole width puts her on top (no lean then). The requested spot wins ties. The lean pose mirrors with the side she actually stands on.
3. **Keep-out text areas.** `setKeepOutRects(rects)` (static) and the optional constructor option `getKeepOutRects()` (read every frame) give rectangles in the same CSS-px space as the cards. Candidates are scored by overlap with them, so she moves to the other side, the top, or another point along the top edge. Invalid rectangles are ignored.

Whether behaviour is unchanged from PR #710 when no keep-out rectangles are given and the requested spot fits is intended but has not been verified by these tests.

## What the tests cover (36)
- **Basics (6):** start position and scale, walking speed, works without `getKeepOutRects`, bad time steps, `setViewport` clamping, rest rotations preserved.
- **Perch-follow (7):** arrival and perch, small drift followed smoothly, big move re-walks, `along` kept and clamped, `walkTo`/`leanOn`/`stand` end the perch, no following after `stand()`, removed card drops the perch.
- **Edge fallback (7):** both sides fit (requested wins), left edge, right edge, full-width card goes on top, normal lean, lean flipped at the edge with mirrored pose, lean on a full-width card stands on top.
- **Keep-out (8):** no rectangles, covered top spot moves along the card (live and static), all spots equally covered, live rectangles read every frame, covered side spot flips, off-screen is worse than keep-out overlap, invalid and non-array input, non-array from `getKeepOutRects`.
- **State transitions (8):** preemption of a walk and queued actions, `stand()` resolution timing, card missing, queued wave after a walk, wave from idle, jump during lean resumes the lean, lean follows small drift and re-walks on a big move, lean side flips when keep-out text appears.

## Not covered here
- Real DOM: the tests use rectangles. Wiring `getCardRects` / `getKeepOutRects` to a real story page still has to be done and checked in a browser.
- Real-device performance and anything about likeness (see `integration_tests_2026-11-25`).
- Preference hysteresis beyond "the requested spot wins ties".
