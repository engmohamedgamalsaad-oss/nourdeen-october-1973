# Attempt U: ICT FaceKit fit TEST (EXPERIMENT_NOT_FINAL, likeness NOT approved, result: NEGATIVE)
Small fit test only, not a head rebuild. Preserved as evidence. No hair, body, rig.

## Provenance and licence
- Source: https://github.com/USC-ICT/ICT-FaceKit commit da5f95a607f5e6b37755b38d3385d7f2853732e5, MIT licence (copy in third_party_ICT_FaceKit/LICENSE, copyright 2020 USC Institute for Creative Technologies; credits in CREDITS.md).
- Files used, all from the repo's FaceXModel/ (the "Light" model under MIT): generic_neutral_mesh.obj, identity000..099.obj (100 PCA identity targets), expression targets mouthSmile_L/R, cheekRaiser_L/R, eyeSquint_L/R, mouthUpperUp_L/R, mouthStretch_L/R, mouthDimple_L/R, mouthPress_L/R, noseSneer_L/R, mouthLowerDown_L/R, cheekSquint_L/R, jawOpen (jawOpen held at 0, others without weight unused), vertex_indices.json. Nothing from the ICT "Full" model or any other licence. The ICT data files themselves are not copied here; only the derived GLBs and scripts (build from the upstream repo).
- Not verified: consent/provenance of the scan subjects beyond the MIT notice.

## Method
Reference: 478 MediaPipe points from 3 private frontal photos, roll-corrected, IPD units, mean of 3 (68 ICT landmarks mapped to MediaPipe indices by hand, approximate).
Neutral identity: ridge least squares on expression-invariant landmarks only (jaw outline upper, chin, brows, nose, eye corners). Smile: identity held fixed, bounded expression weights (0..1) fitted to all 68 landmarks. Neutral and smile are separate GLBs. Neutral is ESTIMATED: the references are all smiles.
Flat vertex colours, no textures, no photo projection. Parts: face/head/neck, teeth, eyeballs (iris/pupil flat colours on the sclera mesh), lashes.

## Result (see evidence/resid_table.txt, evidence/U_front_matched_reference_Q_ICTfit.png)
Landmark residuals fall vs the generic mesh (invariant landmarks .104 to .068 IPD) but the render looks like an older adult face, heavy brows, dark eye sockets, wide flat mouth. It is visibly further from the reference than Q. Not an improvement.
