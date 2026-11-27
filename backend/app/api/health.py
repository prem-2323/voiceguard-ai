from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, object]:
    """Report API and database readiness."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc

    return {
        "success": True,
        "message": "VoiceGuard API is ready",
        "data": {"status": "healthy", "database": "ok"},
        "error": None,
    }
