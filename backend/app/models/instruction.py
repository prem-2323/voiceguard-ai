from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, event, inspect, select
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import utc_now
from app.core.types import UTCDateTime
from app.models.enums import ApprovalStatus, enum_column


class SafetyInstruction(Base):
    __tablename__ = "safety_instructions"
    __table_args__ = (
        UniqueConstraint("task_type", "language", "version", name="uq_instruction_task_language_version"),
        Index("ix_instructions_task_status_language", "task_type", "approval_status", "language"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_type: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        enum_column(ApprovalStatus, "instruction_approval_status"),
        default=ApprovalStatus.DRAFT,
        nullable=False,
    )
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, nullable=False)

    approved_by_user: Mapped["User | None"] = relationship(foreign_keys=[approved_by])
    questions: Mapped[list["SafetyQuestion"]] = relationship(
        back_populates="instruction",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SafetyQuestion.id",
    )


class SafetyQuestion(Base):
    __tablename__ = "safety_questions"
    __table_args__ = (
        Index("ix_safety_questions_instruction", "instruction_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instruction_id: Mapped[int] = mapped_column(ForeignKey("safety_instructions.id", ondelete="CASCADE"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str] = mapped_column(Text, nullable=False)
    acceptable_answers: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    instruction: Mapped[SafetyInstruction] = relationship(back_populates="questions")


@event.listens_for(SafetyInstruction, "before_update")
def _keep_published_instructions_immutable(mapper: object, connection: object, target: SafetyInstruction) -> None:
    del mapper, connection
    state = inspect(target)
    status_history = state.attrs.approval_status.history
    previous_status = status_history.deleted[0] if status_history.deleted else target.approval_status
    if previous_status == ApprovalStatus.PUBLISHED:
        changed = [
            field
            for field in ("task_type", "title", "content", "language", "version", "approval_status", "approved_by", "published_at")
            if state.attrs[field].history.has_changes()
        ]
        if changed:
            raise ValueError("Published safety instruction versions are immutable; create a new draft instead.")


@event.listens_for(SafetyInstruction, "before_delete")
def _keep_published_instruction_history(mapper: object, connection: object, target: SafetyInstruction) -> None:
    del mapper, connection
    if target.approval_status == ApprovalStatus.PUBLISHED:
        raise ValueError("Published safety instruction versions cannot be deleted.")


@event.listens_for(SafetyQuestion, "before_insert")
@event.listens_for(SafetyQuestion, "before_update")
@event.listens_for(SafetyQuestion, "before_delete")
def _keep_published_question_history(mapper: object, connection: object, target: SafetyQuestion) -> None:
    del mapper
    approval_status = connection.execute(
        select(SafetyInstruction.approval_status).where(SafetyInstruction.id == target.instruction_id)
    ).scalar_one_or_none()
    if approval_status == ApprovalStatus.PUBLISHED:
        raise ValueError("Questions for a published safety instruction cannot be changed or deleted.")
