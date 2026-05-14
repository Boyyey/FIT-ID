"""
FitID personalization engine (v1).

Scores every SKU against the *entire* stored profile: measurements, gender, allergies,
fit preferences, posture, scan confidence, and optional parametric avatar scale (3D scan hook).

Different users receive different orderings and explanations. Weights are centralized so they
can later be replaced by sklearn / learned models without changing the API.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from app.data.product_catalog import CATALOG

# Future: load from trained model or config
_WEIGHT_VECTOR = np.array([0.24, 0.20, 0.16, 0.14, 0.12, 0.08, 0.04, 0.02], dtype=np.float64)


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _explain_pct(match: float) -> int:
    """Avoid misleading 0% lines when Gaussian is merely low."""
    return max(22, min(99, int(round(float(match) * 100))))


def _gaussian(value: float, center: float, tolerance: float) -> float:
    if tolerance <= 0.05:
        return 1.0 if abs(value - center) < 1.0 else 0.0
    d = (value - center) / tolerance
    return float(math.exp(-(d * d)))


def _material_blocked(material: str, allergies: list[str], sensitivities: list[str]) -> bool:
    m = material.lower()
    block = {a.lower() for a in (allergies or [])} | {s.lower() for s in (sensitivities or [])}
    # crude token match — extend with synonym map when you add NLP
    for token in block:
        if len(token) >= 3 and token in m:
            return True
        if token in ("cotton", "wool", "polyester", "latex", "nylon", "silk", "denim", "leather"):
            if token in m:
                return True
    return False


def _user_silhouette_pref(prefs: dict[str, Any]) -> dict[str, float]:
    sil = str(prefs.get("silhouette", "regular")).lower()
    out = {"slim": 0.0, "regular": 0.0, "relaxed": 0.0, "oversized": 0.0}
    if sil in out:
        out[sil] = 1.0
    else:
        out["regular"] = 1.0
    return out


def _silhouette_match(user_vec: dict[str, float], product_vec: dict[str, float]) -> float:
    keys = ("slim", "regular", "relaxed", "oversized")
    u = np.array([user_vec.get(k, 0.0) for k in keys])
    p = np.array([product_vec.get(k, 0.0) for k in keys])
    denom = (np.linalg.norm(u) * np.linalg.norm(p)) or 1.0
    return float(np.dot(u, p) / denom)


def _size_label(waist_cm: float) -> str:
    if waist_cm < 72:
        return "XS"
    if waist_cm < 80:
        return "S"
    if waist_cm < 92:
        return "M"
    if waist_cm < 104:
        return "L"
    return "XL"


def _extract_user_vector(profile_row: Any) -> dict[str, Any]:
    bm = profile_row.body_measurements or {}
    prefs = profile_row.fit_preferences or {}
    gender = str(prefs.get("gender", "")).lower()
    if gender not in ("male", "female"):
        gender = "male"

    def _f(key: str, default: float) -> float:
        v = bm.get(key)
        try:
            return float(v) if v is not None else default
        except (TypeError, ValueError):
            return default

    height = _f("height_cm", 170.0)
    weight = _f("weight_kg", 70.0)
    bmi = weight / max((height / 100.0) ** 2, 0.0001)

    avatar = bm.get("avatar_model") or {}
    scale = avatar.get("scale") if isinstance(avatar, dict) else None
    shoulder_scale = 1.0
    if isinstance(scale, dict):
        try:
            shoulder_scale = float(scale.get("shoulders", 1.0))
        except (TypeError, ValueError):
            shoulder_scale = 1.0

    return {
        "email": profile_row.email,
        "gender": gender,
        "waist_cm": _f("waist_cm", 82.0 if gender == "female" else 88.0),
        "chest_cm": _f("chest_cm", 94.0 if gender == "male" else 90.0),
        "hip_cm": _f("hip_cm", 98.0 if gender == "female" else 96.0),
        "inseam_cm": _f("inseam_cm", 78.0 if gender == "male" else 74.0),
        "shoulder_cm": _f("shoulder_width_cm", 44.0 if gender == "male" else 40.0),
        "height_cm": height,
        "weight_kg": weight,
        "bmi": bmi,
        "shoulder_scale": shoulder_scale,
        "posture": (profile_row.posture or "neutral").lower(),
        "skin_tone": profile_row.skin_tone,
        "prefs": prefs,
        "silhouette_user": _user_silhouette_pref(prefs),
        "formality_pref": str(prefs.get("formality", "casual")).lower(),
        "allergies": profile_row.allergies or [],
        "sensitivities": profile_row.sensitivities or [],
        "scan_confidence": float(profile_row.confidence_score or 0.0),
    }


def _category_feature_weights(category: str) -> np.ndarray:
    """Reorder importance of the 8 components per garment class."""
    # order: waist, chest, hip, inseam, silhouette, shoulder_3d, formality, posture
    base = np.array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], dtype=np.float64)
    if category == "pants":
        base *= np.array([1.35, 0.75, 1.1, 1.45, 1.0, 0.9, 0.85, 1.0])
    elif category in ("tshirts", "shirts", "formal"):
        base *= np.array([0.95, 1.35, 0.9, 0.65, 1.15, 1.05, 1.2 if category == "formal" else 1.0, 1.0])
    elif category in ("jackets", "hoodies"):
        base *= np.array([0.9, 1.15, 1.0, 0.85, 1.2, 1.25, 0.95, 1.0])
    return base


def _posture_alignment(posture: str, category: str) -> float:
    if posture in ("forward_head", "rounded", "slouched", "slouch", "slouching"):
        return 0.92 if category in ("jackets", "formal") else 0.88
    if posture in ("arched", "swayback"):
        return 0.9 if category == "pants" else 0.95
    return 1.0


def _formality_match(user_pref: str, product_formality: float) -> float:
    pf = float(product_formality)
    want = 0.85 if user_pref in ("formal", "business") else 0.35 if user_pref in ("casual",) else 0.55
    return _gaussian(pf, want, 0.35)


def personalize_for_profile(
    profile_row: Any,
    *,
    category: str | None = None,
    limit: int = 60,
) -> list[dict[str, Any]]:
    user = _extract_user_vector(profile_row)
    u_gender = user["gender"]
    results: list[tuple[float, dict[str, Any]]] = []

    for product in CATALOG:
        if category and product["category"] != category:
            continue
        p_gender = product["gender"]
        if u_gender and p_gender != u_gender:
            continue
        if _material_blocked(product["material"], user["allergies"], user["sensitivities"]):
            continue

        reasons: list[str] = []

        w_match = _gaussian(user["waist_cm"], product["waist_center_cm"], product["waist_tolerance_cm"])
        reasons.append(f"Waist pattern match {_explain_pct(w_match)}% for this size block")

        c_match = _gaussian(user["chest_cm"], product["chest_center_cm"], product["chest_tolerance_cm"])
        reasons.append(f"Chest / upper block {_explain_pct(c_match)}%")

        h_match = _gaussian(user["hip_cm"], product["hip_center_cm"], product["hip_tolerance_cm"])
        reasons.append(f"Hip compatibility {_explain_pct(h_match)}%")

        cat = product["category"]
        if cat in ("pants", "formal"):
            i_match = _gaussian(user["inseam_cm"], product["inseam_ideal_cm"], product["inseam_tolerance_cm"])
            reasons.append(f"Inseam / leg line {_explain_pct(i_match)}%")
        else:
            i_match = 0.85 + 0.15 * _gaussian(
                user["inseam_cm"], product["inseam_ideal_cm"], product["inseam_tolerance_cm"] * 1.4
            )

        sil_match = _silhouette_match(user["silhouette_user"], product["silhouette_vector"])
        reasons.append(f"Silhouette preference alignment {_explain_pct(sil_match)}%")

        # 3D scan hook: parametric shoulder scale vs garment shoulder target
        shoulder_fit = _gaussian(user["shoulder_scale"], product["shoulder_scale_target"], 0.12)
        reasons.append(f"Shoulder / avatar scale match {_explain_pct(shoulder_fit)}% (3D-ready)")

        formality_fit = _formality_match(user["formality_pref"], product["formality"])
        reasons.append(f"Occasion / formality fit {_explain_pct(formality_fit)}%")

        posture_fit = _posture_alignment(user["posture"], cat)
        reasons.append(f"Posture-aware adjustment applied")

        feats = np.array([w_match, c_match, h_match, i_match, sil_match, shoulder_fit, formality_fit, posture_fit])
        wcat = _category_feature_weights(cat) * _WEIGHT_VECTOR
        wcat = wcat / (wcat.sum() or 1.0)
        raw = float(np.dot(feats, wcat))
        scan_boost = 0.5 + 0.5 * min(1.0, max(0.0, user["scan_confidence"]))
        score = 100.0 * _sigmoid(6.0 * (raw - 0.45)) * scan_boost
        score = max(0.0, min(100.0, score))

        rec_size = _size_label(user["waist_cm"])
        if cat in ("jackets", "hoodies") and user["chest_cm"] > 104:
            order = ["XS", "S", "M", "L", "XL"]
            idx = order.index(rec_size) if rec_size in order else 2
            rec_size = order[max(idx, 3)]

        item_out = {
            "sku": product["sku"],
            "merchant": product["merchant"],
            "brand": product["brand"],
            "title": product["title"],
            "category": product["category"],
            "gender": product["gender"],
            "material": product["material"],
            "fit_profile": product["fit_profile"],
            "color": product["color"],
            "price_aed": product["price_aed"],
            "image_url": product["image_url"],
            "product_url": product["product_url"],
            "personalized_score": round(score, 2),
            "recommended_size": rec_size,
            "reasons": reasons[:6],
            "fit_label": "Strong match" if score >= 82 else "Good match" if score >= 68 else "Explore",
        }
        results.append((score, item_out))

    results.sort(key=lambda x: x[0], reverse=True)
    out: list[dict[str, Any]] = []
    seen_images: set[str] = set()
    for _, row in results:
        img = str(row.get("image_url", ""))
        if img in seen_images:
            continue
        seen_images.add(img)
        out.append(row)
        if len(out) >= limit:
            break
    return out
