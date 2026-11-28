import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.core import database
from app.core.config import settings
from app.core.database import Base
from app.models import AuditLog, Permit, SupervisorAssignment, User
from app.models.enums import PermitStatus, UserRole
from app.core.time import utc_now
from app.services.bootstrap import create_supervisor_account


@pytest.fixture
def isolated_database(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'startup.sqlite3').as_posix()}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", sessions)
    yield sessions
    engine.dispose()


@pytest.mark.parametrize("environment", ["development", "testing", "production"])
def test_startup_does_not_insert_any_user_or_permit_records(isolated_database, monkeypatch, environment):
    monkeypatch.setattr(settings, "environment", environment)

    database.init_db()

    with isolated_database() as db:
        for model in (User, Permit, SupervisorAssignment, AuditLog):
            assert db.scalar(select(func.count()).select_from(model)) == 0


def test_production_startup_refuses_retired_sample_records_without_deleting_them(isolated_database, monkeypatch):
    monkeypatch.setattr(settings, "environment", "testing")
    with isolated_database() as db:
        supervisor = User(name="Test Supervisor", worker_id=database.LEGACY_SAMPLE_ACCOUNT_IDS[1], password_hash="test-hash",
                          role=UserRole.SUPERVISOR, is_active=True)
        worker = User(name="Test Worker", worker_id=database.LEGACY_SAMPLE_ACCOUNT_IDS[0], password_hash="test-hash",
                      role=UserRole.WORKER, is_active=True)
        db.add_all([supervisor, worker])
        db.flush()
        db.add(Permit(permit_number=database.LEGACY_SAMPLE_PERMIT_NUMBERS[0], worker_id=worker.id, task_type="Test Task",
                      work_location="Test Location", status=PermitStatus.ACTIVE, valid_from=utc_now()))
        db.commit()
    monkeypatch.setattr(settings, "environment", "production")

    with pytest.raises(RuntimeError, match="retired sample records"):
        database.init_db()

    with isolated_database() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 2
        assert db.scalar(select(func.count()).select_from(Permit)) == 1


def test_bootstrap_creates_supervisor_without_demo_data(isolated_database):
    with isolated_database() as db:
        supervisor = create_supervisor_account(
            db, name="Site Supervisor", worker_id="SUP-SITE-1", password="site-password-42"
        )

        assert supervisor.role == UserRole.SUPERVISOR
        assert supervisor.worker_id == "SUP-SITE-1"

    with isolated_database() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1
        assert db.scalar(select(func.count()).select_from(AuditLog)) == 1


def test_bootstrap_rejects_weak_or_duplicate_supervisor_accounts(isolated_database):
    with isolated_database() as db:
        with pytest.raises(ValueError, match="at least 12"):
            create_supervisor_account(db, name="Site Supervisor", worker_id="SUP-SITE-1", password="short")
        create_supervisor_account(db, name="Site Supervisor", worker_id="SUP-SITE-1", password="site-password-42")
        with pytest.raises(ValueError, match="already in use"):
            create_supervisor_account(db, name="Second Supervisor", worker_id="SUP-SITE-1", password="another-password-43")
