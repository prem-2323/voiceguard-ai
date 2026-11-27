from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import PermitStatus, enum_column


class Permit(Base):
    __tablename__ = "permits"
    __table_args__ = (
        Index("ix_permits_worker_status", "worker_id", "status"),
        Index("ix_permits_number_status", "permit_number", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    permit_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    task_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    work_location: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[PermitStatus] = mapped_column(enum_column(PermitStatus, "permit_status"), default=PermitStatus.DRAFT, nullable=False)
    valid_from: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)
    valid_until: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    worker: Mapped["User"] = relationship(back_populates="permits")
    briefing_sessions: Mapped[list["BriefingSession"]] = relationship(back_populates="permit", passive_deletes=True)
