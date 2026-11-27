from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.core.time import utc_now
from app.models import Permit, SupervisorAssignment, User
from app.models.enums import PermitStatus, UserRole


def seed_demo_data() -> None:
    """Create only fictional logins and the permit in the scope document."""
    with SessionLocal() as db:
        worker = db.scalar(select(User).where(User.worker_id == "WRK-1001"))
        if worker is None:
            worker = User(name="Prem Demo Worker", worker_id="WRK-1001", password_hash=hash_password("demo123"),
                          role=UserRole.WORKER, preferred_language="ta", is_active=True)
            db.add(worker)
        supervisor = db.scalar(select(User).where(User.worker_id == "SUP-1001"))
        if supervisor is None:
            supervisor = User(name="Demo Supervisor", worker_id="SUP-1001", password_hash=hash_password("demo123"),
                              role=UserRole.SUPERVISOR, preferred_language="en", is_active=True)
            db.add(supervisor)
        db.flush()
        if db.scalar(select(Permit.id).where(Permit.permit_number == "PTW-1001")) is None:
            db.add(Permit(permit_number="PTW-1001", worker_id=worker.id, task_type="Equipment Maintenance",
                          work_location="Pump House 04", status=PermitStatus.ACTIVE, valid_from=utc_now()))
        if db.scalar(select(SupervisorAssignment.id).where(
            SupervisorAssignment.supervisor_id == supervisor.id,
            SupervisorAssignment.worker_id == worker.id,
        )) is None:
            db.add(SupervisorAssignment(supervisor_id=supervisor.id, worker_id=worker.id))
        db.commit()
