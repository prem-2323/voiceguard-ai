from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing_extensions import Annotated

from app.api.dependencies import require_roles
from app.core.database import get_db
from app.models import BriefingSession, Permit, SafetyInstruction, User
from app.models.enums import ApprovalStatus, UserRole
from app.schemas import success
from app.services.authorization import get_scoped_permit
from app.services.intelligence import Language, interpret_text

router = APIRouter(tags=["multilingual intelligence"])


class InterpretRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: Annotated[str, StringConstraints(min_length=1, max_length=4000)]
    language: Language
    context: Literal["general", "briefing", "hazard"] = "general"
    permit_number: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=40)] | None = None
    briefing_session_id: int | None = None


@router.post("/intelligence/interpret")
def interpret_command(payload: InterpretRequest, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(UserRole.WORKER))):
    result = interpret_text(payload.text, payload.language, payload.context)
    if payload.context == "briefing" and result["intent"] == "repeat_instruction":
        instruction = None
        if payload.permit_number:
            permit = db.scalar(select(Permit).where(Permit.permit_number == payload.permit_number))
            if permit is not None:
                permit = get_scoped_permit(db, user, permit.id, active=True)
                if payload.briefing_session_id is not None:
                    instruction = db.scalar(
                        select(SafetyInstruction)
                        .join(BriefingSession, BriefingSession.instruction_id == SafetyInstruction.id)
                        .where(
                            BriefingSession.id == payload.briefing_session_id,
                            BriefingSession.worker_id == user.id,
                            BriefingSession.permit_id == permit.id,
                            SafetyInstruction.language == payload.language,
                            SafetyInstruction.version == BriefingSession.instruction_version,
                            SafetyInstruction.approval_status == ApprovalStatus.PUBLISHED,
                        )
                    )
                else:
                    instruction = db.scalar(select(SafetyInstruction).where(
                        SafetyInstruction.task_type == permit.task_type,
                        SafetyInstruction.language == payload.language,
                        SafetyInstruction.approval_status == ApprovalStatus.PUBLISHED,
                    ).order_by(SafetyInstruction.version.desc()).limit(1))
        result["approved_instruction"] = ({
            "id": instruction.id,
            "title": instruction.title,
            "content": instruction.content,
            "language": instruction.language,
            "version": instruction.version,
        } if instruction else None)
        result["requires_supervisor_review"] = instruction is None
        repeat_messages = {
            "en": ("Repeating the approved instruction linked to your active permit.",
                   "No approved published instruction is available for this permit and language. Ask the supervisor for review."),
            "ta": ("உங்கள் செயலில் உள்ள அனுமதியுடன் இணைக்கப்பட்ட அங்கீகரிக்கப்பட்ட வழிமுறை மீண்டும் காட்டப்படுகிறது.",
                   "இந்த அனுமதி மற்றும் மொழிக்கான அங்கீகரிக்கப்பட்ட வெளியிடப்பட்ட வழிமுறை இல்லை. மேற்பார்வையாளரிடம் மதிப்பாய்வு கேளுங்கள்."),
            "hi": ("आपके सक्रिय परमिट से जुड़ा स्वीकृत निर्देश दोहराया जा रहा है।",
                   "इस परमिट और भाषा के लिए कोई स्वीकृत प्रकाशित निर्देश नहीं है। समीक्षा के लिए सुपरवाइज़र से पूछें।"),
        }
        result["message"] = repeat_messages[payload.language][0 if instruction else 1]
    return success(result, "Command parsed with deterministic rules")
