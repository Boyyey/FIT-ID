from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Use argon2 as primary, with bcrypt as fallback if available
try:
    pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
    print("[SECURITY] Using argon2 for password hashing", flush=True)
except Exception as e:
    print(f"[SECURITY] Argon2 failed, trying bcrypt: {e}", flush=True)
    try:
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        print("[SECURITY] Using bcrypt for password hashing", flush=True)
    except Exception as e2:
        print(f"[SECURITY] ERROR: Both argon2 and bcrypt failed: {e2}", flush=True)
        raise


def hash_password(plain: str) -> str:
    # Argon2 has no byte limit; bcrypt has 72-byte limit but we prefer argon2
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, expires_minutes: int = 60) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token_subject(token: str) -> str:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    sub = payload.get("sub")
    if not sub:
        raise JWTError("missing subject")
    return str(sub)


def create_partner_access_token(email: str, client_id: str, scope: str, expires_minutes: int = 120) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {
        "sub": email,
        "typ": "fitid_partner",
        "cid": client_id,
        "scp": scope,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
