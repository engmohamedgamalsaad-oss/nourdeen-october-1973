# Evidence: site hookup on Muse B33b (2026-11-27, ~01:05 EET)

Scope: the owner confirmed the hookup on his authenticated Telegram at 01:04 on 2026-11-27
("continue and link the model"). Branch only; no merge, no deploy, no Supabase edits. The model is
EXPERIMENT_NOT_FINAL and NOT likeness-approved. The bone-name alias it needs is recorded as ACCEPTED by Muse
on 2026-11-27 (../../CONTRACT_CHANGE_PROPOSAL_B29_ALIAS_2026-11-27.md).

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
- Browser, collection page history.html WITH REAL CARDS (`collection_history_html/`): the page
  hard-codes its asset root to the GitHub Pages project path (`/nourdeen-october-1973/`), so the
  first sandbox run served at `/` could not load the cards. Re-served under that path prefix (symlink;
  the page itself unchanged), the real card grid rendered and: desktop 28 samples, TWO visits
  (walk, wave, lean), 0 JS errors, 0 visible overlap, 0 card contact, 0 content/text penetration;
  phone 29 samples, 1 visit, 0 overlap while visible, guard hid her 5 samples. Verified visually:
  she stands in the right gutter beside the real cards (desktop_good_21s.png).
- Blink (`blink_desktop/`): the stage now drives the model's eyeBlink_L/R morph targets (both eyes,
  ~70 ms close / 120 ms open, every 2-5.5 s; no-op on models without those morphs). Desktop run:
  `state_extra.blinks = 8`, 0 JS errors, 0 overlap, 0 text penetration. The harness records the blink
  counter in `state_extra` (one-line addition to browser_stage.py).

## Known defects (honest list)
Model (from the geometry owner): dark band on the viewer-right cheek near the jaw (side view);
faceted brown patches behind/under the ears; white slivers by the left ear; flat-colour ears;
painted teeth with constant jaw; mid-blink lid disc 0.3-0.6; no lashes in master; pigtail is a flat
rectangle.
Integration:
1. motion test 3 fails on B29/B33b (run-vs-walk elbow pose delta too small): the controller's pose
   deltas live in the verbatim PR #710 controller and assume the baseline's bone rest axes (B29/B33b
   bones use Mixamo local axes). A correct fix needs per-skeleton axis normalization; judged NOT
   low-risk for this pass, so deferred. Cosmetic: run still reads as a run in the page screenshots.
2. motion test 14 fails on B29/B33b: the lean hand lands about 30 px short of the card edge (same
   verbatim-controller layer, proportions differ). Deferred for the same reason; the guard still
   prevents any content overlap (0 px card contact in every browser run).
3. Phone at scroll 0 has no text-free spot; she stays off-screen until a card scrolls in
   (pre-existing known gap 1).
4. Phone ends parked off-screen in some scroll positions (in_view_after_arrival=false).
5. The collection page hard-codes the GitHub Pages project path as its asset root; sandbox runs
   must serve the repo under `/nourdeen-october-1973/` or the cards never load (page issue, not
   a Karma issue; unchanged, works on the real site).
6. Real-device performance unmeasured (software GL only); the 10 MB desktop GLB needs a real-network
   load check before any deploy talk.
7. Texture pixel sizes could not be measured in Node (decoder stub); contract's 2048 px cap unverified.
