from collections.abc import Iterator
from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.core.time import utc_now
from app.main import app
from app.models import Permit, SupervisorAssignment, User
from app.models.enums import PermitStatus, UserRole


@pytest.fixture
def system(monkeypatch, tmp_path) -> Iterator[dict[str, object]]:
    test_database = tmp_path / "voiceguard-test.sqlite3"
    engine = create_engine(
        f"sqlite:///{test_database.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    password_hash = hash_password("demo123")
    with test_sessions() as db:
        worker = User(name="Worker One", worker_id="WRK-TEST-1", password_hash=password_hash,
                      role=UserRole.WORKER, preferred_language="en", is_active=True)
        other_worker = User(name="Worker Two", worker_id="WRK-TEST-2", password_hash=password_hash,
                            role=UserRole.WORKER, preferred_language="ta", is_active=True)
        supervisor = User(name="Supervisor One", worker_id="SUP-TEST-1", password_hash=password_hash,
                          role=UserRole.SUPERVISOR, preferred_language="en", is_active=True)
        other_supervisor = User(name="Supervisor Two", worker_id="SUP-TEST-2", password_hash=password_hash,
                                role=UserRole.SUPERVISOR, preferred_language="en", is_active=True)
        db.add_all([worker, other_worker, supervisor, other_supervisor])
        db.flush()
        permit = Permit(permit_number="PTW-TEST-1", worker_id=worker.id, task_type="Maintenance",
                        work_location="Test Bay", status=PermitStatus.ACTIVE, valid_from=utc_now())
        db.add_all([
            permit,
            SupervisorAssignment(supervisor_id=supervisor.id, worker_id=worker.id),
        ])
        db.commit()
        ids = {
            "worker": worker.id,
            "other_worker": other_worker.id,
            "supervisor": supervisor.id,
            "other_supervisor": other_supervisor.id,
            "permit": permit.id,
        }

    def override_get_db():
        with test_sessions() as db:
            yield db

    @asynccontextmanager
    async def test_lifespan(_application):
        yield

    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(app.router, "lifespan_context", test_lifespan)
    monkeypatch.setattr("app.main.init_db", lambda: None)
    monkeypatch.setattr("app.api.realtime.SessionLocal", test_sessions)
    tokens = {
        "worker": create_access_token(user_id=ids["worker"], role="worker"),
        "other_worker": create_access_token(user_id=ids["other_worker"], role="worker"),
        "supervisor": create_access_token(user_id=ids["supervisor"], role="supervisor"),
        "other_supervisor": create_access_token(user_id=ids["other_supervisor"], role="supervisor"),
    }
    print("tokens done")

    with TestClient(app) as client:
        yield {"client": client, "ids": ids, "tokens": tokens, "sessions": test_sessions}

    app.dependency_overrides.clear()
    engine.dispose()
