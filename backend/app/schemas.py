from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from typing_extensions import Annotated

from app.models.enums import (
    ApprovalStatus, AssessmentResultStatus, BriefingStatus, EmergencyStatus,
    HazardStatus, PermitStatus, UserRole,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRead(ORMModel):
    id: int
    name: str
    worker_id: str
    email: str | None
    role: UserRole
    preferred_language: str
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    worker_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    role: UserRole | None = None


class AuthData(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserRead


class WorkerCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    worker_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40)]
    password: Annotated[str, StringConstraints(min_length=6, max_length=128)]
    preferred_language: Literal["en", "ta", "hi"] = "en"
    email: str | None = None


class PermitCreate(BaseModel):
    permit_number: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=40)]
    worker_id: int
    task_type: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    work_location: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class PermitStatusUpdate(BaseModel):
    status: PermitStatus


class PermitRead(ORMModel):
    id: int
    permit_number: str
    worker_id: int
    task_type: str
    work_location: str
    status: PermitStatus
    valid_from: datetime
    valid_until: datetime | None
    created_at: datetime


class QuestionCreate(BaseModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    expected_answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    acceptable_answers: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]] = Field(default_factory=list, max_length=12)
    language: Literal["en", "ta", "hi"]


class InstructionCreate(BaseModel):
    task_type: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]
    language: Literal["en", "ta", "hi"]
    version: int = Field(default=1, ge=1)
    questions: list[QuestionCreate] = Field(default_factory=list, max_length=20)


class QuestionRead(ORMModel):
    id: int
    instruction_id: int
    question: str
    expected_answer: str
    acceptable_answers: list[str]
    language: str
    version: int


class WorkerQuestionRead(ORMModel):
    id: int
    instruction_id: int
    question: str
    language: str
    version: int


class WorkerInstructionRead(BaseModel):
    id: int
    task_type: str
    title: str
    content: str
    language: str
    version: int
    questions: list[WorkerQuestionRead]


class InstructionRead(ORMModel):
    id: int
    task_type: str
    title: str
    content: str
    language: str
    version: int
    approval_status: ApprovalStatus
    approved_by: int | None
    published_at: datetime | None
    created_at: datetime
    questions: list[QuestionRead] = Field(default_factory=list)


class BriefingStart(BaseModel):
    permit_id: int
    language: Literal["en", "ta", "hi"]


class BriefingProgress(BaseModel):
    current_step: int = Field(ge=0, le=100)
    completed: bool = False

    @model_validator(mode="after")
    def completion_marker_matches_step(self):
        if self.completed and self.current_step != 100:
            raise ValueError("Use current_step=100 when all instruction sections have been reviewed")
        if not self.completed and self.current_step == 100:
            raise ValueError("Set completed=true when all instruction sections have been reviewed")
        return self


class BriefingRead(ORMModel):
    id: int
    worker_id: int
    permit_id: int
    instruction_id: int
    instruction_version: int
    status: BriefingStatus
    current_step: int
    started_at: datetime
    completed_at: datetime | None


class AssessmentSubmit(BaseModel):
    question_id: int
    answer: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]


class AssessmentRead(ORMModel):
    id: int
    session_id: int
    worker_id: int
    permit_id: int
    question_id: int
    question_version: int
    worker_answer: str
    result: AssessmentResultStatus
    attempt_count: int
    reviewed_by: int | None
    created_at: datetime


class ReviewRequest(BaseModel):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class HazardCreate(BaseModel):
    permit_id: int | None = None
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]
    location: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
    transcript: Annotated[str, StringConstraints(max_length=6000)] | None = None


class HazardRead(ORMModel):
    id: int
    worker_id: int
    permit_id: int | None
    category: str
    description: str
    location: str
    transcript: str | None
    status: HazardStatus
    acknowledged_by: int | None
    acknowledged_at: datetime | None
    created_at: datetime


class HazardNoteCreate(BaseModel):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class HazardNoteRead(ORMModel):
    id: int
    hazard_id: int
    author_id: int | None
    note: str
    created_at: datetime


class EmergencyCreate(BaseModel):
    permit_id: int | None = None
    emergency_type: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] = "sos"
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)] | None = None


class EmergencyRead(ORMModel):
    id: int
    worker_id: int
    permit_id: int | None
    emergency_type: str
    location: str | None
    status: EmergencyStatus
    is_simulated: bool
    acknowledged_by: int | None
    acknowledged_at: datetime | None
    created_at: datetime


class AuditRead(ORMModel):
    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    details: dict[str, object]
    created_at: datetime


class SupervisorOverview(BaseModel):
    assigned_workers: int
    open_hazards: int
    pending_assessments: int
    open_simulated_sos: int


def success(data: object = None, message: str = "OK") -> dict[str, object]:
    if isinstance(data, BaseModel):
        data = data.model_dump(mode="json")
    elif isinstance(data, list):
        data = [item.model_dump(mode="json") if isinstance(item, BaseModel) else item for item in data]
    return {"success": True, "message": message, "data": data, "error": None}
