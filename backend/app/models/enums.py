from enum import Enum

from sqlalchemy import Enum as SqlEnum


class UserRole(str, Enum):
    WORKER = "worker"
    SUPERVISOR = "supervisor"


class PermitStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"
    EXPIRED = "expired"


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    PUBLISHED = "published"


class BriefingStatus(str, Enum):
    STARTED = "started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUPERVISOR_REVIEW = "supervisor_review"


class AssessmentResultStatus(str, Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    UNCLEAR = "unclear"


class HazardStatus(str, Enum):
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


class EmergencyStatus(str, Enum):
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


def enum_column(enum_type: type[Enum], name: str, *, length: int = 32) -> SqlEnum:
    return SqlEnum(
        enum_type,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda items: [item.value for item in items],
        length=length,
    )
