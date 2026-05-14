from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.routes.profile import _to_response, upsert_profile
from app.db.schemas import FitProfileResponse, ScanInput
from app.db.session import get_db
from app.services.scan import process_live_scan, process_quick_scan

router = APIRouter(prefix="/scan", tags=["scan"])


@router.post("/{email}", response_model=FitProfileResponse)
def run_scan(email: str, payload: ScanInput, db: Session = Depends(get_db)) -> FitProfileResponse:
    scan_result = process_quick_scan(payload)
    base_profile = {
        "email": email,
        "full_name": None,
        "allergies": [],
        "sensitivities": [],
        "fit_preferences": {"silhouette": "regular"},
    }
    profile = upsert_profile(email, {**base_profile, **scan_result}, db)
    return _to_response(profile)


@router.post("/live/{email}", response_model=FitProfileResponse)
async def run_live_scan(
    email: str,
    height_cm: float = Form(...),
    weight_kg: float = Form(...),
    front_image: UploadFile = File(...),
    side_image: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> FitProfileResponse:
    try:
        front_bytes = await front_image.read()
        side_bytes = await side_image.read()
        scan_result = process_live_scan(front_bytes, side_bytes, height_cm=height_cm, weight_kg=weight_kg)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    base_profile = {
        "email": email,
        "full_name": None,
        "allergies": [],
        "sensitivities": [],
        "fit_preferences": {"silhouette": "regular"},
    }
    profile = upsert_profile(email, {**base_profile, **scan_result}, db)
    return _to_response(profile)
