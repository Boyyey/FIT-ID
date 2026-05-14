from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import FitProfile
from app.db.schemas import AuthRequest, AuthResponse, PasswordLogin, PasswordRegister
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


def _synthetic_email(username: str) -> str:
    return f"{username.strip().lower()}@fitid.user"


def _auth_response(profile: FitProfile, token: str) -> AuthResponse:
    return AuthResponse(
        access_token=token,
        email=profile.email,  # type: ignore[arg-type]
        username=profile.username,
        full_name=profile.full_name,
        account_type=str(profile.account_type or "shopper"),
    )


@router.post("/register", response_model=AuthResponse)
def register_password_user(payload: PasswordRegister, db: Session = Depends(get_db)) -> AuthResponse:
    uname = payload.username
    email = _synthetic_email(uname)

    clash = db.query(FitProfile).filter((FitProfile.email == email) | (FitProfile.username == uname)).first()
    if clash:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    full_name = (payload.full_name or uname.replace("_", " ")).strip()
    profile = FitProfile(
        email=email,
        username=uname,
        password_hash=hash_password(payload.password),
        account_type=str(payload.account_type),
        full_name=full_name,
        body_measurements={},
        allergies=[],
        sensitivities=[],
        fit_preferences={"silhouette": "regular", "gender": "male"},
        confidence_score=0.0,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    token = create_access_token(subject=profile.email)
    return _auth_response(profile, token)


@router.post("/login", response_model=AuthResponse)
def login_password_user(payload: PasswordLogin, db: Session = Depends(get_db)) -> AuthResponse:
    uname = payload.username.strip().lower()
    profile = db.query(FitProfile).filter(FitProfile.username == uname).first()
    if not profile or not profile.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(payload.password, profile.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(subject=profile.email)
    return _auth_response(profile, token)


@router.post("/google", response_model=AuthResponse)
def google_sign_in(payload: AuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.google_id_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token",
        ) from exc

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email claim missing")

    profile = db.query(FitProfile).filter(FitProfile.email == email).first()
    if not profile:
        profile = FitProfile(
            email=email,
            username=None,
            password_hash=None,
            account_type="shopper",
            full_name=idinfo.get("name"),
            body_measurements={},
            allergies=[],
            sensitivities=[],
            fit_preferences={"silhouette": "regular"},
            confidence_score=0.0,
        )
        db.add(profile)
    else:
        profile.full_name = idinfo.get("name") or profile.full_name
    db.commit()
    db.refresh(profile)

    token = create_access_token(subject=email)
    return _auth_response(profile, token)
