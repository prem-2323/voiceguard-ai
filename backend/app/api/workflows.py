import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.core.time import utc_now
from app.models import (
    AssessmentResult, AuditLog, BriefingSession, EmergencyRecord, HazardNote,
    HazardReport, Permit, SafetyInstruction, SafetyQuestion,
    SupervisorAssignment, User,
)
from app.models.enums import (
    ApprovalStatus, AssessmentResultStatus, BriefingStatus, EmergencyStatus,
    HazardStatus, PermitStatus, UserRole,
)
from app.schemas import (
    AssessmentRead, AssessmentSubmit, AuditRead, AuthData, BriefingProgress,
    BriefingRead, BriefingStart, EmergencyCreate, EmergencyRead, HazardCreate,
    HazardNoteCreate, HazardNoteRead, HazardRead, InstructionCreate,
    InstructionRead, LoginRequest, PermitCreate, PermitRead, PermitStatusUpdate,
    QuestionRead, ReviewRequest, SupervisorOverview, UserRead, WorkerCreate,
    WorkerInstructionRead, WorkerQuestionRead, success,
)
from app.services.audit import record_audit
from app.services.authorization import get_scoped_permit, require_worker_access

router = APIRouter()


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The record conflicts with existing data") from exc


def _flush(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The record conflicts with existing data") from exc


def _get_or_404(db: Session, model: type, record_id: int, label: str):
    value = db.get(model, record_id)
    if value is None:
        raise HTTPException(status_code=404, detail=f"{label} was not found")
    return value


def _worker_instruction(instruction: SafetyInstruction) -> WorkerInstructionRead:
    return WorkerInstructionRead(
        id=instruction.id,
        task_type=instruction.task_type,
        title=instruction.title,
        content=instruction.content,
        language=instruction.language,
        version=instruction.version,
        questions=[WorkerQuestionRead.model_validate(question) for question in instruction.questions],
    )


def _normalise_answer(value: str) -> str:
    return " ".join(re.findall(r"[^\W_]+", value.casefold(), flags=re.UNICODE))


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@router.post("/auth/demo-login", tags=["authentication"])
def demo_login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Issue a short-lived demo JWT after checking the fictional account credentials."""
    statement = select(User).where(User.worker_id == payload.worker_id, User.is_active.is_(True))
    if payload.role:
        statement = statement.where(User.role == payload.role)
    user = db.scalar(statement)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Demo account or password is incorrect")
    token = create_access_token(user_id=user.id, role=user.role.value)
    record_audit(db, actor=user, action="demo_login", entity_type="user", entity_id=user.id)
    _commit(db)
    return success(AuthData(access_token=token, expires_in=settings.access_token_expire_minutes * 60,
                            user=UserRead.model_validate(user)), "Signed in to the fictional demo account")


@router.get("/users/me", tags=["users"])
def read_me(user: User = Depends(get_current_user)):
    return success(UserRead.model_validate(user))


@router.get("/workers", tags=["workers"])
def list_workers(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    workers = db.scalars(select(User).join(SupervisorAssignment, SupervisorAssignment.worker_id == User.id)
                         .where(SupervisorAssignment.supervisor_id == user.id, User.role == UserRole.WORKER)
                         .order_by(User.name)).all()
    return success([UserRead.model_validate(worker) for worker in workers])


@router.post("/workers", status_code=status.HTTP_201_CREATED, tags=["workers"])
def create_worker(payload: WorkerCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    worker = User(name=payload.name, worker_id=payload.worker_id, email=payload.email,
                  password_hash=hash_password(payload.password),
                  role=UserRole.WORKER, preferred_language=payload.preferred_language)
    db.add(worker)
    _flush(db)
    db.add(SupervisorAssignment(supervisor_id=user.id, worker_id=worker.id))
    record_audit(db, actor=user, action="worker_created", entity_type="user", entity_id=worker.id)
    _commit(db)
    return success(UserRead.model_validate(worker), "Fictional worker created")


@router.get("/workers/{worker_id}", tags=["workers"])
def get_worker(worker_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_worker_access(db, user, worker_id)
    worker = _get_or_404(db, User, worker_id, "Worker")
    if worker.role != UserRole.WORKER:
        raise HTTPException(status_code=404, detail="Worker was not found")
    return success(UserRead.model_validate(worker))


@router.get("/permits", tags=["permits"])
def list_permits(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                 worker_id: int | None = Query(default=None)):
    statement = select(Permit).order_by(Permit.created_at.desc())
    if user.role == UserRole.WORKER:
        statement = statement.where(Permit.worker_id == user.id)
    elif worker_id is not None:
        require_worker_access(db, user, worker_id)
        statement = statement.where(Permit.worker_id == worker_id)
    else:
        statement = statement.join(SupervisorAssignment, SupervisorAssignment.worker_id == Permit.worker_id).where(
            SupervisorAssignment.supervisor_id == user.id)
    return success([PermitRead.model_validate(item) for item in db.scalars(statement).unique().all()])


@router.post("/permits", status_code=status.HTTP_201_CREATED, tags=["permits"])
def create_permit(payload: PermitCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    require_worker_access(db, user, payload.worker_id)
    worker = _get_or_404(db, User, payload.worker_id, "Worker")
    if worker.role != UserRole.WORKER:
        raise HTTPException(status_code=422, detail="A permit must be assigned to a worker account")
    start = _as_utc(payload.valid_from) if payload.valid_from else utc_now()
    end = _as_utc(payload.valid_until) if payload.valid_until else None
    if end and end <= start:
        raise HTTPException(status_code=422, detail="Permit expiry must be later than its start")
    permit = Permit(permit_number=payload.permit_number, worker_id=worker.id, task_type=payload.task_type,
                    work_location=payload.work_location, status=PermitStatus.DRAFT, valid_from=start,
                    valid_until=end)
    db.add(permit)
    _flush(db)
    record_audit(db, actor=user, action="permit_created_as_draft", entity_type="permit", entity_id=permit.id)
    _commit(db)
    return success(PermitRead.model_validate(permit), "Permit created as draft")


@router.get("/permits/{permit_id}", tags=["permits"])
def get_permit(permit_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    permit = get_scoped_permit(db, user, permit_id)
    return success(PermitRead.model_validate(permit))


@router.patch("/permits/{permit_id}/status", tags=["permits"])
def update_permit_status(permit_id: int, payload: PermitStatusUpdate, db: Session = Depends(get_db),
                         user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    permit = get_scoped_permit(db, user, permit_id)
    if payload.status not in (PermitStatus.SUSPENDED, PermitStatus.CLOSED):
        raise HTTPException(status_code=409, detail="This demo API cannot activate or clear a permit")
    permit.status = payload.status
    record_audit(db, actor=user, action="permit_status_changed", entity_type="permit", entity_id=permit.id,
                 details={"status": payload.status.value})
    _commit(db)
    return success(PermitRead.model_validate(permit))


@router.get("/instructions", tags=["safety instructions"])
def list_instructions(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                      permit_id: int | None = Query(default=None), language: str | None = Query(default=None)):
    statement = select(SafetyInstruction).options(selectinload(SafetyInstruction.questions)).order_by(
        SafetyInstruction.task_type, SafetyInstruction.language, SafetyInstruction.version.desc())
    if user.role == UserRole.WORKER:
        if permit_id is None:
            raise HTTPException(status_code=422, detail="permit_id is required for workers")
        permit = get_scoped_permit(db, user, permit_id, active=True)
        statement = statement.where(SafetyInstruction.task_type == permit.task_type,
                                    SafetyInstruction.approval_status == ApprovalStatus.PUBLISHED)
    else:
        statement = statement.join(Permit, Permit.task_type == SafetyInstruction.task_type).join(
            SupervisorAssignment, SupervisorAssignment.worker_id == Permit.worker_id).where(
                SupervisorAssignment.supervisor_id == user.id)
    if language:
        statement = statement.where(SafetyInstruction.language == language)
    records = db.scalars(statement).unique().all()
    if user.role == UserRole.WORKER:
        return success([_worker_instruction(item) for item in records])
    return success([InstructionRead.model_validate(item) for item in records])


@router.post("/instructions", status_code=status.HTTP_201_CREATED, tags=["safety instructions"])
def create_instruction(payload: InstructionCreate, db: Session = Depends(get_db),
                       user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    if any(question.language != payload.language for question in payload.questions):
        raise HTTPException(status_code=422, detail="Question language must match the instruction language")
    instruction = SafetyInstruction(task_type=payload.task_type, title=payload.title, content=payload.content,
                                    language=payload.language, version=payload.version,
                                    approval_status=ApprovalStatus.DRAFT)
    instruction.questions = [SafetyQuestion(**question.model_dump(), version=payload.version)
                             for question in payload.questions]
    db.add(instruction)
    _flush(db)
    record_audit(db, actor=user, action="instruction_draft_created", entity_type="instruction", entity_id=instruction.id)
    _commit(db)
    return success(InstructionRead.model_validate(instruction), "Instruction saved as draft; it is not available to workers")


@router.get("/instructions/{instruction_id}", tags=["safety instructions"])
def get_instruction(instruction_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    instruction = db.scalar(select(SafetyInstruction).options(selectinload(SafetyInstruction.questions))
                             .where(SafetyInstruction.id == instruction_id))
    if instruction is None:
        raise HTTPException(status_code=404, detail="Instruction was not found")
    if user.role == UserRole.WORKER:
        now = utc_now()
        owns = db.scalar(select(Permit.id).where(
            Permit.worker_id == user.id,
            Permit.task_type == instruction.task_type,
            Permit.status == PermitStatus.ACTIVE,
            Permit.valid_from <= now,
            or_(Permit.valid_until.is_(None), Permit.valid_until >= now),
        ))
        if not owns or instruction.approval_status != ApprovalStatus.PUBLISHED:
            raise HTTPException(status_code=404, detail="Published instruction was not found")
        return success(_worker_instruction(instruction))
    assigned = db.scalar(select(Permit.id).join(SupervisorAssignment, SupervisorAssignment.worker_id == Permit.worker_id)
                         .where(SupervisorAssignment.supervisor_id == user.id, Permit.task_type == instruction.task_type))
    if not assigned:
        raise HTTPException(status_code=404, detail="Instruction was not found")
    return success(InstructionRead.model_validate(instruction))


def _change_instruction_state(instruction_id: int, target: ApprovalStatus, db: Session, user: User):
    instruction = _get_or_404(db, SafetyInstruction, instruction_id, "Instruction")
    if target == ApprovalStatus.APPROVED and instruction.approval_status != ApprovalStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only a draft can be approved")
    if target == ApprovalStatus.APPROVED and not instruction.questions:
        raise HTTPException(status_code=409, detail="Add at least one reviewed question before approval")
    if target == ApprovalStatus.PUBLISHED and instruction.approval_status != ApprovalStatus.APPROVED:
        raise HTTPException(status_code=409, detail="Only approved content can be published")
    if not db.scalar(select(Permit.id).join(SupervisorAssignment, SupervisorAssignment.worker_id == Permit.worker_id)
                     .where(SupervisorAssignment.supervisor_id == user.id, Permit.task_type == instruction.task_type)):
        raise HTTPException(status_code=404, detail="Instruction was not found")
    instruction.approval_status = target
    if target == ApprovalStatus.APPROVED:
        instruction.approved_by = user.id
    if target == ApprovalStatus.PUBLISHED:
        instruction.published_at = utc_now()
    record_audit(db, actor=user, action=f"instruction_{target.value}", entity_type="instruction",
                 entity_id=instruction.id, details={"version": instruction.version, "language": instruction.language})
    _commit(db)
    return success(InstructionRead.model_validate(instruction), f"Instruction {target.value}")


@router.post("/instructions/{instruction_id}/approve", tags=["safety instructions"])
def approve_instruction(instruction_id: int, db: Session = Depends(get_db),
                        user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    return _change_instruction_state(instruction_id, ApprovalStatus.APPROVED, db, user)


@router.post("/instructions/{instruction_id}/publish", tags=["safety instructions"])
def publish_instruction(instruction_id: int, db: Session = Depends(get_db),
                        user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    return _change_instruction_state(instruction_id, ApprovalStatus.PUBLISHED, db, user)


@router.post("/briefings", status_code=status.HTTP_201_CREATED, tags=["briefings"])
def start_briefing(payload: BriefingStart, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(UserRole.WORKER))):
    permit = get_scoped_permit(db, user, payload.permit_id, active=True)
    instruction = db.scalar(select(SafetyInstruction).options(selectinload(SafetyInstruction.questions)).where(
        SafetyInstruction.task_type == permit.task_type,
        SafetyInstruction.language == payload.language,
        SafetyInstruction.approval_status == ApprovalStatus.PUBLISHED,
    ).order_by(SafetyInstruction.version.desc()).limit(1))
    if instruction is None:
        raise HTTPException(status_code=409, detail="No approved published instruction is available for this permit and language")
    briefing = BriefingSession(worker_id=user.id, permit_id=permit.id, instruction_id=instruction.id,
                              instruction_version=instruction.version, status=BriefingStatus.STARTED)
    db.add(briefing)
    _flush(db)
    record_audit(db, actor=user, action="briefing_started", entity_type="briefing", entity_id=briefing.id,
                 details={"instruction_version": instruction.version})
    _commit(db)
    return success({"briefing": BriefingRead.model_validate(briefing).model_dump(mode="json"),
                    "instruction": _worker_instruction(instruction).model_dump(mode="json")}, "Briefing started")


def _scoped_briefing(db: Session, user: User, session_id: int) -> BriefingSession:
    briefing = _get_or_404(db, BriefingSession, session_id, "Briefing")
    require_worker_access(db, user, briefing.worker_id)
    return briefing


@router.get("/briefings/{session_id}", tags=["briefings"])
def get_briefing(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    briefing = _scoped_briefing(db, user, session_id)
    instruction = db.scalar(select(SafetyInstruction).options(selectinload(SafetyInstruction.questions))
                             .where(SafetyInstruction.id == briefing.instruction_id))
    payload: dict[str, object] = {"briefing": BriefingRead.model_validate(briefing).model_dump(mode="json")}
    if instruction:
        payload["instruction"] = (_worker_instruction(instruction).model_dump(mode="json") if user.role == UserRole.WORKER
                                   else InstructionRead.model_validate(instruction).model_dump(mode="json"))
    return success(payload)


@router.patch("/briefings/{session_id}/progress", tags=["briefings"])
def update_briefing_progress(session_id: int, payload: BriefingProgress, db: Session = Depends(get_db),
                             user: User = Depends(require_roles(UserRole.WORKER))):
    briefing = _scoped_briefing(db, user, session_id)
    if briefing.status in (BriefingStatus.COMPLETED, BriefingStatus.SUPERVISOR_REVIEW):
        raise HTTPException(status_code=409, detail="This briefing is already complete or awaiting review")
    if payload.current_step < briefing.current_step:
        raise HTTPException(status_code=409, detail="Briefing progress cannot move backwards")
    briefing.current_step = 100 if payload.completed else payload.current_step
    # Reading progress alone does not count as a passing assessment.
    briefing.status = BriefingStatus.IN_PROGRESS
    _commit(db)
    return success(BriefingRead.model_validate(briefing))


@router.post("/briefings/{session_id}/assessments", status_code=status.HTTP_201_CREATED, tags=["assessments"])
def submit_assessment(session_id: int, payload: AssessmentSubmit, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(UserRole.WORKER))):
    briefing = _scoped_briefing(db, user, session_id)
    if briefing.status in (BriefingStatus.COMPLETED, BriefingStatus.SUPERVISOR_REVIEW):
        raise HTTPException(status_code=409, detail="Assessment is closed for this briefing")
    if briefing.current_step < 100:
        raise HTTPException(status_code=409, detail="Review all instruction sections before the assessment")
    question = db.scalar(select(SafetyQuestion).join(SafetyInstruction).where(
        SafetyQuestion.id == payload.question_id,
        SafetyQuestion.instruction_id == briefing.instruction_id,
        SafetyInstruction.version == briefing.instruction_version,
        SafetyInstruction.approval_status == ApprovalStatus.PUBLISHED,
    ))
    if question is None:
        raise HTTPException(status_code=404, detail="Question is not part of this published briefing")
    previous = db.scalar(select(func.max(AssessmentResult.attempt_count)).where(
        AssessmentResult.session_id == briefing.id, AssessmentResult.question_id == question.id)) or 0
    already_correct = db.scalar(select(AssessmentResult.id).where(
        AssessmentResult.session_id == briefing.id,
        AssessmentResult.question_id == question.id,
        AssessmentResult.result == AssessmentResultStatus.CORRECT,
    ))
    if already_correct:
        raise HTTPException(status_code=409, detail="This question has already been answered correctly")
    if previous >= 3:
        raise HTTPException(status_code=409, detail="The three permitted attempts have been used")
    attempt = previous + 1
    accepted = {_normalise_answer(question.expected_answer), *(_normalise_answer(item) for item in question.acceptable_answers)}
    answer = _normalise_answer(payload.answer)
    outcome = AssessmentResultStatus.UNCLEAR if not answer else (
        AssessmentResultStatus.CORRECT if answer in accepted else AssessmentResultStatus.INCORRECT)
    result = AssessmentResult(session_id=briefing.id, worker_id=user.id, permit_id=briefing.permit_id,
                             question_id=question.id, question_version=question.version,
                             worker_answer=payload.answer, result=outcome, attempt_count=attempt)
    db.add(result)
    record_audit(db, actor=user, action="assessment_answer_recorded", entity_type="assessment",
                 details={"session_id": briefing.id, "question_id": question.id,
                          "attempt": attempt, "result": outcome.value})
    if outcome != AssessmentResultStatus.CORRECT and attempt >= 3:
        briefing.status = BriefingStatus.SUPERVISOR_REVIEW
    elif outcome == AssessmentResultStatus.CORRECT:
        required_ids = set(db.scalars(select(SafetyQuestion.id).where(
            SafetyQuestion.instruction_id == briefing.instruction_id)).all())
        latest = {}
        for row in db.scalars(select(AssessmentResult).where(AssessmentResult.session_id == briefing.id)
                              .order_by(AssessmentResult.created_at)).all():
            latest[row.question_id] = row.result
        if required_ids and all(latest.get(question_id) == AssessmentResultStatus.CORRECT
                                for question_id in required_ids if question_id != question.id):
            latest[question.id] = AssessmentResultStatus.CORRECT
            if all(latest.get(question_id) == AssessmentResultStatus.CORRECT for question_id in required_ids):
                briefing.status = BriefingStatus.COMPLETED
                briefing.completed_at = utc_now()
    _commit(db)
    return success(AssessmentRead.model_validate(result), f"Answer recorded as {outcome.value}")


@router.get("/assessments", tags=["assessments"])
def list_assessments(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                     worker_id: int | None = Query(default=None), pending_review: bool = False):
    statement = select(AssessmentResult).order_by(AssessmentResult.created_at.desc())
    if user.role == UserRole.WORKER:
        statement = statement.where(AssessmentResult.worker_id == user.id)
    else:
        statement = statement.join(SupervisorAssignment, SupervisorAssignment.worker_id == AssessmentResult.worker_id).where(
            SupervisorAssignment.supervisor_id == user.id)
        if worker_id is not None:
            require_worker_access(db, user, worker_id)
            statement = statement.where(AssessmentResult.worker_id == worker_id)
        if pending_review:
            statement = statement.join(BriefingSession, BriefingSession.id == AssessmentResult.session_id).where(
                BriefingSession.status == BriefingStatus.SUPERVISOR_REVIEW)
    return success([AssessmentRead.model_validate(row) for row in db.scalars(statement).unique().all()])


@router.post("/assessments/{assessment_id}/review", tags=["assessments"])
def review_assessment(assessment_id: int, payload: ReviewRequest, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    result = _get_or_404(db, AssessmentResult, assessment_id, "Assessment")
    require_worker_access(db, user, result.worker_id)
    result.reviewed_by = user.id
    record_audit(db, actor=user, action="assessment_reviewed", entity_type="assessment", entity_id=result.id,
                 details={"note": payload.note, "outcome": result.result.value})
    _commit(db)
    return success(AssessmentRead.model_validate(result), "Assessment review recorded; no safety authorization is implied")


@router.post("/hazards", status_code=status.HTTP_201_CREATED, tags=["hazards"])
def create_hazard(payload: HazardCreate, idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=128),
                  db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.WORKER))):
    existing = db.scalar(select(HazardReport).where(HazardReport.idempotency_key == idempotency_key))
    if existing:
        if existing.worker_id != user.id:
            raise HTTPException(status_code=409, detail="Idempotency key is already associated with another account")
        return success(HazardRead.model_validate(existing), "Existing hazard report returned for safe retry")
    permit = get_scoped_permit(db, user, payload.permit_id, active=True) if payload.permit_id is not None else None
    hazard = HazardReport(worker_id=user.id, permit_id=permit.id if permit else None, category=payload.category,
                          description=payload.description, location=payload.location, transcript=payload.transcript,
                          idempotency_key=idempotency_key, status=HazardStatus.SUBMITTED)
    db.add(hazard)
    _flush(db)
    record_audit(db, actor=user, action="hazard_submitted", entity_type="hazard", entity_id=hazard.id)
    _commit(db)
    return success(HazardRead.model_validate(hazard), "Hazard report persisted")


@router.get("/hazards", tags=["hazards"])
def list_hazards(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                 worker_id: int | None = Query(default=None), status_filter: HazardStatus | None = Query(default=None)):
    statement = select(HazardReport).order_by(HazardReport.created_at.desc())
    if user.role == UserRole.WORKER:
        statement = statement.where(HazardReport.worker_id == user.id)
    else:
        statement = statement.join(SupervisorAssignment, SupervisorAssignment.worker_id == HazardReport.worker_id).where(
            SupervisorAssignment.supervisor_id == user.id)
        if worker_id is not None:
            require_worker_access(db, user, worker_id)
            statement = statement.where(HazardReport.worker_id == worker_id)
    if status_filter:
        statement = statement.where(HazardReport.status == status_filter)
    return success([HazardRead.model_validate(row) for row in db.scalars(statement).unique().all()])


@router.get("/hazards/{hazard_id}", tags=["hazards"])
def get_hazard(hazard_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hazard = _get_or_404(db, HazardReport, hazard_id, "Hazard")
    require_worker_access(db, user, hazard.worker_id)
    return success(HazardRead.model_validate(hazard))


@router.post("/hazards/{hazard_id}/acknowledge", tags=["hazards"])
def acknowledge_hazard(hazard_id: int, payload: HazardNoteCreate | None = None, db: Session = Depends(get_db),
                       user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    hazard = _get_or_404(db, HazardReport, hazard_id, "Hazard")
    require_worker_access(db, user, hazard.worker_id)
    if hazard.status == HazardStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Closed reports cannot be acknowledged")
    if hazard.status != HazardStatus.ACKNOWLEDGED:
        hazard.status = HazardStatus.ACKNOWLEDGED
        hazard.acknowledged_by = user.id
        hazard.acknowledged_at = utc_now()
    if payload and payload.note:
        db.add(HazardNote(hazard_id=hazard.id, author_id=user.id, note=payload.note))
    record_audit(db, actor=user, action="hazard_acknowledged", entity_type="hazard", entity_id=hazard.id)
    _commit(db)
    return success(HazardRead.model_validate(hazard), "Hazard acknowledgement persisted")


@router.post("/hazards/{hazard_id}/notes", status_code=status.HTTP_201_CREATED, tags=["hazards"])
def add_hazard_note(hazard_id: int, payload: HazardNoteCreate, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    hazard = _get_or_404(db, HazardReport, hazard_id, "Hazard")
    require_worker_access(db, user, hazard.worker_id)
    note = HazardNote(hazard_id=hazard.id, author_id=user.id, note=payload.note)
    db.add(note)
    record_audit(db, actor=user, action="hazard_note_added", entity_type="hazard", entity_id=hazard.id)
    _commit(db)
    return success(HazardNoteRead.model_validate(note), "Note saved")


@router.get("/hazards/{hazard_id}/notes", tags=["hazards"])
def list_hazard_notes(hazard_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hazard = _get_or_404(db, HazardReport, hazard_id, "Hazard")
    require_worker_access(db, user, hazard.worker_id)
    rows = db.scalars(select(HazardNote).where(HazardNote.hazard_id == hazard.id).order_by(HazardNote.created_at)).all()
    return success([HazardNoteRead.model_validate(note) for note in rows])


@router.post("/emergency/sos", status_code=status.HTTP_201_CREATED, tags=["simulated SOS"])
def create_sos(payload: EmergencyCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.WORKER))):
    permit = get_scoped_permit(db, user, payload.permit_id, active=True) if payload.permit_id is not None else None
    record = EmergencyRecord(worker_id=user.id, permit_id=permit.id if permit else None,
                             emergency_type=payload.emergency_type, location=payload.location,
                             status=EmergencyStatus.SUBMITTED, is_simulated=True)
    db.add(record)
    _flush(db)
    record_audit(db, actor=user, action="simulated_sos_created", entity_type="emergency", entity_id=record.id)
    _commit(db)
    return success(EmergencyRead.model_validate(record), "Simulated SOS saved for the demo supervisor; no emergency services were contacted")


@router.get("/emergency", tags=["simulated SOS"])
def list_emergencies(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                     worker_id: int | None = Query(default=None)):
    statement = select(EmergencyRecord).order_by(EmergencyRecord.created_at.desc())
    if user.role == UserRole.WORKER:
        statement = statement.where(EmergencyRecord.worker_id == user.id)
    else:
        statement = statement.join(SupervisorAssignment, SupervisorAssignment.worker_id == EmergencyRecord.worker_id).where(
            SupervisorAssignment.supervisor_id == user.id)
        if worker_id is not None:
            require_worker_access(db, user, worker_id)
            statement = statement.where(EmergencyRecord.worker_id == worker_id)
    return success([EmergencyRead.model_validate(row) for row in db.scalars(statement).unique().all()])


@router.post("/emergency/{emergency_id}/acknowledge", tags=["simulated SOS"])
def acknowledge_sos(emergency_id: int, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    record = _get_or_404(db, EmergencyRecord, emergency_id, "SOS record")
    require_worker_access(db, user, record.worker_id)
    if record.status != EmergencyStatus.ACKNOWLEDGED:
        record.status = EmergencyStatus.ACKNOWLEDGED
        record.acknowledged_by = user.id
        record.acknowledged_at = utc_now()
        record_audit(db, actor=user, action="simulated_sos_acknowledged", entity_type="emergency", entity_id=record.id)
        _commit(db)
    return success(EmergencyRead.model_validate(record), "Simulated SOS acknowledgement persisted")


@router.get("/supervisor/overview", tags=["supervisor"])
def supervisor_overview(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.SUPERVISOR))):
    worker_ids = select(SupervisorAssignment.worker_id).where(SupervisorAssignment.supervisor_id == user.id)
    assigned_count = db.scalar(select(func.count()).select_from(SupervisorAssignment).where(
        SupervisorAssignment.supervisor_id == user.id)) or 0
    open_hazards = db.scalar(select(func.count()).select_from(HazardReport).where(
        HazardReport.worker_id.in_(worker_ids), HazardReport.status == HazardStatus.SUBMITTED)) or 0
    pending = db.scalar(select(func.count()).select_from(BriefingSession).where(
        BriefingSession.worker_id.in_(worker_ids), BriefingSession.status == BriefingStatus.SUPERVISOR_REVIEW)) or 0
    open_sos = db.scalar(select(func.count()).select_from(EmergencyRecord).where(
        EmergencyRecord.worker_id.in_(worker_ids), EmergencyRecord.status == EmergencyStatus.SUBMITTED)) or 0
    return success(SupervisorOverview(assigned_workers=assigned_count, open_hazards=open_hazards,
                                      pending_assessments=pending, open_simulated_sos=open_sos))


@router.get("/audit", tags=["audit"])
def list_audit_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                    limit: int = Query(default=100, ge=1, le=500)):
    statement = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if user.role == UserRole.WORKER:
        statement = statement.where(AuditLog.user_id == user.id)
    else:
        worker_ids = select(SupervisorAssignment.worker_id).where(SupervisorAssignment.supervisor_id == user.id)
        statement = statement.where((AuditLog.user_id == user.id) | AuditLog.user_id.in_(worker_ids))
    return success([AuditRead.model_validate(row) for row in db.scalars(statement).all()])
