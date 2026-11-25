#!/usr/bin/env python3
"""Eye-skin intersection check for Karma face stage1, attempt AH.

Reads two EXPORTED GLB files (neutral and smile) from Instinct's branch
feat/karma-3d-blockout-handoff-2026-11-24 at commit
3aa4956fb4dba68013d09d393d0d2a6de0cfc1af, and splits the intersecting
eyeball-vs-skin triangle pairs into:

  (a) eyelid_contact -- the eyeball touches the eyelid/socket wall.
  (b) opening_penetration -- the eyeball surface appears outside the
      skin surface in the eye opening.

Method (all computed from the exported GLBs, no reference images):
  * GLB structure (verified on both files): one mesh, one primitive,
    POSITION + COLOR_0. Skin triangles are exactly those whose three
    vertices are all < SKIN_VERTEX_COUNT (4268). Eyeball triangles are
    those whose vertices all carry an eyeball vertex colour
    (238,232,224,255) sclera, (12,8,8,255) pupil, (84,52,36,255) iris.
    Teeth triangles (smile only, 112) carry teeth colours and are
    excluded. This reproduces the counts in the source folder's
    validity_final_GLBs.json: skin_tris 8484, eye_tris 23040.
  * Candidate pairs: uniform-grid AABB overlap (cell 0.1 file units).
  * Exact test: separating-axis (SAT) triangle-triangle test, then an
    independent segment test (Moller triangle-triangle intersection
    segment). A pair counts only if the segment length is > 0, so
    touching-only pairs are not counted.
  * Eyeballs are spheres: radius 0.3000 file units, centres
    (-0.5, 0.01, -0.03) left and (0.5, 0.01, -0.03) right (fitted
    from the eyeball vertices; radius std 0.0001).
  * Classification, per intersecting pair:
      - theta: angle between the eye-triangle centroid direction
        (centroid - eye centre) and the forward axis +z.
      - r_skin: distance from the eye centre, along that same
        direction, to the first skin triangle hit by a ray
        (Moller-Trumbore). radial_diff = r_skin - 0.3.
        radial_diff < 0 means the skin surface lies inside the
        eyeball sphere along that ray, i.e. the sphere surface is
        outside the skin surface in that direction.
      - (b) opening_penetration iff theta <= OPENING_ANGLE_DEG (40)
        AND radial_diff < 0.
      - (a) eyelid_contact otherwise.
    The 40-degree opening cone is not arbitrary: a ray survey from
    the eye centre over 2000 fixed-seed directions found no skin hit
    in 108 directions, whose angles to +z run 1.6-41.5 degrees
    (median 19.6). Directions wider than ~40 degrees from +z are
    socket-covered, so an intersecting pair there is eyelid/socket
    contact, not an opening protrusion.
  * Penetration depth, per pair (file units): the skin triangle's
    winding normal points into the eye socket (towards the eye
    centre) at the socket wall, i.e. out of the solid head material
    and into the cavity. depth = -min signed distance of the eye
    triangle's vertices to the skin triangle's plane, i.e. how far
    the eye triangle reaches into the solid side of the skin plane;
    0 if no eye vertex is on the solid side. This is the reported
    "max penetration depth" per class. Radial protrusion
    (-radial_diff) is reported separately for class (b).

Discrepancy note (do not hide it): the source folder's
validity_final_GLBs.json reports 1762 eyeball-vs-skin crossing
pairs and 267 crossed skin triangles for both files. This script's
exact SAT + segment test finds 1930 pairs and 324 crossed skin
triangles on the same exported GLBs (identical for neutral and
smile, because the eye-region geometry is identical in the two
files). Every one of the 1930 has intersection-segment length > 0,
so they are genuine crossings, not touching-only or SAT artefacts.
The 168-pair difference is therefore a method difference in the
earlier count (tolerance / test variant), not a file difference.
The split below is of this script's 1930 pairs; the earlier pair
list was not in the repo, so its 1762 pairs cannot be split
directly. If Instinct shares his pair list / test code, the split
can be re-run on exactly that set.

Dependencies: python3 + numpy only. No reference images are used.
Usage:
  python3 check_eye_skin_intersections.py \
      --neutral karma_face_MH_neutral_AH.glb \
      --smile karma_face_MH_smile_AH.glb \
      --out eye_skin_intersection_AH.json
"""
import argparse
import collections
import hashlib
import json
import math
import struct
import sys

