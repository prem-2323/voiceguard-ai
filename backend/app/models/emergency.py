from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import EmergencyStatus, enum_column


class EmergencyRecord(Base):
    __tablename__ = "emergency_records"
    __table_args__ = (
        Index("ix_emergencies_worker_status", "worker_id", "status"),
        Index("ix_emergencies_permit", "permit_id"),
        Index("ix_emergencies_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    permit_id: Mapped[int | None] = mapped_column(ForeignKey("permits.id", ondelete="SET NULL"), nullable=True)
    emergency_type: Mapped[str] = mapped_column(String(80), default="sos", nullable=False)
    location: Mapped[str | None] = mapped_column(String(180), nullable=True)
    status: Mapped[EmergencyStatus] = mapped_column(enum_column(EmergencyStatus, "emergency_status"), default=EmergencyStatus.SUBMITTED, nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    worker: Mapped["User"] = relationship(back_populates="emergency_records", foreign_keys=[worker_id])
    permit: Mapped["Permit | None"] = relationship()
    acknowledger: Mapped["User | None"] = relationship(foreign_keys=[acknowledged_by])
