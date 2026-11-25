# Karma controller placement tests (2026-11-25)

GLB-independent tests of `assets/3d/karma/js/KarmaController.js`. They use a synthetic rig with the 19 canonical bone names, so they run without any character model and do not depend on the face/body being approved.

```
npm i three@0.170.0
node --test assets/3d/karma/controller_tests_2026-11-25/controller_logic.test.mjs
```

## What changed in the controller
The three `todo` GAP tests in `integration_tests_2026-11-25/README.md` are implemented:

1. **Perch-follow.** After `walkTo(card, {side:'top'})` the controller keeps following that card: small drifts smoothly, a move larger than 0.45 x character height by walking over again. Any new `walkTo` / `leanOn` / `stand()` ends it; a removed card clears it. `stateName` stays `'idle'`.
2. **Edge fallback.** Side placement (`walkTo` left/right, `leanOn`) scores the requested side, the other side and the top of the card. A placement that must be pushed back onto the screen is heavily penalised, so a card at the screen edge on a phone puts her on the other side, and a card spanning the whole width puts her on top (no lean then). The requested spot wins ties. The lean pose mirrors with the side she actually stands on.
3. **Keep-out text areas.** `setKeepOutRects(rects)` (static) and the optional constructor option `getKeepOutRects()` (read every frame) give rectangles in the same CSS-px space as the cards. Candidates are scored by overlap with them, so she moves to the other side, the top, or another point along the top edge. Invalid rectangles are ignored.

With no keep-out rectangles and a requested spot that fits, behaviour is identical to PR #710.

## Not covered here
- Real DOM: the tests use rectangles. Wiring `getCardRects` / `getKeepOutRects` to a real story page still has to be done and checked in a browser.
- Real-device performance and anything about likeness (see `integration_tests_2026-11-25`).
- Preference hysteresis beyond "the side she currently uses wins ties".
