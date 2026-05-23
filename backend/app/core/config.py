from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FitID API"
    environment: str = "development"
    # Default to SQLite so `uvicorn` works without Docker/Postgres; use .env for Postgres in production.
    database_url: str = "sqlite:///./fitid.db"
    jwt_secret: str = "change-this-secret"
    jwt_algorithm: str = "HS256"
    google_client_id: str = "set-google-client-id"
    allowed_origins: str = "http://localhost:3000"
    db_connect_max_retries: int = 8
    db_connect_retry_delay_seconds: float = 1.0
    # Partner OAuth (Sign in with FitID) — demo client; register real clients in DB later.
    fitid_public_url: str = "http://localhost:3000"
    oauth_demo_client_id: str = "fitid_demo_store"
    oauth_demo_client_secret: str = "fitid-demo-partner-secret-change-me"
    oauth_demo_redirect_uris: str = (
        "http://localhost:3000/partner/demo/callback,"
        "http://localhost:5174/callback,"
        "https://luma-artier.onrender.com/callback"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
