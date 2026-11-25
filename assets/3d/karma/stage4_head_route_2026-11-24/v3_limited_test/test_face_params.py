#!/usr/bin/env python3
"""Karma 3D v3 limited face test — Custom Topology, numeric only.

Checks three documented v2 defects, using only the parameters
already in the repo (see params_v3.json and README.md):
  1. mouth too wide: measured 1.00 vs ref 0.95
  2. brows too thick and high
  3. nose too little volume

Stdlib only. No reference photo, no render, no MediaPipe.
This test does NOT prove visual likeness. A render + MediaPipe
check by the team is still required for the mouth prediction.

Usage: python3 test_face_params.py [output.json]
Exit code 0 only if every check passes.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
U = 0.0861
EYE_Y = 0.831


def ey(k):
    return EYE_Y - k * U


def brow_y(offset, t=0.5):
    # v2/build2.py brow curve, with offset as the first constant
    return ey(offset - 0.12 * math.sin(math.pi * t) - 0.10 * t * t)


def main():
    params = json.loads((HERE / "params_v3.json").read_text(encoding="utf-8"))
    v2 = params["v2"]
    v3 = params["v3"]
    cal = params["calibration"]["factor"]

    mouth_geo_v3 = 2.0 * v3["mouth_L_u"]
    mouth_pred = mouth_geo_v3 * cal
    brow_max_v2 = 0.0028 * (0.55 + 0.9)
    brow_max_v3 = brow_max_v2 * v3["brow_thickness_factor"]
    brow_drop_u = (brow_y(v2["brow_offset"]) - brow_y(v3["brow_offset"])) / U
    nose_tip_pct = (v3["nose_tip_h"] - v2["nose_tip_h"]) / v2["nose_tip_h"] * 100.0
    nose_bridge_pct = (v3["nose_bridge_h"] - v2["nose_bridge_h"]) / v2["nose_bridge_h"] * 100.0

    checks = []

    def check(name, ok, actual, expected):
        checks.append({"name": name, "pass": bool(ok), "actual": actual, "expected": expected})
        return bool(ok)

    ok = True
    ok &= check("mouth_geometric_width_reduced",
                mouth_geo_v3 < v2["mouth_geometric_width_u"] and abs(mouth_geo_v3 - 1.02) < 1e-9,
                mouth_geo_v3, 1.02)
    ok &= check("mouth_predicted_rendered_in_target",
                abs(mouth_pred - v3["mouth_target_rendered"]) <= v3["mouth_target_tolerance"],
                round(mouth_pred, 4), "0.95 +/- 0.03")
    ok &= check("brow_thickness_reduced_30pct",
                abs(brow_max_v3 - 0.002842) < 1e-6 and 25.0 <= (1 - v3["brow_thickness_factor"]) * 100 <= 35.0,
                round(brow_max_v3, 6), 0.002842)
    ok &= check("brow_lowered_by_0.05u",
                abs(brow_drop_u - 0.05) < 1e-9,
                round(brow_drop_u, 4), 0.05)
    ok &= check("nose_tip_increased_28.6pct",
                20.0 <= nose_tip_pct <= 35.0,
                round(nose_tip_pct, 1), "20-35%")
    ok &= check("nose_bridge_increased_28.6pct",
                20.0 <= nose_bridge_pct <= 35.0,
                round(nose_bridge_pct, 1), "20-35%")
    ok &= check("no_photo_texture",
                params["out_of_scope"] and "photo texture" in params["out_of_scope"],
                True, True)

    result = {
        "test": params["test"],
        "base": params["base"],
        "pass": bool(ok),
        "values": {
            "mouth_geometric_width_u_v2": v2["mouth_geometric_width_u"],
            "mouth_geometric_width_u_v3": mouth_geo_v3,
            "mouth_predicted_rendered_v3": round(mouth_pred, 4),
            "mouth_target_rendered": v3["mouth_target_rendered"],
            "brow_max_thickness_v2": round(brow_max_v2, 6),
            "brow_max_thickness_v3": round(brow_max_v3, 6),
            "brow_drop_u": round(brow_drop_u, 4),
            "nose_tip_increase_pct": round(nose_tip_pct, 1),
            "nose_bridge_increase_pct": round(nose_bridge_pct, 1),
        },
        "checks": checks,
        "note": "Numeric parameter test only. Does not prove visual likeness; render + MediaPipe verification still required.",
    }

    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "test_face_params_result.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
