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

## Status update 2026-11-26 01:35 (supersedes the numbers and the gap list below where they conflict)
All real-browser numbers in this README and in evidence/ older than `evidence/browser_cache_off_2026-11-26/` are STALE/UNRELIABLE (the test browser could serve cached JS). Current browser evidence is only in that folder (cache disabled, loaded-JS hashes of the served bytes recorded in each result JSON). Baseline fixture only, NOT FINAL, software-GL headless Chrome, one run per case, not a device.

Done since: walks and runs route around cards (node, every 1/60 s frame; fuzz 34 scenarios, 0 crossings, 0 ending in another card); no route or no clear standing spot means she holds with a precise reason ('no-route' / 'no-clear-placement') instead of crossing; lean relocation is a re-walk; layout/resize changes re-plan; keep-out is every visible heading, paragraph, link, button, tag and list item outside the cards; the cover guard uses an animated per-bone footprint (an approximation of the rendered mesh, within 0 to 4 px of a per-vertex Box3 in the logged runs, conservative; one-time build cost over the vertices not measured, device cost not measured); a scroll re-test redraws at once so a stale frame does not show her over new text; re-seat after the page scrolls.
Tests: rig_gaps 22/22, motion 14/14, regression_guards 3/3, shared suite on KarmaMotion 28 tests, 25 pass, 0 fail, 3 todo (#24 prints not ok TODO; the shared test only accepts the left side). The shared suite semantics changed only by the safety rules, backed by rig_gaps overlapping and non-overlapping fixtures; not claimed as an unchanged-green result.
Browser (cache off): phone and desktop runs show no visible overlap with text, links or card content; phone lean touches the card edge by up to 5 px (card contact only, 0 px into card content or outside text). Real-time (no stepped clock) runs: phone about 5.6 fps and desktop about 1.7 fps in software GL, 65 to 82 s wall each, one run each; they say nothing about a real device.

## Known gaps (current)
1. Phone at scroll 0: no text-free spot for her, she stays off-screen until a card scrolls in. Fixing it needs a layout change or a smaller character; deliberately NOT done.
2. Perch on top of a card still covers the row above in some grids; no visual pass with the real model.
3. Residual card-edge contact while leaning (up to about 5 px), by design for the hand contact.
4. Real device performance unknown; only headless software-GL timing. Bone-footprint cost on device and its one-time build cost unmeasured.
5. Collection pages not wired/validated; older collection_* evidence is stale.
6. Muse contract unconfirmed; the 283k-triangle baseline is far above the 60k gate (model matter).
7. Skin weights/face deformation of Muse's mesh untested until a Muse GLB exists.
8. Run-to-run variation exists (single runs); the repeat count is small.

## (historical, stale) status as first written
## Known gaps (not fixed yet)
1. While **walking** she crosses cards (3 of ~27 samples overlap on desktop, 3 of ~26 on phone). The walk path is a straight line. Needs path planning around card rects.
2. She perches on top of a card (sideFor falls back to `top` when there is no free side). On a card grid this can cover the row above. Needs a visual pass with the real model.
3. Text keep-out uses coarse selectors (`h1, h2, .lead, .eyebrow, .head p`); not verified against every language/layout.
4. Phone performance: only software-GL frame pacing was observed; no real device measurement.
5. Pages other than `index.html` (collection pages with dynamic story cards) are not wired yet; `.story-card, [data-story-card]` selectors are placeholders.
6. Contract is a proposal. Muse has not confirmed it (see PR/branch notes).
7. The 283k-triangle baseline is far above the 60k mobile gate; that is a model matter, not solved here.
8. Skin weights, deformation of Muse's mesh, face distortion under motion: untested until a Muse GLB exists.

## Status update 2026-11-27 01:05 (B33b site hookup; supersedes "not tested on Muse's model" above)
The owner confirmed the hookup on his authenticated Telegram at 01:04 on 2026-11-27. The stage is now
wired ON by default (opt-out `?karma=0`) on the pages carrying the loader, defaulting to the Muse B33b
model (full build desktop, MOBILE build on small screens; B29 fallback via `?glb=`). B33b needs the
PROPOSED bone-name alias (CONTRACT_CHANGE_PROPOSAL_B29_ALIAS_2026-11-27.md, posted to Muse, not yet
confirmed) plus measured model height and a startup-visibility fix, all in
`js/KarmaModelAdapter.js` + `karma-stage.js`; contract files and the PR #710 code are untouched.
Results and the honest defect list: `evidence/muse_B33b_2026-11-27/README.md`. Headline: node motion
12/14 on B33b (two cosmetic proportion failures, listed), rig_gaps 22/22, baseline fixture still
14/14; real-page browser runs show 0 overlap and 0 text penetration while visible on desktop and
phone. NOT likeness-approved, NOT merged, NOT deployed.
