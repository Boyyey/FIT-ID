from app.db.schemas import ProductCandidate, RecommendationResponse


def _size_from_measurements(waist_cm: float) -> str:
    if waist_cm < 72:
        return "XS"
    if waist_cm < 80:
        return "S"
    if waist_cm < 92:
        return "M"
    if waist_cm < 104:
        return "L"
    return "XL"


def _build_advice(product: ProductCandidate, waist_cm: float, preferred_fit: str) -> str:
    size = _size_from_measurements(waist_cm)
    fit_hint = "true to size"
    if preferred_fit == "slim":
        fit_hint = "fitted or slim"
    elif preferred_fit == "relaxed":
        fit_hint = "roomy and comfortable"

    if "slim" in product.fit_tags and size in ("L", "XL"):
        return f"This piece is a slim cut, so choose {size} and consider one size up if you prefer extra room."
    if "relaxed" in product.fit_tags and size in ("XS", "S"):
        return f"This relaxed item works best in {size}, but shop one size down if you want a more tailored look."
    return f"Based on your measurements, the optimal size is {size}. Look for {fit_hint} styles on this item."


def rank_products(profile: dict, products: list[ProductCandidate]) -> list[RecommendationResponse]:
    waist = profile["body_measurements"].get("waist_cm", 85)
    preferred_fit = profile.get("fit_preferences", {}).get("silhouette", "regular")
    blocked_materials = set(m.lower() for m in profile.get("allergies", []))

    recommendations: list[RecommendationResponse] = []
    for product in products:
        material_penalty = -25 if blocked_materials.intersection(set(tag.lower() for tag in product.material_tags)) else 0
        fit_bonus = 15 if preferred_fit in product.fit_tags else 5
        score = max(0.0, min(100.0, 60 + fit_bonus + material_penalty))
        reason = "Matches profile fit preference" if fit_bonus > 5 else "Good general compatibility"
        if material_penalty < 0:
            reason = "Reduced score due to allergy-sensitive materials"
        recommendations.append(
            RecommendationResponse(
                sku=product.sku,
                title=product.title,
                score=score,
                recommended_size=_size_from_measurements(waist),
                reason=reason,
                advice=_build_advice(product, waist, preferred_fit),
            )
        )

    return sorted(recommendations, key=lambda item: item.score, reverse=True)
