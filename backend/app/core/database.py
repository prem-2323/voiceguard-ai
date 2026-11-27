from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

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
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models added in later phases."""


def init_db() -> None:
    """Create the configured database and any registered tables."""
    Base.metadata.create_all(bind=engine)
