# Eye-skin intersection check — attempt AH (exported GLBs)

Branch: `muse/karma-custom-topology-face-test-2026-11-25` (this branch only;
Instinct's branch and `main` were not touched, nothing was merged).

Source (read-only, copied from the public repo, not modified):
- Branch: `feat/karma-3d-blockout-handoff-2026-11-24`
- Commit: `3aa4956fb4dba68013d09d393d0d2a6de0cfc1af`
  ("face stage1: AH lip protrusion fix on AG (exported side view)")
- Folder: `assets/3d/karma/face_stage1_2026-11-25/attempt_AH_lip_protrusion_fix_on_AG`
- Files: `karma_face_MH_neutral_AH.glb` (634,876 bytes,
  sha256 `5f3cc1580f02e04f8ac8551b5929f7dd911a338c3eec1afa4275001baa7081db`)
  and `karma_face_MH_smile_AH.glb` (637,612 bytes,
  sha256 `b2a1860a038eee9eb50d98717afb028f223c914fb04d51645abdbd4387ce9d1a`)

Result is on the exported GLBs. No reference images were used.

## Result (identical for neutral and smile)

The eye-region geometry is identical in the two files (only the lips
differ), so the counts are identical for both.

| class | pairs | left eye | right eye | max penetration depth (file units) | median depth |
|---|---|---|---|---|---|
| (a) eyelid contact | 1,747 | 872 | 875 | 0.012792 | 0.001674 |
| (b) opening penetration | 183 | 98 | 85 | 0.013566 | 0.006931 |
| **total intersecting pairs** | **1,930** | 970 | 960 | — | — |

Class (b) also has max radial protrusion 0.013166 file units
(sphere surface outside the skin surface along the ray from the eye
centre). Distinct skin triangles crossed: 324 in total (321 in (a) and
43 in (b); the sums exceed 324 because a few skin triangles carry
pairs of both classes). Distinct eye triangles crossed: 1,516.

## Classification rule (documented, in the script)

- Eyeballs are spheres, radius 0.3000, centres (−0.5, 0.01, −0.03)
  and (0.5, 0.01, −0.03), fitted from the eyeball vertices.
- (b) opening_penetration iff the eye-triangle centroid direction
  from the eye centre is within 40° of the forward axis (+z) AND
  the first skin triangle hit by a ray from the eye centre in that
  direction lies inside the sphere (skin radius < 0.3), i.e. the
  sphere surface is outside the skin surface in the eye opening.
- (a) eyelid_contact is every other intersecting pair.
- The 40° cone comes from a ray survey: 2,000 fixed-seed directions
  from the eye centre, 108 with no skin hit, angles to +z 1.6–41.5°
  (median 19.6°). Directions wider than ~40° are socket-covered.
- Penetration depth per pair: how far an eye-triangle vertex lies on
  the solid side of the intersecting skin triangle's plane (skin
  winding normal points into the socket cavity). File units.

## Discrepancy with the earlier count — do not ignore

`validity_final_GLBs.json` in the source folder reports 1,762
eyeball-vs-skin crossing pairs and 267 crossed skin triangles.
This script's exact SAT test plus intersection-segment test
(segment length > 0 for all 1,930 pairs) finds 1,930 pairs and
324 crossed skin triangles on the same exported GLBs. The 168-pair
difference is a method difference in the earlier count, not a file
difference, and the earlier pair list is not in the repo, so its
1,762 pairs cannot be split directly. The split above is of this
script's 1,930 pairs. If Instinct shares his pair list or test code,
the split can be re-run on exactly that set.

This is a geometric validity check only. It is not a likeness
approval, and no face, nose or mouth edit was applied to AG/AH.

## Files

- `check_eye_skin_intersections.py` — the check (python3 + numpy).
- `eye_skin_intersection_AH.json` — full result, including every
  intersecting pair with its class, angle, radial difference,
  penetration depth and segment length.

## Re-run

Copy the two GLBs from Instinct's branch at commit
`3aa4956fb4dba68013d09d393d0d2a6de0cfc1af` into a folder, then:

```
python3 check_eye_skin_intersections.py \
    --neutral karma_face_MH_neutral_AH.glb \
    --smile karma_face_MH_smile_AH.glb \
    --out eye_skin_intersection_AH.json
```
