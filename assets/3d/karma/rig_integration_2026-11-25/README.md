# Karma rig + motion + page integration (Instinct), 2026-11-25

Branch: `instinct/karma-rig-animation-integration`. Not merged, no main change, no Supabase, no deploy. The only existing page file touched is `index.html` (one opt-in `<script>` tag, inert unless the URL has `?karma=1`).

## Status in one paragraph
Motion controller v2 (all ten motions) and the stage module are implemented and tested in Node (12 tests) and in headless Chrome on the real `index.html` at desktop and phone size. Everything was run on the baseline rig fixture (`baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb`, 19 joints, rough face). **Nothing has been tested on Muse's model yet: it does not exist in a testable form.** Final integration is not claimed.

## Files
- `INTERFACE_CONTRACT.md`: v0.1 proposal for Muse (GLB path, 19 bones, motion names, axes, pivot, neutral pose, three 0.170.0).
- `js/KarmaMotion.js`: idle (breathing, inherited), walk, run, jump, wave, look, point, lean, turn, leanOn. Extends `claude_track_2026-11-25/js/KarmaController.js` (PR #710 + gap fixes). Conflict policy documented at the top of the file.
- `tests/motion.test.mjs`: 12 tests (motion API, run faster than walk, look/point/turn/lean directions and return, preemption, serial actions + queue limit 3, look replacement, bounded joint angles).
- `tests/browser_stage.py`: real-browser test (CDP, software GL) of the page; checks overlap with `.gate` cards, in-view, bad-GLB fallback, JS errors.
- `../../../khaledoon/assets/karma-stage.js`, `karma-stage-loader.js`: the stage (transparent fixed canvas, orthographic, CSS-pixel world). Enters from the right, runs to a card, looks, points, waves, leans, returns to idle; follows scroll/resize; mobile: pixel ratio capped 1.5, 30 fps, smaller character. A load/WebGL failure removes the canvas and leaves the page as is.
- `evidence/`: results and two screenshots.

## Run
```
npm i three@0.170.0
KARMA_GLB=<glb> node --test assets/3d/karma/rig_integration_2026-11-25/tests/motion.test.mjs
python3 -m http.server   # or any static server, then open  index.html?karma=1&glb=/path/to/karma.glb
KARMA_ONLY=desktop python3 assets/3d/karma/rig_integration_2026-11-25/tests/browser_stage.py <repo> <glb relative path> <out_dir>   # needs Chrome + python websocket-client
```
For a local three.js set `window.KARMA_THREE_BASE` before the loader (the browser test does).

## Results on the baseline fixture (not Muse's model)
- Node motion tests: 12/12 pass (`evidence/motion_test_result_baseline_fixture.txt`).
- Browser, real `index.html`, desktop 1440x900 and phone 390x844 (touch): GLB loads, character enters and completes one visit (run, look, point, wave, idle), zero JS errors, always inside the viewport after arrival, **0 card overlaps while standing**, bad GLB URL: canvas removed, page intact (8 `.gate` cards still present).
- Screenshots: `evidence/desktop_stage_21s.png`, `evidence/phone_stage_14s.png`.

## Known gaps (not fixed yet)
1. While **walking** she crosses cards (3 of ~27 samples overlap on desktop, 3 of ~26 on phone). The walk path is a straight line. Needs path planning around card rects.
2. She perches on top of a card (sideFor falls back to `top` when there is no free side). On a card grid this can cover the row above. Needs a visual pass with the real model.
3. Text keep-out uses coarse selectors (`h1, h2, .lead, .eyebrow, .head p`); not verified against every language/layout.
4. Phone performance: only software-GL frame pacing was observed; no real device measurement.
5. Pages other than `index.html` (collection pages with dynamic story cards) are not wired yet; `.story-card, [data-story-card]` selectors are placeholders.
6. Contract is a proposal. Muse has not confirmed it (see PR/branch notes).
7. The 283k-triangle baseline is far above the 60k mobile gate; that is a model matter, not solved here.
8. Skin weights, deformation of Muse's mesh, face distortion under motion: untested until a Muse GLB exists.
