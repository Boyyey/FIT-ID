from sqlalchemy import JSON, Column, Float, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class FitProfile(Base):
    __tablename__ = "fit_profiles"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(64), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    """shopper | business — shoppers use FashionHub/dashboard; businesses use analytics + OAuth apps."""
    account_type = Column(String(32), nullable=False, default="shopper")
    full_name = Column(String(255), nullable=True)
    body_measurements = Column(JSON, default=dict)
    posture = Column(String(64), nullable=True)
    skin_tone = Column(String(64), nullable=True)
    allergies = Column(JSON, default=list)
    sensitivities = Column(JSON, default=list)
    fit_preferences = Column(JSON, default=dict)
    confidence_score = Column(Float, default=0.0)


class PartnerConsent(Base):
    __tablename__ = "partner_consents"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    partner = Column(String(255), nullable=False, index=True)
    approved_fields = Column(JSON, default=list)


class OAuthPendingLogin(Base):
    """Temporary row while the user completes FitID consent in the browser."""

    __tablename__ = "oauth_pending_logins"

    id = Column(Integer, primary_key=True, index=True)
    login_token = Column(String(128), unique=True, nullable=False, index=True)
    client_id = Column(String(128), nullable=False)
    redirect_uri = Column(String(2048), nullable=False)
    state = Column(String(1024), nullable=False, default="")
    scope = Column(String(2048), nullable=False, default="")
    created_unix = Column(Float, nullable=False)


class OAuthClient(Base):
    """Registered third-party OAuth2 client — real partner credentials live here."""

    __tablename__ = "oauth_clients"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(128), unique=True, nullable=False, index=True)
    client_secret_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    redirect_uris = Column(JSON, default=list)
    owner_email = Column(String(255), nullable=False, index=True)
    created_unix = Column(Float, nullable=False)


class OAuthAuthCode(Base):
    """Authorization code exchanged for a partner access token (OAuth2-style)."""

    __tablename__ = "oauth_auth_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    client_id = Column(String(128), nullable=False)
    redirect_uri = Column(String(2048), nullable=False)
    scope = Column(String(2048), nullable=False, default="")
    expires_unix = Column(Float, nullable=False)
    used = Column(Integer, nullable=False, default=0)
