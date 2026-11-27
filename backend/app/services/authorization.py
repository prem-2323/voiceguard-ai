from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.models import Permit, SupervisorAssignment, User
from app.models.enums import PermitStatus, UserRole


def can_access_worker(db: Session, actor: User, worker_id: int) -> bool:
    if actor.role == UserRole.WORKER:
        return actor.id == worker_id
    return db.scalar(select(SupervisorAssignment.id).where(
        SupervisorAssignment.supervisor_id == actor.id,
        SupervisorAssignment.worker_id == worker_id,
    )) is not None


def require_worker_access(db: Session, actor: User, worker_id: int) -> None:
    if not can_access_worker(db, actor, worker_id):
        raise HTTPException(status_code=404, detail="Worker record was not found")


def get_scoped_permit(db: Session, actor: User, permit_id: int, *, active: bool = False) -> Permit:
    permit = db.get(Permit, permit_id)
    if permit is None:
        raise HTTPException(status_code=404, detail="Permit was not found")
    require_worker_access(db, actor, permit.worker_id)
    if active:
        now = utc_now()
        if permit.status != PermitStatus.ACTIVE or permit.valid_from > now or (permit.valid_until and permit.valid_until < now):
            raise HTTPException(status_code=409, detail="Permit is not active for this workflow")
    return permit
