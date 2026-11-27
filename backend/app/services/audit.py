from sqlalchemy.orm import Session

from app.models import AuditLog, User


def record_audit(db: Session, *, actor: User | None, action: str, entity_type: str,
                 entity_id: int | None = None, details: dict[str, object] | None = None) -> AuditLog:
    entry = AuditLog(user_id=actor.id if actor else None, action=action, entity_type=entity_type,
                     entity_id=entity_id, details=details or {})
    db.add(entry)
    return entry
