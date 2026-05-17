from collections.abc import Generator
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, OAuthClient


def _create_engine():
    url = settings.database_url
    if url.startswith("sqlite"):
        return create_engine(
            url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False},
        )
    kwargs: dict = {"pool_pre_ping": True}
    if "postgresql" in url:
        # Avoid long hangs when Postgres is down (common local dev mistake).
        kwargs["connect_args"] = {"connect_timeout": 5}
    return create_engine(url, **kwargs)


engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_add_column(connection, table: str, ddl: str) -> None:
    try:
        connection.execute(text(ddl))
        connection.commit()
    except Exception:
        connection.rollback()


def _migrate_sqlite_after_create(connection) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    rows = connection.execute(text("PRAGMA table_info(fit_profiles)")).fetchall()
    colnames = {r[1] for r in rows}
    if "account_type" not in colnames:
        _sqlite_add_column(
            connection,
            "fit_profiles",
            "ALTER TABLE fit_profiles ADD COLUMN account_type VARCHAR(32) NOT NULL DEFAULT 'shopper'",
        )
    if "username" not in colnames:
        _sqlite_add_column(connection, "fit_profiles", "ALTER TABLE fit_profiles ADD COLUMN username VARCHAR(64)")
    if "password_hash" not in colnames:
        _sqlite_add_column(connection, "fit_profiles", "ALTER TABLE fit_profiles ADD COLUMN password_hash VARCHAR(255)")


def _seed_demo_oauth_client(db: Session) -> None:
    uris = [u.strip() for u in settings.oauth_demo_redirect_uris.split(",") if u.strip()]
    existing = db.query(OAuthClient).filter(OAuthClient.client_id == settings.oauth_demo_client_id).first()
    if existing:
        current = list(existing.redirect_uris or [])
        merged = list(dict.fromkeys([*current, *uris]))
        if merged != current:
            existing.redirect_uris = merged
            db.commit()
        return
    db.add(
        OAuthClient(
            client_id=settings.oauth_demo_client_id,
            client_secret_hash=hash_password(settings.oauth_demo_client_secret),
            name="Built-in demo store",
            redirect_uris=uris,
            owner_email="_system",
            created_unix=time.time(),
        )
    )
    db.commit()


def init_db() -> None:
    last_error: Exception | None = None
    for attempt in range(1, settings.db_connect_max_retries + 1):
        try:
            print(f"[DB] Attempt {attempt}/{settings.db_connect_max_retries}: Connecting to database...", flush=True)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("[DB] Connection successful, creating tables...", flush=True)
            Base.metadata.create_all(bind=engine)
            print("[DB] Tables created, running migrations...", flush=True)
            with engine.connect() as connection:
                _migrate_sqlite_after_create(connection)
            print("[DB] Migrations done, seeding demo OAuth client...", flush=True)
            with SessionLocal() as db:
                _seed_demo_oauth_client(db)
            print("[DB] Database initialization complete!", flush=True)
            return
        except Exception as exc:  # pragma: no cover - startup resilience path
            print(f"[DB] ERROR on attempt {attempt}: {type(exc).__name__}: {exc}", flush=True)
            last_error = exc
            if attempt == settings.db_connect_max_retries:
                break
            time.sleep(settings.db_connect_retry_delay_seconds)
    print(f"[DB] FAILED after {settings.db_connect_max_retries} attempts", flush=True)
    raise RuntimeError("Database connection failed during startup") from last_error
