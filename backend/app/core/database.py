import sqlite3
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import BACKEND_DIR, settings


def _database_url() -> URL:
    parsed = make_url(settings.database_url)
    if parsed.get_backend_name() == "sqlite" and parsed.database not in (None, ":memory:"):
        database_path = Path(parsed.database)
        if not database_path.is_absolute():
            database_path = BACKEND_DIR / database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        parsed = parsed.set(database=database_path.as_posix())
    return parsed


database_url = _database_url()
connect_args = {"check_same_thread": False} if database_url.get_backend_name() == "sqlite" else {}
engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for the VoiceGuard database models."""


if database_url.get_backend_name() == "sqlite":
    @event.listens_for(engine, "connect")
    def _enable_sqlite_integrity(dbapi_connection: sqlite3.Connection, connection_record: object) -> None:
        del connection_record
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create the MVP schema and seed fictional demo identities and permit."""
    import app.models  # noqa: F401 - registers model metadata

    Base.metadata.create_all(bind=engine)
    from app.services.seed import seed_demo_data

    seed_demo_data()
