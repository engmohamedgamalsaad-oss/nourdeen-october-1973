> **STALE / UNRELIABLE (marked 00:58): every real-browser number in this folder was produced before 00:50 with a harness whose Chrome profile could serve cached JS (karma-stage.js, KarmaMotion.js). Not evidence of the current code. Node-simulation results are unaffected. Current browser evidence: evidence/browser_cache_off_2026-11-26/.**

# test_page.html all-motion run, 2026-11-26 (after the NaN holder fix, commit 58568149)
Baseline fixture only (karma_skinned_baseline_NOT_FINAL.glb, TRELLIS body and its own head). NOT Muse's model, NOT final. Headless Chrome, SwiftShader software GL (not a phone). Stepped simulation clock (`fastForward`), not wall clock.
Command: `KARMA_MOTIONS="Walk,Run,Wave" python3 tests/motion_page.py <repo> <page> <out> desktop|phone` (run in groups; each motion about 10 to 30 s on software GL).
- desktop 1440x900: Idle, Walk, Run, Jump, Wave, Look, Point, Lean, Turn, Lean on card all ran, state returned to idle, visible=true, 0 JS errors (see the result json files, `js_errors`).
- phone 390x844 (mobile emulation): Walk, Run, Jump, Wave, Look, Point, Lean, Turn, Lean on card, same result. She stands in the right gutter beside the card, clear of its text.
- Visual check of the contact sheets: wave, point, turn, jump, look pose changes are visible. The `Lean` (free sideways lean) pose change is small and was not clearly visible in these thumbnails.
- Not covered: walking path avoiding cards, real device, wall-clock timing, Muse model.
