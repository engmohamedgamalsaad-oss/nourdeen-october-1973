# Evidence: site hookup on Muse B33b (2026-11-27, ~01:05 EET)

Scope: the owner confirmed the hookup on his authenticated Telegram at 01:04 on 2026-11-27
("continue and link the model"). Branch only; no merge, no deploy, no Supabase edits. The model is
EXPERIMENT_NOT_FINAL and NOT likeness-approved. The bone-name alias it needs is a PROPOSED contract
change (../../CONTRACT_CHANGE_PROPOSAL_B29_ALIAS_2026-11-27.md), posted to Muse; not confirmed yet.

Environment: headless Chrome, software GL (SwiftShader), cache disabled, Node 22, three 0.170.0.
Single runs, not a real device. Screenshots are full-page at normal scale only.

## What was wired
- `khaledoon/assets/karma-stage-loader.js`: stage now starts by default on the pages that include it
  (index.html + the six collection pages), opt-out `?karma=0`. Default model: B33b full build on
  desktop, B33b MOBILE build (1.4 MB) on small/coarse-pointer screens. `?glb=` and
  `window.KARMA_GLB_URL` still override. B29 builds stay in the repo as the fallback.
- `khaledoon/assets/karma-stage.js`: uses KarmaModelAdapter (contract-native GLBs take the verbatim
  rig path unchanged; B29/B33b-shape GLBs get the in-memory alias), passes the measured model height
  (1.838 m) instead of a hard-coded 1, and starts hidden until the first guard pass (startup-race fix:
  a scroll before the first tick could render her mid-screen over text for a fraction of a second;
  seen once in the B29 run, 101.5 px penetration, verified gone in the B33b runs).
- `rig_integration_2026-11-25/js/KarmaModelAdapter.js`: new. Contract files, PR #710 controller and
  claude_track verbatim copies are NOT edited.

## Results on the real B33b GLB
- Node motion suite: 12/14 (`motion_test_B33b.txt`). rig_gaps 22/22 (`rig_gaps_test_B33b.txt`).
  Baseline fixture unchanged: motion 14/14 (`motion_test_baseline_fixture.txt`), regression_guards
  3/3 (`regression_guards_test_baseline.txt`).
- Browser, real index.html (`index_html/browser_stage_result_all.json`):
  desktop 1440x900: 27 samples, one full visit (walk, wave, lean), 0 JS errors, 0 card overlap,
  0 card-content penetration, 0 outside-text penetration while visible, in view after arrival.
  phone 390x844 touch: waits off-screen at scroll 0 (known gap 1), walks in after scroll, the guard
  hides her for 5 samples when the target turns bad, then re-seats; 0 overlap while visible.
  bad-GLB variant: canvas removed, page intact (8 gate cards).
- Browser, collection page history.html (`collection_history_html/`): page intact, 0 JS errors,
  0 overlap, she idles in the gutter. CAVEAT: the page's story cards failed to load in the sandbox
  ("could not load the stories now" - the dynamic fetch failed), so collection pages with real cards
  are still UNVALIDATED (pre-existing known gap 5 stands).

## Known defects (honest list)
Model (from the geometry owner): dark band on the viewer-right cheek near the jaw (side view);
faceted brown patches behind/under the ears; white slivers by the left ear; flat-colour ears;
painted teeth with constant jaw; mid-blink lid disc 0.3-0.6; no lashes in master; pigtail is a flat
rectangle.
Integration:
1. motion test 3 fails on B29/B33b (run-vs-walk elbow pose delta too small): the controller's pose
   assumptions were tuned on the 1 m baseline's bone rest axes. Cosmetic, run still reads as a run.
2. motion test 14 fails on B29/B33b: the lean hand lands about 30 px short of the card edge
   (proportions differ from the baseline). Cosmetic; the guard still prevents any content overlap.
3. Phone at scroll 0 has no text-free spot; she stays off-screen until a card scrolls in
   (pre-existing known gap 1).
4. Phone ends parked off-screen in some scroll positions (in_view_after_arrival=false).
5. Collection pages with real cards unvalidated (fetch failed in the sandbox).
6. eyeBlink_L/R morphs exist on the model but no code drives them (no blink yet).
7. Real-device performance unmeasured (software GL only); the 10 MB desktop GLB needs a real-network
   load check before any deploy talk.
8. Texture pixel sizes could not be measured in Node (decoder stub); contract's 2048 px cap unverified.
