from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import HazardStatus, enum_column


class HazardReport(Base):
    __tablename__ = "hazard_reports"
    __table_args__ = (
        Index("ix_hazards_worker_status", "worker_id", "status"),
        Index("ix_hazards_permit_status", "permit_id", "status"),
        Index("ix_hazards_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    permit_id: Mapped[int | None] = mapped_column(ForeignKey("permits.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(180), nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[HazardStatus] = mapped_column(enum_column(HazardStatus, "hazard_status"), default=HazardStatus.SUBMITTED, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    worker: Mapped["User"] = relationship(foreign_keys=[worker_id], back_populates="hazard_reports")
    permit: Mapped["Permit | None"] = relationship()
    acknowledger: Mapped["User | None"] = relationship(foreign_keys=[acknowledged_by])
    notes: Mapped[list["HazardNote"]] = relationship(back_populates="hazard", cascade="all, delete-orphan", order_by="HazardNote.created_at")


class HazardNote(Base):
    __tablename__ = "hazard_notes"
    __table_args__ = (Index("ix_hazard_notes_hazard_created", "hazard_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hazard_id: Mapped[int] = mapped_column(ForeignKey("hazard_reports.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    hazard: Mapped[HazardReport] = relationship(back_populates="notes")
    author: Mapped["User | None"] = relationship()
