"""Business analytics — public curated demo vs live sandbox aggregates for authenticated business operators."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.security import decode_access_token_subject
from app.db.models import FitProfile
from app.db.session import get_db
from app.services.business_analytics import build_live_insights, demo_insights_snapshot
from jose import JWTError

router = APIRouter(prefix="/business", tags=["business"])


def _optional_subject(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_access_token_subject(token)
    except JWTError:
        return None


@router.get("/insights")
def business_insights(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    subject = _optional_subject(authorization)
    if subject:
        profile = db.query(FitProfile).filter(FitProfile.email == subject).first()
        if profile and str(profile.account_type or "shopper").lower() == "business":
            return build_live_insights(db)
    return demo_insights_snapshot()
