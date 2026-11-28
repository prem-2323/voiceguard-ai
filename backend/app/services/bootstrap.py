from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole
from app.services.audit import record_audit


def create_supervisor_account(
    db: Session,
    *,
    name: str,
    worker_id: str,
    password: str,
    email: str | None = None,
) -> User:
    cleaned_name = name.strip()
    cleaned_worker_id = worker_id.strip()
    if not cleaned_name or not cleaned_worker_id:
        raise ValueError("Name and account ID are required")
    if len(password) < 12:
        raise ValueError("Supervisor passwords must contain at least 12 characters")
    if db.scalar(select(User.id).where(User.worker_id == cleaned_worker_id)) is not None:
        raise ValueError("That account ID is already in use")

    supervisor = User(
        name=cleaned_name,
        worker_id=cleaned_worker_id,
        email=email.strip() if email and email.strip() else None,
        password_hash=hash_password(password),
        role=UserRole.SUPERVISOR,
        preferred_language="en",
        is_active=True,
    )
    db.add(supervisor)
    db.flush()
    record_audit(db, actor=None, action="supervisor_account_bootstrapped", entity_type="user",
                 entity_id=supervisor.id, details={"worker_id": supervisor.worker_id})
    db.commit()
    db.refresh(supervisor)
    return supervisor
