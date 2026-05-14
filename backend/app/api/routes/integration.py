from fastapi import APIRouter
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import PartnerConsent
from app.db.schemas import DataShareConsent
from app.db.session import get_db

router = APIRouter(prefix="/integration", tags=["integration"])


@router.post("/consent")
def save_consent(payload: DataShareConsent, db: Session = Depends(get_db)) -> dict:
    consent = (
        db.query(PartnerConsent)
        .filter(PartnerConsent.email == payload.email, PartnerConsent.partner == payload.partner)
        .first()
    )
    if not consent:
        consent = PartnerConsent(email=payload.email, partner=payload.partner, approved_fields=payload.approved_fields)
        db.add(consent)
    else:
        consent.approved_fields = payload.approved_fields
    db.commit()
    return {"saved": True, "email": payload.email, "partner": payload.partner}


@router.post("/token")
def issue_partner_access(payload: DataShareConsent, db: Session = Depends(get_db)) -> dict:
    consent = (
        db.query(PartnerConsent)
        .filter(PartnerConsent.email == payload.email, PartnerConsent.partner == payload.partner)
        .first()
    )
    if not consent:
        raise HTTPException(status_code=403, detail="Consent required before data sharing")
    approved = set(consent.approved_fields or [])
    requested = set(payload.approved_fields)
    if not requested.issubset(approved):
        raise HTTPException(status_code=403, detail="Requested fields exceed approved consent scope")

    return {
        "partner": payload.partner,
        "scope": sorted(requested),
        "fitid_access_token": f"fitid-{payload.email}-partner-token",
    }
