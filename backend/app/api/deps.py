from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token_subject
from app.db.models import FitProfile
from app.db.session import get_db


def bearer_subject(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_access_token_subject(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token") from exc


def business_profile(subject: str = Depends(bearer_subject), db: Session = Depends(get_db)) -> FitProfile:
    profile = db.query(FitProfile).filter(FitProfile.email == subject).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if (profile.account_type or "shopper").lower() != "business":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business account required. Register as a Business or switch account.",
        )
    return profile
