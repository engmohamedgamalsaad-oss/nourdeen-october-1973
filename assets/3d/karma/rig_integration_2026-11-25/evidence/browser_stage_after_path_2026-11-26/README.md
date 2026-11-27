> **STALE / UNRELIABLE (marked 00:58): every real-browser number in this folder was produced before 00:50 with a harness whose Chrome profile could serve cached JS (karma-stage.js, KarmaMotion.js). Not evidence of the current code. Node-simulation results are unaffected. Current browser evidence: evidence/browser_cache_off_2026-11-26/.**

# browser_stage.py on the real index.html after the card-path change (commit 5056d82e + evidence)
Baseline fixture only (NOT FINAL, not Muse). Headless Chrome, SwiftShader software GL, real wall clock, one run per viewport, 19 to 21 samples each. Not a device.
- desktop 1440x900: states idle/walk/wave, max_VISIBLE_overlap 0, samples_overlapping_while_walking 1 (README before the change: 3 of about 27), max_overlap_all_states 3, in view after arrival, 1 visit, 0 JS errors, bad-GLB URL leaves the page intact.
- phone 390x844: max_VISIBLE_overlap 0, samples_overlapping_while_walking 0 (before: 3 of about 26), 6 of 21 samples hidden (off-screen entry, known), in view after arrival, 0 JS errors.
- The montages show the page at scroll 0: on the phone she is NOT visible in any of the 5 frames (known gap: no entry at scroll 0); on desktop she is visible only in the last frame at the right edge. These screenshots do NOT show her beside a card. The stage only brings her to a card after the cards scroll into view.
- Residual overlap of 2 to 3 (max_overlap_all_states / while_stationary) is unexplained here, single runs.
