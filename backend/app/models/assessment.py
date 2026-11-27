from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import AssessmentResultStatus, enum_column


class AssessmentResult(Base):
    __tablename__ = "assessment_results"
    __table_args__ = (
        Index("ix_assessments_worker_created", "worker_id", "created_at"),
        Index("ix_assessments_permit_result", "permit_id", "result"),
        Index("ix_assessments_session_question", "session_id", "question_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("briefing_sessions.id", ondelete="RESTRICT"), nullable=False)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    permit_id: Mapped[int] = mapped_column(ForeignKey("permits.id", ondelete="RESTRICT"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("safety_questions.id", ondelete="RESTRICT"), nullable=False)
    question_version: Mapped[int] = mapped_column(Integer, nullable=False)
    worker_answer: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[AssessmentResultStatus] = mapped_column(
        enum_column(AssessmentResultStatus, "assessment_result"), nullable=False
    )
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    session: Mapped["BriefingSession"] = relationship(back_populates="assessment_results")
    worker: Mapped["User"] = relationship(foreign_keys=[worker_id])
    permit: Mapped["Permit"] = relationship()
    question: Mapped["SafetyQuestion"] = relationship()
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])
