"""OAuth2-style 'Sign in with FitID' for registered partner clients."""

from __future__ import annotations

import secrets
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_partner_access_token,
    decode_access_token_subject,
    verify_password,
)
from app.data.posture_labels import posture_human_label
from app.db.models import FitProfile, OAuthAuthCode, OAuthClient, OAuthPendingLogin
from app.db.schemas import OAuthApproveRequest, OAuthTokenRequest
from app.db.session import get_db

router = APIRouter(prefix="/oauth", tags=["oauth"])


def _resolve_fitid_subject(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")
    raw = authorization.split(" ", 1)[1].strip()
    try:
        # Consumer session JWT issued by FitID — not the partner bearer.
        sub = decode_access_token_subject(raw)
        if "|" in sub or sub.startswith("partner:"):  # future-proof
            raise JWTError()
        return str(sub).strip()
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid FitID session token — sign in again.") from exc


def _profile_subset(scope: str, profile: FitProfile | None) -> dict[str, Any]:
    keys = {s.strip() for s in scope.split(",") if s.strip()}
    out: dict[str, Any] = {}
    if not profile:
        return out
    out["email"] = profile.email
    if "body_measurements" in keys:
        out["body_measurements"] = profile.body_measurements or {}
    if "fit_preferences" in keys:
        out["fit_preferences"] = profile.fit_preferences or {}
    if "allergies" in keys:
        out["allergies"] = profile.allergies or []
    if "sensitivities" in keys:
        out["sensitivities"] = profile.sensitivities or []
    if "posture" in keys:
        out["posture"] = profile.posture
        out["posture_label"] = posture_human_label(profile.posture)
    if "skin_tone" in keys:
        out["skin_tone"] = profile.skin_tone
    return out


def _get_client(db: Session, client_id: str) -> OAuthClient | None:
    return db.query(OAuthClient).filter(OAuthClient.client_id == client_id).first()


@router.get("/authorize")
def oauth_authorize(
    client_id: str,
    redirect_uri: str,
    state: str = "",
    scope: str = "body_measurements,fit_preferences,allergies",
    db: Session = Depends(get_db),
) -> RedirectResponse:
    row = _get_client(db, client_id)
    if not row:
        raise HTTPException(status_code=400, detail="Unknown client_id — register your app first.")
    allowed = list(row.redirect_uris or [])
    if redirect_uri not in allowed:
        raise HTTPException(
            status_code=400,
            detail="redirect_uri not registered for this client. Add exact URL in FitID OAuth applications.",
        )
    login_token = secrets.token_urlsafe(32)
    now = time.time()
    pending = OAuthPendingLogin(
        login_token=login_token,
        client_id=client_id,
        redirect_uri=redirect_uri,
        state=state or "",
        scope=scope,
        created_unix=now,
    )
    db.add(pending)
    db.commit()
    base = settings.fitid_public_url.rstrip("/")
    target = f"{base}/partner/oauth/consent?login_token={login_token}"
    return RedirectResponse(target, status_code=302)


@router.post("/approve")
def oauth_approve(
    payload: OAuthApproveRequest,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    email = _resolve_fitid_subject(authorization)
    now = time.time()
    pending = (
        db.query(OAuthPendingLogin).filter(OAuthPendingLogin.login_token == payload.login_token).first()
    )
    if not pending or now - pending.created_unix > 600:
        raise HTTPException(status_code=400, detail="Invalid or expired login_token")
    if payload.email is not None and str(payload.email).strip().lower() != email.lower():
        raise HTTPException(status_code=403, detail="Session email mismatch")
    code = secrets.token_urlsafe(32)
    ac = OAuthAuthCode(
        code=code,
        email=email,
        client_id=pending.client_id,
        redirect_uri=pending.redirect_uri,
        scope=pending.scope,
        expires_unix=now + 600,
        used=0,
    )
    db.add(ac)
    db.delete(pending)
    db.commit()
    sep = "&" if "?" in pending.redirect_uri else "?"
    url = f"{pending.redirect_uri}{sep}code={code}&state={pending.state}"
    return {"redirect_url": url}


@router.post("/token")
def oauth_token(payload: OAuthTokenRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    if payload.grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")
    row_client = _get_client(db, payload.client_id)
    if not row_client or not verify_password(payload.client_secret, row_client.client_secret_hash):
        raise HTTPException(status_code=401, detail="Invalid client credentials")
    now = time.time()
    row = db.query(OAuthAuthCode).filter(OAuthAuthCode.code == payload.code).first()
    if not row or row.used != 0 or row.expires_unix < now:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if row.redirect_uri != payload.redirect_uri:
        raise HTTPException(status_code=400, detail="redirect_uri mismatch")
    if row.client_id != payload.client_id:
        raise HTTPException(status_code=400, detail="client_id mismatch for this authorization code")
    row.used = 1
    db.commit()
    profile = db.query(FitProfile).filter(FitProfile.email == row.email).first()
    access = create_partner_access_token(row.email, row.client_id, row.scope, expires_minutes=120)
    return {
        "access_token": access,
        "token_type": "bearer",
        "expires_in": 7200,
        "scope": row.scope,
        "profile": _profile_subset(row.scope, profile),
    }


@router.post("/seed-demo-client")
def seed_demo_client(db: Session = Depends(get_db)) -> dict[str, str]:
    """Manually seed the demo OAuth client - for production setup."""
    from app.core.config import settings
    from app.db.session import _seed_demo_oauth_client

    _seed_demo_oauth_client(db)
    return {"status": "success", "message": "Demo OAuth client seeded"}
