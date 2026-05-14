from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.data.product_catalog import CATEGORIES
from app.db.models import FitProfile
from app.db.schemas import PersonalizedProductItem, ProductCandidate, RecommendationResponse
from app.db.session import get_db
from app.services.personalization import personalize_for_profile
from app.services.recommendation import rank_products

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.post("/{email}", response_model=list[RecommendationResponse])
def recommend_products(
    email: str, products: list[ProductCandidate], db: Session = Depends(get_db)
) -> list[RecommendationResponse]:
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile_payload = {
        "body_measurements": profile.body_measurements or {},
        "fit_preferences": profile.fit_preferences or {},
        "allergies": profile.allergies or [],
    }
    return rank_products(profile_payload, products)


@router.get("/personalized/{email}", response_model=list[PersonalizedProductItem])
def recommend_personalized(
    email: str,
    category: str | None = Query(None, description="Filter: tshirts, shirts, pants, jackets, hoodies, formal"),
    limit: int = Query(48, ge=1, le=120),
    db: Session = Depends(get_db),
) -> list[PersonalizedProductItem]:
    """
    FitID personalization: ranks the full merchant catalog for this user using every stored
    profile dimension (measurements, gender, allergies, preferences, posture, scan confidence, avatar scale).
    """
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Use one of: {', '.join(CATEGORIES)}")
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return personalize_for_profile(profile, category=category, limit=limit)