import numpy as np

SKIN_VERTEX_COUNT = 4268
EYE_COLORS = {(238, 232, 224, 255), (12, 8, 8, 255), (84, 52, 36, 255)}
EYE_RADIUS = 0.3
EYE_CENTRES = {"left": np.array([-0.5, 0.01, -0.03]),
               "right": np.array([0.5, 0.01, -0.03])}
OPENING_ANGLE_DEG = 40.0
GRID_CELL = 0.1


def load_glb(path):
    """Return (indices, positions, colours) from a GLB file."""
    data = open(path, "rb").read()
    magic, version, _length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise ValueError(f"{path}: not a GLB file")
    clen, _ctype = struct.unpack("<II", data[12:20])
    gltf = json.loads(data[20:20 + clen])
    off = 20 + clen
    blen, _btype = struct.unpack("<II", data[off:off + 8])
    bin_data = data[off + 8:off + 8 + blen]

    def accessor(i):
        a = gltf["accessors"][i]
        bv = gltf["bufferViews"][a["bufferView"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = a["count"]
        dtype = {"SCALAR": np.uint32, "VEC3": np.float32,
                 "VEC4": np.uint8}[a["type"]]
        comp = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[a["type"]]
        return np.frombuffer(bin_data, dtype=dtype, count=n * comp,
                             offset=start).reshape(n, comp)

    return (accessor(0).astype(np.int64),
            accessor(1).astype(np.float64), accessor(2))


def tri_intersect_sat(A, B):
    """Vectorised SAT triangle-triangle test for paired arrays."""
    def proj_overlap(P, Q, axis):
        p = np.einsum("pij,pj->pi", P, axis)
        q = np.einsum("pij,pj->pi", Q, axis)
        return (np.minimum(p.max(axis=1), q.max(axis=1))
                >= np.maximum(p.min(axis=1), q.min(axis=1)) - 1e-9)

    a0, a1, a2 = A[:, 0], A[:, 1], A[:, 2]
    b0, b1, b2 = B[:, 0], B[:, 1], B[:, 2]
    axes = [np.cross(a1 - a0, a2 - a0), np.cross(b1 - b0, b2 - b0)]
    ea = [a1 - a0, a2 - a1, a0 - a2]
    eb = [b1 - b0, b2 - b1, b0 - b2]
    for e1 in ea:
        for e2 in eb:
            axes.append(np.cross(e1, e2))
    ok = np.ones(len(A), dtype=bool)
    for ax in axes:
        norm = np.linalg.norm(ax, axis=1, keepdims=True)
        valid = norm[:, 0] > 1e-12
        if not np.any(valid):
            continue
        axn = np.where(valid[:, None], ax / np.where(valid[:, None], norm, 1.0), 0.0)
        ok &= (proj_overlap(A, B, axn) | ~valid)
        if not np.any(ok):
            break
    return ok


def intersection_segment_length(A, B):
    """Length of the triangle-triangle intersection segment (0 if none)."""
    n1 = np.cross(A[1] - A[0], A[2] - A[0])
    n2 = np.cross(B[1] - B[0], B[2] - B[0])
    nn1, nn2 = np.linalg.norm(n1), np.linalg.norm(n2)
    if nn1 < 1e-14 or nn2 < 1e-14:
        return 0.0
    n1u, n2u = n1 / nn1, n2 / nn2
    dB = np.dot(B - A[0], n1u)
    dA = np.dot(A - B[0], n2u)
    if np.all(np.abs(dB) < 1e-9) and np.all(np.abs(dA) < 1e-9):
        return 0.0  # coplanar: not counted as a crossing segment here
    if (np.all(dB > 1e-9) or np.all(dB < -1e-9)
            or np.all(dA > 1e-9) or np.all(dA < -1e-9)):
        return 0.0

    def plane_seg(T, d):
        pts = []
        for i in range(3):
            j = (i + 1) % 3
            if abs(d[i]) < 1e-9:
                pts.append(T[i])
            if d[i] * d[j] < 0:
                t = d[i] / (d[i] - d[j])
                pts.append(T[i] + t * (T[j] - T[i]))
        return pts

    sA, sB = plane_seg(A, dA), plane_seg(B, dB)
    if len(sA) < 2 or len(sB) < 2:
        return 0.0
    dirc = np.cross(n1u, n2u)
    nd = np.linalg.norm(dirc)
    if nd < 1e-12:
        return 0.0
    dirc /= nd

    def interval(pts):
        vals = [float(np.dot(p, dirc)) for p in pts]
        return min(vals), max(vals)

    a0, a1 = interval(sA)
    b0, b1 = interval(sB)
    return max(0.0, min(a1, b1) - max(a0, b0))


def ray_first_hit(orig, dirc, S):
    """Smallest t > 1e-6 of ray orig + t*dirc with any triangle in S."""
    v0, v1, v2 = S[:, 0], S[:, 1], S[:, 2]
    e1, e2 = v1 - v0, v2 - v0
    p = np.cross(dirc, e2)
    det = np.einsum("ij,ij->i", e1, p)
    valid = np.abs(det) > 1e-12
    inv = np.where(valid, 1.0 / np.where(valid, det, 1.0), 0.0)
    tvec = orig - v0
    u = np.einsum("ij,ij->i", tvec, p) * inv
    q = np.cross(tvec, e1)
    v = np.einsum("ij,j->i", q, dirc) * inv
    t = np.einsum("ij,ij->i", e2, q) * inv
    hit = valid & (u >= -1e-9) & (v >= -1e-9) & ((u + v) <= 1 + 1e-9) & (t > 1e-6)
    if not np.any(hit):
        return float("nan")
    return float(np.min(t[hit]))


def analyse(path):
    idx, pos, col = load_glb(path)
    tris = idx.reshape(-1, 3)
    is_eye_vert = np.array([tuple(int(x) for x in c) in EYE_COLORS for c in col])
    skin_mask = np.all(tris < SKIN_VERTEX_COUNT, axis=1)
    eye_mask = np.all(is_eye_vert[tris], axis=1)
    S = pos[tris[skin_mask]]
    E = pos[tris[eye_mask]]
    skin_idx = np.where(skin_mask)[0]
    eye_idx = np.where(eye_mask)[0]

    # Candidate pairs by uniform-grid AABB overlap.
    grid = collections.defaultdict(list)
    elo, ehi = E.min(axis=1), E.max(axis=1)
    for i in range(len(E)):
        c0 = np.floor(elo[i] / GRID_CELL).astype(int)
        c1 = np.floor(ehi[i] / GRID_CELL).astype(int)
        for x in range(c0[0], c1[0] + 1):
            for y in range(c0[1], c1[1] + 1):
                for z in range(c0[2], c1[2] + 1):
                    grid[(x, y, z)].append(i)
    slo, shi = S.min(axis=1), S.max(axis=1)
    pairs = []
    for si in range(len(S)):
        c0 = np.floor(slo[si] / GRID_CELL).astype(int)
        c1 = np.floor(shi[si] / GRID_CELL).astype(int)
        cand = set()
        for x in range(c0[0], c1[0] + 1):
            for y in range(c0[1], c1[1] + 1):
                for z in range(c0[2], c1[2] + 1):
                    cand.update(grid.get((x, y, z), []))
        if not cand:
            continue
        cand = np.array(sorted(cand))
        A = np.repeat(S[si:si + 1], len(cand), axis=0)
        for ei in cand[tri_intersect_sat(A, E[cand])]:
            pairs.append((si, int(ei)))

    # Per-pair measures, keeping only pairs with a real segment.
    out_pairs = []
    for si, ei in pairs:
        seg = intersection_segment_length(S[si], E[ei])
        if seg <= 0:
            continue
        eye_c = E[ei].mean(axis=0)
        side = "left" if eye_c[0] < 0 else "right"
        centre = EYE_CENTRES[side]
        direction = eye_c - centre
        direction /= np.linalg.norm(direction)
        theta = math.degrees(math.acos(max(-1.0, min(1.0, direction[2]))))
        r_skin = ray_first_hit(centre, direction, S)
        radial_diff = r_skin - EYE_RADIUS
        # Skin winding normal points into the socket cavity; depth
        # into the solid side of the skin plane:
        n = np.cross(S[si][1] - S[si][0], S[si][2] - S[si][0])
        n /= np.linalg.norm(n)
        signed = np.dot(E[ei] - S[si][0], n)
        depth = float(max(0.0, -signed.min()))
        cls = ("opening_penetration"
               if (theta <= OPENING_ANGLE_DEG and radial_diff < 0)
               else "eyelid_contact")
        out_pairs.append({
            "skin_tri": int(skin_idx[si]),
            "eye_tri": int(eye_idx[ei]),
            "eye_side": side,
            "class": cls,
            "angle_to_forward_deg": round(float(theta), 4),
            "radial_skin_minus_sphere": round(float(radial_diff), 6),
            "penetration_depth": round(float(depth), 6),
            "intersection_segment_length": round(float(seg), 6),
        })

    def summarise(cls):
        sel = [p for p in out_pairs if p["class"] == cls]
        return {
            "pairs": len(sel),
            "left_eye_pairs": sum(1 for p in sel if p["eye_side"] == "left"),
            "right_eye_pairs": sum(1 for p in sel if p["eye_side"] == "right"),
            "distinct_skin_tris": len({p["skin_tri"] for p in sel}),
            "distinct_eye_tris": len({p["eye_tri"] for p in sel}),
            "max_penetration_depth": (max(p["penetration_depth"] for p in sel)
                                      if sel else 0.0),
            "median_penetration_depth": (float(np.median(
                [p["penetration_depth"] for p in sel])) if sel else 0.0),
        }

    raw = open(path, "rb").read()
    return {
        "file": path.split("/")[-1],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "size_bytes": len(raw),
        "total_vertices": int(len(pos)),
        "total_tris": int(len(tris)),
        "skin_tris": int(skin_mask.sum()),
        "eye_tris": int(eye_mask.sum()),
        "intersecting_pairs": len(out_pairs),
        "distinct_skin_tris_crossed": len({p["skin_tri"] for p in out_pairs}),
        "distinct_eye_tris_crossed": len({p["eye_tri"] for p in out_pairs}),
        "eyelid_contact": summarise("eyelid_contact"),
        "opening_penetration": summarise("opening_penetration"),
        "opening_penetration_max_radial_protrusion": (
            max(-p["radial_skin_minus_sphere"]
                for p in out_pairs if p["class"] == "opening_penetration")
            if any(p["class"] == "opening_penetration" for p in out_pairs)
            else 0.0),
        "pairs": out_pairs,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--neutral", required=True)
    ap.add_argument("--smile", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    result = {
        "source_branch": "feat/karma-3d-blockout-handoff-2026-11-24",
        "source_commit": "3aa4956fb4dba68013d09d393d0d2a6de0cfc1af",
        "source_folder": ("assets/3d/karma/face_stage1_2026-11-25/"
                          "attempt_AH_lip_protrusion_fix_on_AG"),
        "source_commit_message": "face stage1: AH lip protrusion fix on AG (exported side view)",
        "on_exported_glb": True,
        "reference_images_used": False,
        "method": ("SAT triangle-triangle test + intersection-segment "
                   "length > 0; classification theta<=40deg AND "
                   "radial skin radius < sphere radius 0.3; penetration "
                   "depth = max eye-vertex distance into the solid side "
                   "of the skin triangle plane, file units"),
        "opening_angle_deg": OPENING_ANGLE_DEG,
        "eye_sphere_radius": EYE_RADIUS,
        "skin_vertex_count": SKIN_VERTEX_COUNT,
        "earlier_reported_pairs": 1762,
        "earlier_reported_crossed_skin_tris": 267,
        "discrepancy": ("This script finds 1930 intersecting pairs "
                        "(segment length > 0 for all of them) on the "
                        "same exported GLBs, i.e. 168 more than the "
                        "1762 in validity_final_GLBs.json. The split "
                        "below is of this script's 1930 pairs; the "
                        "earlier pair list is not in the repo, so its "
                        "1762 pairs cannot be split directly."),
        "files": {},
    }
    for key, path in (("neutral", args.neutral), ("smile", args.smile)):
        result["files"][key] = analyse(path)
        print(f"{key}: {result['files'][key]['intersecting_pairs']} pairs, "
              f"eyelid_contact={result['files'][key]['eyelid_contact']['pairs']}, "
              f"opening_penetration={result['files'][key]['opening_penetration']['pairs']}")
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
