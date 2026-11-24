# Karma 3D — Phase 1 code review (2026-11-24)

**Scope:** code review of `assets/3d/karma/js/KarmaRig.js` and `KarmaController.js` at commit `be409f3`.
**Method:** static reading only. **Nothing was executed.** No GLB was loaded, no Three.js was installed or run, no test passed or failed.
**Changed files:** none. This report is the only addition.

## 1. State of the shared branch (verified by reading GitHub)

| Item | Status |
|---|---|
| `docs/3d/KARMA_3D_HANDOFF.md` | present |
| `assets/3d/karma/prototype/karma_body_blockout_A_pose.glb.gz` (+ README) | present, old blockout, no skin |
| `assets/3d/karma/js/KarmaRig.js`, `KarmaController.js` | present, untested |
| Instinct's trial GLB (~21 MB, reported) | **not on the branch**; no Instinct branch found in the first ~250 branch names listed (list is long and alphabetical, so this is not an exhaustive search) |
| `scripts/3d/`, `tests/3d/`, previews, `KARMA_BODY_RIG_README.md` | **do not exist** (mentioned only in the first Claude's log) |
| Gemini `KARMA_VISUAL_SPEC.md` (full text) | not received |

Comparison with the first Claude's log, by manual reading (not byte-diffed): `KarmaRig.js` matches; `KarmaController.js` differs only by an added `STATUS: ... UNTESTED` comment line.

## 2. Findings (hypotheses to confirm against the real GLB — none confirmed yet)

### F1 — High: rest rotation assumed to be identity (likely candidate for the reported motion failure)
`_blend()` slerps **every** bone toward either its target Euler pose or `IDENTITY` each frame. This only works if all 19 bones have identity rotation in the GLB's rest pose (the file header says so).
If Instinct's GLB has non-identity local rotations on the bones (common when re-linking an older model or exporting from a DCC tool), the controller will force them to identity and the pose will collapse or twist, even though weights and IBMs are valid.
- **Check:** read the `rotation` of the 19 bone nodes in the GLB.
- **Minimal fix (not applied):** cache each bone's rest quaternion in the constructor and blend toward `rest × delta` instead of `delta`/identity. Roughly 5 lines, no rewrite.

### F2 — High: `createRig` checks names, not skin membership
It finds bones with `getObjectByName`, so 19 matching nodes pass even if they are not joints of the `SkinnedMesh`. That is exactly the "names are not proof" risk.
- **Check:** every name in `BONES` must be in `skinned[i].skeleton.bones`.
- `headMount` / `hairMount` are not validated; `attachHead` throws a bare `TypeError` if they are missing.
- **Minimal fix (not applied):** add the skeleton-membership check and explicit errors for missing mounts.

### F3 — Medium: scale and origin assumptions
The controller assumes model height 1.0 (`modelHeight = 1`), origin at the soles, facing +Z, Karma's left = +X. A 21 MB model may use other units, a different origin, or an exporter armature scale.
- **Check:** compute the bounding box of the loaded scene.
- **Minimal fix (not applied):** auto-measure height from `Box3` instead of trusting the constant.

### F4 — Medium: axis/sign conventions depend on F1
By reading, the signs are internally consistent for a rig whose bone axes are world-aligned: X rotation = forward/back swing (positive = backward), Z rotation = side raise (positive raises the left arm, negative the right), knees bend with positive X on `LowerLeg`, contralateral arm/leg swing in walk. This was derived on paper, **not verified in a render**. It becomes invalid if bones have rest rotation or roll.

### F5 — Low: logic details
- `stand()` returns a promise that never resolves unless later preempted.
- `jump()` / `wave()` / `tilt()` called while walking are queued until the walk ends (may or may not be intended).
- `setCharacterHeight()` does not re-clamp the position; `_reanchor()` is a no-op.
- Unused leftovers: `D2R`, `this.pose`, `cmd._p`, the `snap` argument of `_syncHolder`.

### F6 — Info: project integration gaps
- `KarmaRig.js` refers to `docs/3d/KARMA_BODY_RIG_README.md` (missing) and needs an import map for `three` and `three/addons/`. No Three.js version or import map is defined for Karma anywhere on the branch.
- No existing Three.js Karma implementation was found in the repo by code search (search may not be exhaustive).
- The reported 21 MB size is ~170× larger than the first Claude's logged body (~123 KB). This suggests embedded textures or heavy geometry and matters for phones; must be explained when the file arrives.

## 3. Test status (honest)

| Test | Status |
|---|---|
| Load GLB with `GLTFLoader` | not run (no GLB) |
| walkTo / leanOn / stand / jump / wave / tilt | not run |
| Neck / shoulders / arms / knees deformation | not run |
| Browser visual test, small phone viewport | not run |
| Controller logic with a stub rig (no GLB) | not run |

## 4. Blocked on

1. Instinct's original GLB (branch + path + SHA-256) — to be stored unmodified, in a new path, before any inspection.
2. Instinct's exact motion-failure message and which controller file version it used.
3. Gemini's full visual spec and the approved face/hair, before the integration phase.
