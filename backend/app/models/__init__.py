"""SQLAlchemy model registry used to create the SQLite schema."""

from app.models.assessment import AssessmentResult
from app.models.audit import AuditLog
from app.models.briefing import BriefingSession
from app.models.emergency import EmergencyRecord, EmergencyRequestKey
from app.models.hazard import HazardNote, HazardReport
from app.models.instruction import SafetyInstruction, SafetyQuestion
from app.models.permit import Permit
from app.models.user import SupervisorAssignment, User

__all__ = [
    "AssessmentResult",
    "AuditLog",
    "BriefingSession",
    "EmergencyRecord",
    "EmergencyRequestKey",
    "HazardNote",
    "HazardReport",
    "Permit",
    "SafetyInstruction",
    "SafetyQuestion",
    "SupervisorAssignment",
    "User",
]
