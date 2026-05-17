from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Try to use bcrypt, fall back to argon2 if bcrypt has issues
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    print("[SECURITY] Using bcrypt for password hashing", flush=True)
except Exception as e:
    print(f"[SECURITY] Bcrypt failed, using argon2: {e}", flush=True)
    pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain: str) -> str:
    # Bcrypt has a 72-byte limit; truncate if necessary to avoid ValueError
    original_len = len(plain.encode('utf-8'))
    if isinstance(plain, str):
        plain_bytes = plain.encode('utf-8')
        if len(plain_bytes) > 72:
            plain = plain_bytes[:72].decode('utf-8', errors='ignore')
            print(f"[SECURITY] Truncated password from {original_len} bytes to 72 bytes for bcrypt", flush=True)
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
