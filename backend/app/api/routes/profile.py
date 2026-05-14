from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.posture_labels import posture_human_label
from app.db.models import FitProfile
from app.db.schemas import FitProfileResponse, SensitivityInput
from app.db.session import get_db

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/{email}", response_model=FitProfileResponse)
def get_profile(email: str, db: Session = Depends(get_db)) -> FitProfileResponse:
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_response(profile)


@router.put("/{email}/sensitivity", response_model=FitProfileResponse)
def update_sensitivity(email: str, payload: SensitivityInput, db: Session = Depends(get_db)) -> FitProfileResponse:
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.allergies = payload.allergies
    profile.sensitivities = payload.sensitivities
    profile.fit_preferences = payload.fit_preferences
    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.delete("/{email}")
def delete_profile(email: str, db: Session = Depends(get_db)) -> dict:
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return {"deleted": True, "email": email}


def upsert_profile(email: str, data: dict, db: Session) -> FitProfile:
    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        profile = FitProfile(
            email=email,
            account_type="shopper",
            full_name=data.get("full_name"),
            body_measurements=data.get("body_measurements", {}),
            posture=data.get("posture"),
            skin_tone=data.get("skin_tone"),
            allergies=data.get("allergies", []),
            sensitivities=data.get("sensitivities", []),
            fit_preferences=data.get("fit_preferences", {"silhouette": "regular"}),
            confidence_score=data.get("confidence_score", 0.0),
        )
        db.add(profile)
    else:
        profile.full_name = data.get("full_name", profile.full_name)
        profile.body_measurements = data.get("body_measurements", profile.body_measurements)
        profile.posture = data.get("posture", profile.posture)
        profile.skin_tone = data.get("skin_tone", profile.skin_tone)
        profile.allergies = data.get("allergies", profile.allergies)
        profile.sensitivities = data.get("sensitivities", profile.sensitivities)
        profile.fit_preferences = data.get("fit_preferences", profile.fit_preferences)
        profile.confidence_score = data.get("confidence_score", profile.confidence_score)
    db.commit()
    db.refresh(profile)
    return profile


def _to_response(profile: FitProfile) -> FitProfileResponse:
    posture_slug = profile.posture
    return FitProfileResponse(
        email=profile.email,
        username=profile.username,
        account_type=str(profile.account_type or "shopper"),
        full_name=profile.full_name,
        body_measurements=profile.body_measurements or {},
        posture=posture_slug,
        posture_label=posture_human_label(posture_slug),
        skin_tone=profile.skin_tone,
        allergies=profile.allergies or [],
        sensitivities=profile.sensitivities or [],
        fit_preferences=profile.fit_preferences or {},
        confidence_score=profile.confidence_score or 0.0,
    )
