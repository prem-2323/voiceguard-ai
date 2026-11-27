from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import BriefingStatus, enum_column


class BriefingSession(Base):
    __tablename__ = "briefing_sessions"
    __table_args__ = (
        Index("ix_briefings_worker_permit", "worker_id", "permit_id"),
        Index("ix_briefings_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    permit_id: Mapped[int] = mapped_column(ForeignKey("permits.id", ondelete="RESTRICT"), nullable=False)
    instruction_id: Mapped[int] = mapped_column(ForeignKey("safety_instructions.id", ondelete="RESTRICT"), nullable=False)
    instruction_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[BriefingStatus] = mapped_column(enum_column(BriefingStatus, "briefing_status"), default=BriefingStatus.STARTED, nullable=False)
    current_step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    worker: Mapped["User"] = relationship()
    permit: Mapped["Permit"] = relationship(back_populates="briefing_sessions")
    instruction: Mapped["SafetyInstruction"] = relationship()
    assessment_results: Mapped[list["AssessmentResult"]] = relationship(back_populates="session", passive_deletes=True)
