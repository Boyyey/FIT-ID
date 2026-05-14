"""Register OAuth2 clients — business FitID accounts only."""

from __future__ import annotations

import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import business_profile
from app.core.security import hash_password
from app.db.models import FitProfile, OAuthClient
from app.db.schemas import OAuthAppCreated, OAuthAppCreate, OAuthAppOutline
from app.db.session import get_db

router = APIRouter(prefix="/oauth/applications", tags=["oauth_applications"])


@router.get("", response_model=list[OAuthAppOutline])
def list_applications(profile: FitProfile = Depends(business_profile), db: Session = Depends(get_db)) -> list[OAuthAppOutline]:
    rows = (
        db.query(OAuthClient)
        .filter(OAuthClient.owner_email == profile.email)
        .order_by(OAuthClient.created_unix.desc())
        .all()
    )
    return [
        OAuthAppOutline(
            client_id=r.client_id,
            name=r.name,
            redirect_uris=list(r.redirect_uris or []),
            created_unix=float(r.created_unix),
        )
        for r in rows
    ]


def _sanitize_redirect(uri: str) -> str | None:
    u = uri.strip()
    if u.startswith("https://"):
        return u
    if u.startswith("http://localhost") or u.startswith("http://127.0.0.1"):
        return u
    return None


@router.post("", response_model=OAuthAppCreated)
def register_application(
    payload: OAuthAppCreate,
    profile: FitProfile = Depends(business_profile),
    db: Session = Depends(get_db),
) -> OAuthAppCreated:
    uris: list[str] = []
    seen: set[str] = set()
    for raw in payload.redirect_uris:
        fixed = _sanitize_redirect(raw)
        if not fixed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"redirect_uri rejected (use https:// or http://localhost...): {raw}",
            )
        if fixed not in seen:
            seen.add(fixed)
            uris.append(fixed)
    if not uris:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one redirect_uri required")

    cid = secrets.token_urlsafe(10).replace("-", "").lower()[:20]
    if db.query(OAuthClient).filter(OAuthClient.client_id == cid).first():
        cid = secrets.token_urlsafe(16)
    secret_plain = secrets.token_urlsafe(32)
    now = time.time()
    db.add(
        OAuthClient(
            client_id=cid,
            client_secret_hash=hash_password(secret_plain),
            name=payload.name.strip(),
            redirect_uris=uris,
            owner_email=profile.email,
            created_unix=now,
        )
    )
    db.commit()
    return OAuthAppCreated(client_id=cid, client_secret=secret_plain, redirect_uris=uris)
