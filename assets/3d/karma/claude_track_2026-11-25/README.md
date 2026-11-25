# claude_track_2026-11-25 (Claude: motion readiness, tests, integration)

New folder only. No Instinct file, GLB, attempt, `js/` file or PR #710 file was changed. No decimation or re-export of any face was done.

## Contents
- `js/KarmaRig.js`, `js/KarmaController.v710.js`: verbatim copies of PR #710 (commit bb272ba7). Do not edit.
- `js/KarmaController.js`: subclass with the three gap fixes (perch follow after `walkTo(top)`, side fallback at screen edges, keep-out rects for text via `setKeepOutRects()` / `getKeepOutRects` option). Public API of #710 unchanged.
- `tests/gapfix.test.mjs`: 14 tests (gaps 1-3 + regression: identical trajectory to #710 on normal layouts + six actions + preemption).
- `tests/face_intake.test.mjs`: 50 tests over every GLB in `face_stage1_2026-11-25` (head-only intake). Per file: loads, vertex-colour-only structure, geometry sanity, +Z orientation, mount-readiness report, flat-colour gate, mobile-budget gate, likeness gate, teeth/neutral contract. Per neutral/smile pair: expression-switch comparison and a mount swap simulation.

## Run
```
npm i three@0.170.0
node --test assets/3d/karma/claude_track_2026-11-25/tests/gapfix.test.mjs
node --test assets/3d/karma/claude_track_2026-11-25/tests/face_intake.test.mjs
# strict gates: KARMA_MOBILE_BUDGET=strict KARMA_REQUIRE_LIKENESS=1 KARMA_REQUIRE_MOUNT_READY=1 KARMA_FLAT_COLOUR=strict
# rig suite with the gap-fix controller: KARMA_GLB=<rig.glb> KARMA_JS_DIR=assets/3d/karma/claude_track_2026-11-25/js node --test assets/3d/karma/integration_tests_2026-11-25/controller_integration.test.mjs
```
A new face drops in automatically (any `.glb` under `face_stage1_2026-11-25`, or `KARMA_FACE_GLBS=a.glb,b.glb`). Expression is read from the file name (`_neutral_` / `_smile_`).

## What passing means
Technical tests passing is NOT likeness approval. The likeness gate stays red until `LIKENESS_APPROVAL.json` bound to the GLB sha256 exists. Attempt C is superseded and not a reference.

## Results 2026-11-25 (three 0.170.0, Node 22)
Gap-fix tests: 14 pass / 0 fail. Face intake, default mode: 50 pass / 0 fail (gates only report). The old rig suite on the baseline rig with the gap-fix controller: 25 pass / 0 fail / 3 todo (the todo bodies are the old narrow wording; `gapfix.test.mjs` supersedes them. Its GAP 2 todo demands staying on the left even at the screen edge, which is physically impossible, so it still reports not ok as a todo).

| Model | Triangles | MB | Mobile budget (<=60k) | Flat-colour route | Neutral/smile pair |
|---|---|---|---|---|---|
| A | 178,832 | 3.41 | FAIL 3.0x | no (26,748 colours) | n/a |
| B | 162,449 | 3.10 | FAIL 2.7x | no (26,099) | n/a |
| C (superseded) | 210,986 | 4.81 | FAIL 3.5x | no (26,736) | n/a |
| D neutral | 181,998 | 3.47 | FAIL 3.0x | yes (6) | pair OK |
| D smile | 197,802 | 3.59 | FAIL 3.3x | yes (6) | pair OK |
| E neutral | 441,018 | 8.43 | FAIL 7.4x | yes (2,833, soft edges) | pair OK |
| E smile | 481,330 | 9.02 | FAIL 8.0x | yes (2,817) | pair OK |

Expression switch (neutral vs smile, nearest-vertex distance, head height = 3.83 units): D changes only in the mid/lower face bands (max about 0.06), forehead/skull exactly 0. E: forehead/skull p99 = 0, upper face has no vertex moved more than 0.1; 0.77% of sampled vertices (mouth/lip bands only) moved more than 0.1, which is the expected mouth change, not tearing. Edge-length spike ratios are within limits for all files.

Mount readiness (all attempts): faces +Z yes; pivot at neck base NO (origin sits on the eye line, bbox y -2.30..1.53); real-world scale NO (3.83 arbitrary units, spec needs about 0.2-0.3 m); back is a flat cut (174 vertices on the back plane). The mount swap test passes only because it normalises scale and pivot inside the test; the files themselves are not mount-ready.

## Honest limits
- The flat-colour gate counts distinct vertex colours. It shows that A, B and C match the pattern of image-derived colour and D/E match authored flat colour. It cannot prove provenance; Instinct/owner confirm.
- Simulated CPU profile is not a phone measurement. 440k+ triangles will need reduction by authoring after likeness approval; nothing was reduced here.
