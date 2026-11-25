# attempt_V: limited MakeHuman (CC0) face fit test, Karma stage 1
Status: EXPERIMENT. NOT a likeness approval. Face only. No hair, body, clothes or Rig. No reference image used as texture or projection (reference photos were used only to display aligned crops and to place pupils for alignment). No earlier attempt, site file or main was touched. Full head build NOT started; waiting for the user's explicit decision.

## Result in one paragraph
Neutral: the fit reached all 11 front-view targets (by construction, the optimiser was told to hit them), eye loops stay intact, but the front render reads as a broad, older-looking face and is not visibly closer to the reference than Q. Smile: the expression targets pull the mouth to the reference width, but the loops around the nostrils, upper lip and mouth corners fold over each other (see evidence/MH_smile_nose_mouth_wire_LOOP_DISTORTION.png). Per the user's rule this is recorded as a failure of the smile, not smoothed. Overall: partial negative.

## Sources, licence (per file)
MakeHuman commit a8bc2d54ff0ac92e78ff71431b1023eda42bf482, assets only (base mesh, 3 race x female child macro targets averaged 1/3 each, feature targets, 3 expression units x 3 races). 95 files, each header read: all say "released as CC0". List with hashes: CREDITS_and_per_file_license_check.md. Licence text: third_party_MakeHuman_CC0/. Code (AGPL) not used. No other files used.

## Method
1. Base: base.obj + average of african/asian/caucasian female-child macro targets (the "universal" macro files are header-only, so the race files are averaged, as MakeHuman does by default). Race is not a choice about Karma.
2. Landmarks: vertex indices picked once on zoomed wireframe renders of the child base (eye corners, upper/lower lid at eye mid, alae, subnasale, mouth corners, lip top/bottom). Menton = lowest midline vertex within .45 IPD of lip depth.
3. Fit: bounded least squares (weights in [-1,1], the design range of each target, small ridge penalty) over 28 identity targets + 3 expression targets, to 11 reference ratios + a soft jaw-width term. No bound was hit; largest weights: mouth-scale-horiz +0.97, smile-corner-puller +0.90, eye-trans -0.63, head-scale-vert -0.63, cheek-volume -0.49, eye-height2 -0.48, mouth-elevation +0.47.
4. Export: head only, flat colour, GLBs; ratios below re-measured FROM THE EXPORTED GLBs. Both files are MakeHuman meshes cut at the neck; no eyeballs or teeth were added.
5. Q measured from its own GLB: landmarks placed by eye on zoomed orthographic renders of the GLB (evidence/Q_*), not colour limits and not build curves.
Normalisation: every value is divided by the distance between the midpoints of the two eye corners, eye line = mean lid-centre height, both meshes the same way. Camera in the panels: orthographic front, same box and scale (IPD-normalised).

## Numbers (IPD units)
Reference = the earlier 3-photo mean from the automatic landmark detector (U table; original landmark arrays no longer exist). The detector is adult-trained and has its own error, so treat the reference column as approximate. MH columns are the fit targets (not independent). Q column is independent.

| measure | reference | Q (smile) | MH neutral | MH smile |
|---|---|---|---|---|
| eye width (corner to corner) | .447 | .476 (+6.5%) | .445 | .445 |
| eye aperture at eye mid | .1455 | .185 (+27%) | .146 | .146 |
| inner eye gap | .562 | .530 (-5.7%) | .558 | .558 |
| outer eye span | 1.445 | 1.470 (+1.7%) | 1.442 | 1.442 |
| alar width | .676 | not defined: Q render has no alae or nostrils | .676 | .691 |
| eye line to subnasale | .687 | .716 (+4%) | .687 | .683 |
| subnasale to chin | .847 | .752 (-11%) | .847 | .859 |
| eye line to chin | 1.533 | 1.468 (-4%) | 1.533 | 1.541 |
| eye line to mouth centre | .953 | .955 (neutral .924) | .976 | .954 |
| mouth width | .989 (smile only) | .952 (neutral .825) | .837 | .988 |
| outer lip height | .317 (smile) | .319 (neutral .209) | .285 | .317 |

Not comparable to a reference value, shown for contrast only: face width at eye line -.95 IPD (not the jaw-angle landmarks; the detector's jaw-angle width is 1.717): Q 1.571, MH 1.721. Face width at cheek level (eye line -.5): Q 1.70, MH 2.13; the reference has no measured value (hair and jaw occlude it).
Q chin and subnasale come from the side silhouette render by eye (about +-.06); the midline rule does not work on Q (its neck is inside the band), so it was not used there. The MH chin was checked on a side render (evidence/side_neutral_Q_MH.png).

## What this does and does not show
- Eye, nose-width and mouth front ratios are controllable on this mesh in the neutral state with intact loops.
- It does not show likeness. Matching 11 ratios with 31 free weights is expected to succeed; the neutral face still looks broad and mature in the front panel.
- The smile reached its width only with overlapping loops near the nose and lip (the target weights stack: corner puller .90, elevation .47, mouth-scale .97).
- Depth, cheek volume, brow, eye socket and the neutral aperture are not measured (no side photos; photos are smiling).
- Reference landmark values come from an adult-trained detector; Q landmarks are my own placement; MH landmarks are vertex picks. Differences under about .03 IPD are within these errors.
- Q aperture is large mostly because the earlier attempt widened it on purpose.

## Files
karma_face_MH_neutral_FITTEST.glb, karma_face_MH_smile_FITTEST.glb (sizes, tris and sha256 in glb_info.json), MH_measured_from_GLB.json, Q_measured_from_GLB_renders.json, asset_license_check.json, evidence/ (front panels ref|Q|MH smile and Q|MH neutral, wireframes, annotation zooms, side views), src/ (scripts as used; paths point at /tmp working folders, so they need path edits to rerun).
