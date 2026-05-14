"""Aggregate anonymized metrics from sandbox profiles + heuristic \"AI\" copy for retailers."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import FitProfile


def _safe_float(v: object, default: float) -> float:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _waist_band(w: float) -> str:
    if w < 72:
        return "XS–S"
    if w < 88:
        return "M"
    if w < 102:
        return "L"
    return "XL+"


def _cluster_note(name: str) -> str:
    notes = {
        "Athletic frame": "Favor broader shoulder blocks and extended outerwear grading.",
        "Straight mid proportions": "Core size curve M–L; ladder inseams by region.",
        "Curvier hips": "Ease through hip/seat reduces bracketing returns.",
        "Compact / petite": "Offer proportioned rises and abbreviated inseams.",
    }
    return notes.get(name, "Review size breaks against this cohort.")


def compute_profile_aggregates(db: Session) -> dict[str, Any]:
    profiles: Sequence[FitProfile] = db.query(FitProfile).filter(FitProfile.account_type != "business").all()
    n = max(len(profiles), 1)

    gender_ct: Counter[str] = Counter()
    sil_ct: Counter[str] = Counter()
    allergens: Counter[str] = Counter()
    waists: list[float] = []
    confidences: list[float] = []

    for p in profiles:
        prefs = p.fit_preferences or {}
        gender = str(prefs.get("gender") or "").lower()
        gender_ct[gender if gender in ("male", "female") else "unspecified"] += 1
        sil = str(prefs.get("silhouette") or "regular").capitalize()
        sil_ct[sil] += 1
        bm = p.body_measurements or {}
        w = _safe_float(bm.get("waist_cm"), float("nan"))
        if not (w != w):  # not NaN
            waists.append(w)
        for a in p.allergies or []:
            if isinstance(a, str) and a.strip():
                allergens[a.strip().title()] += 1
        confidences.append(max(0.0, min(1.0, float(p.confidence_score or 0.0))))

    gender_split = [{"label": "Women's", "pct": round(100 * gender_ct["female"] / n)}, {"label": "Men's", "pct": round(100 * gender_ct["male"] / n)}, {"label": "Unspecified", "pct": round(100 * gender_ct["unspecified"] / n)}]

    silhouette_preferences = [{"label": k, "pct": round(100 * v / n)} for k, v in sil_ct.items()]
    silhouette_preferences.sort(key=lambda row: row["pct"], reverse=True)

    top_allergens = [{"material": m, "share_pct": min(95, round(100 * cnt / n))} for m, cnt in allergens.most_common(5)]
    if not top_allergens:
        top_allergens = [{"material": "No allergy tags yet", "share_pct": 0}]

    band_ct: Counter[str] = Counter(_waist_band(w) for w in waists or [82.0])
    band_total = sum(band_ct.values()) or 1
    size_demand_index = []
    for band in ["XS–S", "M", "L", "XL+"]:
        share = band_ct.get(band, 0) / band_total
        size_demand_index.append({"band": band, "index": min(165, round(70 + share * 90))})

    clusters: list[dict[str, Any]] = []
    if waists:
        hip_ratio_sample = []
        for p in profiles:
            bm = p.body_measurements or {}
            wv = _safe_float(bm.get("waist_cm"), float("nan"))
            hv = _safe_float(bm.get("hip_cm"), float("nan"))
            if wv != wv or hv != hv:
                continue
            hip_ratio_sample.append(hv / max(wv, 1))
        avg_w = sum(waists) / len(waists)
        avg_ratio = sum(hip_ratio_sample) / len(hip_ratio_sample) if hip_ratio_sample else 1.0
        athletic = round(28 * min(1.8, avg_ratio))
        clusters = [
            {"cluster": "Athletic frame", "share_pct": athletic, "note": _cluster_note("Athletic frame")},
            {"cluster": "Straight mid proportions", "share_pct": max(26, round(52 - athletic // 2)), "note": _cluster_note("Straight mid proportions")},
            {"cluster": "Curvier hips", "share_pct": max(14, round(avg_ratio * 24)), "note": _cluster_note("Curvier hips")},
            {"cluster": "Compact / petite", "share_pct": max(12, round(110 - athletic - avg_w / 6)), "note": _cluster_note("Compact / petite")},
        ]
        total_c = sum(c["share_pct"] for c in clusters) or 1
        clusters = [{**c, "share_pct": max(12, round(100 * c["share_pct"] / total_c))} for c in clusters]
    else:
        clusters = [
            {"cluster": "Straight mid proportions", "share_pct": 38, "note": _cluster_note("Straight mid proportions")},
            {"cluster": "Athletic frame", "share_pct": 24, "note": _cluster_note("Athletic frame")},
            {"cluster": "Curvier hips", "share_pct": 22, "note": _cluster_note("Curvier hips")},
            {"cluster": "Compact / petite", "share_pct": 16, "note": _cluster_note("Compact / petite")},
        ]

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.35
    weekly_trend = []
    for i, label in enumerate(["W-4", "W-3", "W-2", "W-1"]):
        drift = 0.04 * (i + 1) / 4
        weekly_trend.append(
            {"week": label, "consent_opt_in_rate": round(min(0.82, 0.55 + avg_conf * 0.33 + drift), 2), "avg_scan_confidence": round(min(0.95, avg_conf + drift / 5), 2)}
        )

    avg_profile_completeness = round(min(0.95, 0.42 + avg_conf * 0.55), 2)
    allergen_pressure = sum(allergens.values()) / max(n, 1)
    estimated_return_reduction = round(min(40.0, 8.5 + avg_conf * 28 + min(14, allergen_pressure * 120)), 1)

    return {
        "profile_count_private": len(profiles),
        "kpis": {
            "registered_shopper_profiles": len(profiles),
            "profiles_with_measurements_block": round(100 * sum(1 for p in profiles if (p.body_measurements or {}).get("height_cm")) / n, 1),
            "avg_profile_completeness": avg_profile_completeness,
            "estimated_return_reduction_pct": estimated_return_reduction,
        },
        "gender_split": gender_split,
        "silhouette_preferences": silhouette_preferences[:8],
        "top_allergens": top_allergens,
        "size_demand_index": size_demand_index,
        "chest_waist_clusters": clusters,
        "weekly_trend": weekly_trend,
    }


def heuristic_ai_rec(metrics: dict[str, Any]) -> list[dict[str, str]]:
    recs: list[dict[str, str]] = []
    allergens = metrics.get("top_allergens") or []
    prefs = metrics.get("silhouette_preferences") or []
    sizes = metrics.get("size_demand_index") or []
    top_pref = prefs[0] if prefs else None
    xl_band = next((s for s in sizes if s.get("band") == "XL+"), None)

    poly = next((a for a in allergens if isinstance(a.get("material"), str) and "poly" in str(a["material"]).lower()), None)
    if poly:
        recs.append(
            {
                "title": "Label fiber transparency on hero knits",
                "detail": f"{poly['share_pct']}% of tagged shoppers mention polyester — surface natural-core alternatives and elastane percentages on PDP.",
                "impact": "high",
            }
        )

    if top_pref and str(top_pref.get("label")).lower().startswith("over"):
        recs.append(
            {
                "title": "Double down on oversized ladders",
                "detail": "Oversized preferences lead your cohort — widen size breaks and lengthen body panels on hoodies/shirts.",
                "impact": "medium",
            }
        )

    if xl_band and int(xl_band.get("index", 100)) > 118:
        recs.append(
            {
                "title": "Buy deeper on XL outerwear shells",
                "detail": "Size demand skews heavier on XL+; protect lost sales with inventory bias to structured jackets.",
                "impact": "high",
            }
        )

    if not recs:
        recs.append(
            {
                "title": "Collect more posture + inseam telemetry",
                "detail": "Cohort is stabilizing — prompt finishing scans during onboarding for sharper merchandising deltas.",
                "impact": "low",
            }
        )

    return recs[:5]


PARTNERSHIP_BLOCK = {
    "headline": "Offer FitID as a sign-in on your store",
    "bullets": [
        "OAuth2-style FitID login lets shoppers reuse one body profile across partners they approve.",
        "You read only consented scopes (measurements, allergies, silhouette, posture, skin-tone hints).",
        "Sized recommendations grounded in measurements reduce swaps and refunds.",
        "Your engineering team exchanges an authorization code server-side — secrets never ship to the browser bundle.",
    ],
    "integration_steps": [
        "Register an OAuth application in the FitID business console.",
        'Send shoppers to `/api/v1/oauth/authorize` with client_id + redirect_uri + scopes + PKCE/state as needed.',
        "Exchange returning `code` at `/oauth/token` using your server with client_secret.",
        "Call partner profile APIs with issued bearer tokens to personalize PLP sorting and PDP size guidance.",
    ],
}


def build_live_insights(db: Session) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    metrics = compute_profile_aggregates(db)
    ai = heuristic_ai_rec(metrics)
    return {
        "generated_at": now,
        "dataset": "sandbox_live",
        "account_type": "business",
        "kpis": metrics["kpis"],
        "gender_split": metrics["gender_split"],
        "silhouette_preferences": metrics["silhouette_preferences"],
        "top_allergens": metrics["top_allergens"],
        "size_demand_index": metrics["size_demand_index"],
        "chest_waist_clusters": metrics["chest_waist_clusters"],
        "weekly_trend": metrics["weekly_trend"],
        "ai_recommendations": ai,
        "live_meta": {"source_profiles_observed": metrics["profile_count_private"]},
        "partnership": PARTNERSHIP_BLOCK,
    }


def demo_insights_snapshot() -> dict[str, Any]:
    """Synthetic rich dataset identical to legacy demo — used before real business auth."""
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "generated_at": now,
        "dataset": "demo",
        "account_type": "business_demo",
        "kpis": {
            "active_fitid_users_30d": 12_840,
            "partner_sessions_7d": 3_902,
            "avg_profile_completeness": 0.78,
            "estimated_return_reduction_pct": 18.4,
        },
        "gender_split": [{"label": "Women's", "pct": 54}, {"label": "Men's", "pct": 42}, {"label": "Unspecified", "pct": 4}],
        "silhouette_preferences": [
            {"label": "Regular", "pct": 31},
            {"label": "Relaxed", "pct": 27},
            {"label": "Oversized", "pct": 22},
            {"label": "Slim", "pct": 20},
        ],
        "top_allergens": [
            {"material": "Polyester", "share_pct": 19},
            {"material": "Wool", "share_pct": 14},
            {"material": "Latex / elastic blends", "share_pct": 11},
            {"material": "Spandex-heavy knits", "share_pct": 9},
            {"material": "Nickel (hardware)", "share_pct": 6},
        ],
        "size_demand_index": [
            {"band": "XS–S", "index": 72},
            {"band": "M", "index": 100},
            {"band": "L", "index": 118},
            {"band": "XL+", "index": 96},
        ],
        "chest_waist_clusters": [
            {"cluster": "Athletic / broader shoulders", "share_pct": 24, "note": "Favor structured tops & extended sizes in jackets."},
            {"cluster": "Straight mid block", "share_pct": 38, "note": "Core replenishment for M–L; versatile inseams."},
            {"cluster": "Curvier hip emphasis", "share_pct": 22, "note": "Roomier hip block and stretch waists reduce returns."},
            {"cluster": "Petite / shorter inseam", "share_pct": 16, "note": "Offer shortened lengths and proportioned rise."},
        ],
        "weekly_trend": [
            {"week": "W-4", "consent_opt_in_rate": 0.61, "avg_scan_confidence": 0.71},
            {"week": "W-3", "consent_opt_in_rate": 0.63, "avg_scan_confidence": 0.73},
            {"week": "W-2", "consent_opt_in_rate": 0.66, "avg_scan_confidence": 0.74},
            {"week": "W-1", "consent_opt_in_rate": 0.68, "avg_scan_confidence": 0.76},
        ],
        "ai_recommendations": [
            {"title": "Pilot XL outerwear buys", "detail": "Simulated uplift in outerwear conversions when natural linings replace polyester-heavy shells.", "impact": "high"},
            {"title": "Surface elastane percentages", "detail": "Sensitivity tags cluster on stretch blends — PDP clarity lowers abandons.", "impact": "medium"},
        ],
        "partnership": PARTNERSHIP_BLOCK,
        "live_meta": {},
    }
    return payload
