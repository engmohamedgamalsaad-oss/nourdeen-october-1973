# attempt_AJ: lash / lid line ribbon on AI

Stage 1 test only. Not a final head. No likeness approval is claimed.

What changed vs AI (e7fb2264): added a thin dark ribbon along the visible eye opening of each eye (upper thicker and dark, lower thinner and lighter brown). 48 points per eye, taken from a z-buffer outline of eye vs skin in the exported GLB, then placed on the eyeball sphere (r .306) and drawn double-sided. Skin vertices and the original triangles are unchanged (max position change 7e-17, original triangle indices identical). Vertex colour on skin near the opening was also darkened slightly (lash.py).

Counts: smile 16,259 verts / 32,020 tris; neutral 16,172 / 31,908 (AI: 16,067/31,636 and 15,980/31,524).
Checks: validity_final_GLBs.json (hashes, counts, identity vs AI); Muse's checker rerun in eye_skin_intersection_AJ_by_MuseScript.json: opening_penetration 0 (its pair count is 744 here vs 1,160 on AI. I did not investigate why, since skin geometry is identical; the ribbon vertices sit after the skin and eye index range, which may change its classification).
Evidence: evidence/eyes_ref_vs_AI_vs_AJ.png (reference crops, AI, AJ neutral, AJ smile; pupil-aligned crops, visual comparison only).
Known gaps: ribbon is a flat band, not lashes; no lid crease geometry; the outer-corner shape of the opening is still the mesh's own; nose tip, lip contour, ears, brows not done.
