from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.db.session import engine, init_db

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
def ready() -> dict:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "service": settings.app_name}


app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
def startup_event() -> None:
    db_kind = settings.database_url.split("://", 1)[0]
    print(f"FitID: initializing database ({db_kind})...", flush=True)
    init_db()
    print("FitID: database ready - http://127.0.0.1:8000/docs", flush=True)
