# attempt_AG_nose_bridge_tip_lip_on_AF
Small third regional pass on the AF GLBs (new folder; AD/AE/AF untouched). Face only, likeness NOT claimed, no hair/body/Rig/final head. Params src/r1.json, code src/sculpt3.py.
Changes: nose bridge narrowed 12% (y -0.55..-0.05), nose tip projection reduced .06 (exported max skin z within |x|<.15: AF .754 -> AG .694-.696), 3 smoothing iters; lower-lip centre fuller (z +.02, down .01), upper-lip centre z +.015.
Measured on exported lip-colour vertices: smile width .968, y -1.201..-0.820; neutral width .872, y -1.222..-0.949 (same definitions as AF).
Checks on these exports: per-triangle vs AF flipped 0, >60 deg turn 0, min area ratio .685/.671, none under .25. Skin self-intersection 0 pairs both states, teeth vs skin 0, eyeball vs skin 1,762 pairs (AF 1,798), contact vs poke-through still unsplit.
Visual: front reads slightly narrower and softer in the nose, still generic against the reference. Side view: lips protrude noticeably (smile lower lip clearly), a known defect, not fixed here; a faint rough patch on the 45-degree cheek remains. Depth and side profile are estimated, no side reference.
