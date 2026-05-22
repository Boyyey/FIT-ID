from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


class AuthRequest(BaseModel):
    google_id_token: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: EmailStr
    username: str | None = None
    full_name: str | None = None
    account_type: str = "shopper"


class PasswordRegister(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    account_type: str = Field(default="shopper", pattern="^(shopper|business)$")
    full_name: str | None = None

    @field_validator("username")
    @classmethod
    def username_chars(cls, v: str) -> str:
        import re

        if not re.fullmatch(r"[A-Za-z0-9_]+", v):
            raise ValueError("Username may contain letters, numbers, and underscores.")
        return v.lower()


class PasswordLogin(BaseModel):
    username: str
    password: str


class OAuthAppCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    redirect_uris: list[str]


class OAuthAppCreated(BaseModel):
    client_id: str
    client_secret: str
    redirect_uris: list[str]


class OAuthAppOutline(BaseModel):
    client_id: str
    name: str | None = None
    redirect_uris: list[str]
    created_unix: float


class ScanInput(BaseModel):
    height_cm: float = Field(gt=80, lt=260)
    weight_kg: float = Field(gt=20, lt=300)
    shoulder_width_cm: float = Field(gt=20, lt=90)
    waist_cm: float = Field(gt=30, lt=200)
    hip_cm: float = Field(gt=30, lt=220)
    inseam_cm: float = Field(gt=30, lt=140)
    posture_hint: str = "neutral"
    skin_tone_hint: str = "medium"


class LiveScanInput(BaseModel):
    height_cm: float = Field(gt=80, lt=260)
    weight_kg: float = Field(gt=20, lt=300)


class SensitivityInput(BaseModel):
    allergies: list[str] = []
    sensitivities: list[str] = []
    fit_preferences: dict[str, Any] = {}


class FitProfileResponse(BaseModel):
    email: EmailStr
    username: str | None = None
    account_type: str = "shopper"
    full_name: str | None = None
    body_measurements: dict[str, Any]
    posture: str | None = None
    posture_label: str | None = Field(default=None, description="Shopper-friendly posture copy derived from posture slug.")
    skin_tone: str | None = None
    allergies: list[str]
    sensitivities: list[str]
    fit_preferences: dict[str, Any]
    confidence_score: float


class ProductCandidate(BaseModel):
    sku: str
    title: str
    fit_tags: list[str]
    material_tags: list[str]
    color_family: str


class RecommendationResponse(BaseModel):
    sku: str
    title: str
    score: float
    recommended_size: str
    reason: str
    advice: str | None = None


class DataShareConsent(BaseModel):
    email: EmailStr
    partner: str
    approved_fields: list[str]


class PersonalizedProductItem(BaseModel):
    sku: str
    merchant: str
    brand: str
    title: str
    category: str
    gender: str
    material: str
    fit_profile: str
    color: str
    price_aed: int
    image_url: str
    product_url: str
    personalized_score: float
    recommended_size: str
    reasons: list[str]
    fit_label: str


class OAuthApproveRequest(BaseModel):
    login_token: str
    email: EmailStr | None = None


class OAuthTokenRequest(BaseModel):
    grant_type: str
    code: str
    client_id: str
    client_secret: str
    redirect_uri: str
