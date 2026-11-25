# attempt_AH_lip_protrusion_fix_on_AG
Side-profile fix on the AG GLBs (new folder; AD..AG untouched). Face only, likeness NOT claimed. Params src/s1.json, code src/sculpt4.py.
Why: in the exported side view (AD..AG) the lips jut forward, most visibly the smile lower lip.
Change: lip/mouth zone pulled back .07 in z (Gaussian, x sigma .7, y centre -1.02), chin forward .03 to keep the lip-chin transition, 3 light smoothing iterations. Teeth strip moves with the zone.
Exported-GLB measure (skin z, IPD units): lip max z smile .654 -> .622, neutral .670 -> .595; nose max z (|x|<.15) unchanged .694/.696. Lip width smile .966, neutral .869 (AG .968/.872).
Checks on these exports: per-triangle vs AG flipped 0, >60 deg 0, min area ratio .638 smile / .564 neutral, none under .25. Skin self-intersection 0 both states, teeth vs skin 0, eyeball vs skin 1,762 pairs (same as AG, not split).
Visual: side view inspected, lips sit closer to the nose-chin line; no side reference exists, so the depth is a judgment, not a measured match. Faint rough patch on the 45 deg cheek (from earlier passes) is still there.
