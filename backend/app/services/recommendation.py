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


def rank_products(profile: dict, products: list[ProductCandidate]) -> list[RecommendationResponse]:
    waist = profile["body_measurements"].get("waist_cm", 85)
    preferred_fit = profile.get("fit_preferences", {}).get("silhouette", "regular")
    blocked_materials = set(m.lower() for m in profile.get("allergies", []))

    recommendations: list[RecommendationResponse] = []
    for product in products:
        material_penalty = -25 if blocked_materials.intersection(set(tag.lower() for tag in product.material_tags)) else 0
        fit_bonus = 15 if preferred_fit in product.fit_tags else 5
        score = max(0.0, min(100.0, 60 + fit_bonus + material_penalty))
        reason = "Matches profile fit preference" if fit_bonus > 5 else "General fit compatibility"
        if material_penalty < 0:
            reason = "Reduced score due to allergy-sensitive materials"
        recommendations.append(
            RecommendationResponse(
                sku=product.sku,
                title=product.title,
                score=score,
                recommended_size=_size_from_measurements(waist),
                reason=reason,
            )
        )

    return sorted(recommendations, key=lambda item: item.score, reverse=True)
