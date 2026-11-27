from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import UserRole, enum_column


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_role_active", "role", "is_active"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    worker_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole, "user_role"), nullable=False)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    permits: Mapped[list["Permit"]] = relationship(back_populates="worker", passive_deletes=True)
    supervisor_links: Mapped[list["SupervisorAssignment"]] = relationship(
        foreign_keys="SupervisorAssignment.supervisor_id",
        back_populates="supervisor",
        cascade="all, delete-orphan",
    )
    worker_links: Mapped[list["SupervisorAssignment"]] = relationship(
        foreign_keys="SupervisorAssignment.worker_id",
        back_populates="worker",
        cascade="all, delete-orphan",
    )
    hazard_reports: Mapped[list["HazardReport"]] = relationship(
        foreign_keys="HazardReport.worker_id", back_populates="worker", passive_deletes=True
    )
    emergency_records: Mapped[list["EmergencyRecord"]] = relationship(
        foreign_keys="EmergencyRecord.worker_id", back_populates="worker", passive_deletes=True
    )


class SupervisorAssignment(Base):
    __tablename__ = "supervisor_assignments"
    __table_args__ = (
        UniqueConstraint("supervisor_id", "worker_id", name="uq_supervisor_worker_assignment"),
        Index("ix_supervisor_assignments_worker", "worker_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supervisor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    supervisor: Mapped[User] = relationship(foreign_keys=[supervisor_id], back_populates="supervisor_links")
    worker: Mapped[User] = relationship(foreign_keys=[worker_id], back_populates="worker_links")
