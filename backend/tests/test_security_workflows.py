from datetime import timedelta

import pytest
from fastapi import WebSocketDisconnect
from jose import jwt
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings, settings
from app.core.security import hash_password, verify_password
from app.core.time import utc_now
from app.models import AssessmentResult, AuditLog, BriefingSession, EmergencyRecord, HazardReport, Permit, SafetyInstruction, SafetyQuestion, User
from app.models.enums import ApprovalStatus, AssessmentResultStatus, BriefingStatus, PermitStatus


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_role_enforcement_and_assignment_boundaries(system):
    client = system["client"]
    ids = system["ids"]
    tokens = system["tokens"]

    legacy_demo_login = client.post("/api/auth/demo-login", json={
        "worker_id": "WRK-TEST-1", "password": "test-password-123",
    })
    assert legacy_demo_login.status_code == 404

    wrong_role = client.post("/api/auth/login", json={
        "worker_id": "WRK-TEST-1", "password": "test-password-123", "role": "supervisor",
    })
    assert wrong_role.status_code == 401

    worker_login = client.post("/api/auth/login", json={"worker_id": "WRK-TEST-1", "password": "test-password-123"})
    assert worker_login.status_code == 200
    assert "password_hash" not in worker_login.json()["data"]["user"]

    assert client.get("/api/workers", headers=auth(tokens["worker"])).status_code == 403
    assigned_workers = client.get("/api/workers", headers=auth(tokens["supervisor"]))
    assert [worker["id"] for worker in assigned_workers.json()["data"]] == [ids["worker"]]
    assert client.get(f"/api/workers/{ids['other_worker']}", headers=auth(tokens["supervisor"])).status_code == 404
    assert client.get(f"/api/workers/{ids['other_worker']}", headers=auth(tokens["worker"])).status_code == 404


def test_sos_is_idempotent_scoped_and_audited(system):
    client = system["client"]
    ids = system["ids"]
    tokens = system["tokens"]
    payload = {"permit_id": ids["permit"], "emergency_type": "sos", "location": "Test Bay"}
    worker_headers = auth(tokens["worker"])
    key_header = {"Idempotency-Key": "test-sos-request-key-0001"}

    missing_key = client.post("/api/emergency/sos", json=payload, headers=worker_headers)
    assert missing_key.status_code == 422

    first = client.post("/api/emergency/sos", json=payload, headers={**worker_headers, **key_header})
    retry = client.post("/api/emergency/sos", json=payload, headers={**worker_headers, **key_header})
    assert first.status_code == 201
    assert retry.status_code == 200
    event_id = first.json()["data"]["id"]
    assert retry.json()["data"]["id"] == event_id
    assert first.json()["data"]["is_simulated"] is True

    own_records = client.get("/api/emergency", headers=worker_headers).json()["data"]
    assert [record["id"] for record in own_records] == [event_id]
    outsider_records = client.get("/api/emergency", headers=auth(tokens["other_supervisor"])).json()["data"]
    assert outsider_records == []
    assert client.post(f"/api/emergency/{event_id}/acknowledge", headers=auth(tokens["other_supervisor"])).status_code == 404
    assert client.post(f"/api/emergency/{event_id}/acknowledge", headers=worker_headers).status_code == 403

    acknowledged = client.post(f"/api/emergency/{event_id}/acknowledge", headers=auth(tokens["supervisor"]))
    assert acknowledged.status_code == 200
    assert acknowledged.json()["data"]["status"] == "acknowledged"
    worker_status = client.get("/api/emergency", headers=worker_headers).json()["data"][0]
    assert worker_status["acknowledged_by"] == ids["supervisor"]
    assert worker_status["acknowledged_at"] is not None

    audit = client.get("/api/audit", headers=auth(tokens["supervisor"])).json()["data"]
    actions = [entry["action"] for entry in audit]
    assert actions.count("simulated_sos_created") == 1
    assert actions.count("simulated_sos_acknowledged") == 1

    with system["sessions"]() as db:
        assert db.scalar(select(func.count()).select_from(EmergencyRecord)) == 1
        audit_count = db.scalar(select(func.count()).select_from(AuditLog).where(
            AuditLog.action == "simulated_sos_created", AuditLog.entity_id == event_id,
        ))
        assert audit_count == 1


def test_hazard_retry_review_and_worker_status_are_persisted(system):
    client = system["client"]
    ids = system["ids"]
    tokens = system["tokens"]
    worker_login = client.post("/api/auth/login", json={
        "worker_id": "WRK-TEST-1", "password": "test-password-123",
    })
    supervisor_login = client.post("/api/auth/login", json={
        "worker_id": "SUP-TEST-1", "password": "test-password-123",
    })
    assert worker_login.status_code == 200
    assert supervisor_login.status_code == 200
    worker_headers = auth(worker_login.json()["data"]["access_token"])
    supervisor_headers = auth(supervisor_login.json()["data"]["access_token"])
    worker_permits = client.get("/api/permits", headers=worker_headers).json()["data"]
    assert [permit["id"] for permit in worker_permits] == [ids["permit"]]
    assert worker_permits[0]["status"] == "active"
    payload = {
        "permit_id": ids["permit"],
        "category": "oil_leak",
        "description": "Oil is visible near the pump.",
        "location": "Test Bay",
        "transcript": "Oil near pump",
        "confirmed": True,
    }
    key_headers = {"Idempotency-Key": "test-hazard-request-key-0001"}

    assert client.post("/api/hazards", json=payload, headers=key_headers).status_code == 401
    assert client.post("/api/hazards", json={**payload, "confirmed": False},
                       headers={**worker_headers, **key_headers}).status_code == 422
    assert client.post("/api/hazards", json={key: value for key, value in payload.items() if key != "permit_id"},
                       headers={**worker_headers, **key_headers}).status_code == 422

    created = client.post("/api/hazards", json=payload, headers={**worker_headers, **key_headers})
    retried = client.post("/api/hazards", json=payload, headers={**worker_headers, **key_headers})
    assert created.status_code == 201
    assert retried.status_code == 201
    hazard_id = created.json()["data"]["id"]
    assert retried.json()["data"]["id"] == hazard_id
    assert client.post("/api/hazards", json=payload,
                       headers={**auth(tokens["other_worker"]), **key_headers}).status_code == 409
    assert client.post("/api/hazards", json={**payload, "location": "Unassigned Bay"},
                       headers={**auth(tokens["other_worker"]),
                                "Idempotency-Key": "unassigned-hazard-request-key"}).status_code == 404
    assert client.get(f"/api/hazards/{hazard_id}").status_code == 401

    visible_to_assigned = client.get("/api/hazards", headers=supervisor_headers).json()["data"]
    hidden_from_unassigned = client.get("/api/hazards", headers=auth(tokens["other_supervisor"])).json()["data"]
    assert [item["id"] for item in visible_to_assigned] == [hazard_id]
    assert hidden_from_unassigned == []
    supervisor_detail = client.get(f"/api/hazards/{hazard_id}", headers=supervisor_headers)
    assert supervisor_detail.status_code == 200
    assert supervisor_detail.json()["data"]["permit_id"] == ids["permit"]
    assert supervisor_detail.json()["data"]["description"] == payload["description"]
    assert client.get(f"/api/hazards/{hazard_id}", headers=auth(tokens["other_supervisor"])).status_code == 404
    assert client.post(f"/api/hazards/{hazard_id}/acknowledge", json={"note": "Checked"},
                       headers=auth(tokens["other_supervisor"])).status_code == 404
    assert client.post(f"/api/hazards/{hazard_id}/acknowledge", json={"note": "Not allowed"},
                       headers=worker_headers).status_code == 403

    acknowledged = client.post(f"/api/hazards/{hazard_id}/acknowledge", json={"note": "Received for review"},
                               headers=supervisor_headers)
    assert acknowledged.status_code == 200
    assert acknowledged.json()["data"]["status"] == "acknowledged"
    note_rows = client.get(f"/api/hazards/{hazard_id}/notes", headers=worker_headers).json()["data"]
    assert note_rows[0]["note"] == "Received for review"
    worker_status = client.get("/api/hazards", headers=worker_headers).json()["data"][0]
    assert worker_status["acknowledged_by"] == ids["supervisor"]
    assert worker_status["acknowledged_at"] is not None
    worker_detail = client.get(f"/api/hazards/{hazard_id}", headers=worker_headers)
    assert worker_detail.status_code == 200
    assert worker_detail.json()["data"]["status"] == "acknowledged"
    assert worker_detail.json()["data"]["acknowledged_by"] == ids["supervisor"]

    audit = client.get("/api/audit", headers=supervisor_headers).json()["data"]
    report_audit = [entry for entry in audit if entry["entity_type"] == "hazard" and entry["entity_id"] == hazard_id]
    assert {(entry["action"], entry["user_id"]) for entry in report_audit} == {
        ("hazard_submitted", ids["worker"]),
        ("hazard_acknowledged", ids["supervisor"]),
    }

    with system["sessions"]() as db:
        persisted = db.get(HazardReport, hazard_id)
        assert persisted is not None
        assert persisted.worker_id == ids["worker"]
        assert persisted.permit_id == ids["permit"]
        assert persisted.status.value == "acknowledged"
        assert db.scalar(select(func.count()).select_from(HazardReport)) == 1
        persisted_audit = db.scalars(select(AuditLog).where(
            AuditLog.entity_type == "hazard", AuditLog.entity_id == hazard_id,
        )).all()
        assert {(row.action, row.user_id) for row in persisted_audit} == {
            ("hazard_submitted", ids["worker"]),
            ("hazard_acknowledged", ids["supervisor"]),
        }


def test_approved_instruction_gate_and_assessment_attempt_history(system):
    client = system["client"]
    ids = system["ids"]
    tokens = system["tokens"]
    worker_headers = auth(tokens["worker"])
    supervisor_headers = auth(tokens["supervisor"])
    fixture_content = "TEST FIXTURE ONLY — not approved safety guidance."
    fixture_question = "TEST FIXTURE ONLY — which phrase was in this test fixture?"

    draft = client.post("/api/instructions", headers=supervisor_headers, json={
        "task_type": "Maintenance",
        "title": "Isolated approval-gate test fixture",
        "content": fixture_content,
        "language": "ta",
        "version": 7,
        "questions": [{
            "question": fixture_question,
            "expected_answer": "fixture phrase",
            "acceptable_answers": ["the fixture phrase"],
            "language": "ta",
        }],
    })
    assert draft.status_code == 201
    instruction_id = draft.json()["data"]["id"]
    assert draft.json()["data"]["approval_status"] == "draft"

    assert client.get("/api/instructions", params={"permit_id": ids["permit"], "language": "ta"},
                      headers=worker_headers).json()["data"] == []
    assert client.post("/api/briefings", headers=worker_headers,
                       json={"permit_id": ids["permit"], "language": "ta"}).status_code == 409
    assert client.post(f"/api/instructions/{instruction_id}/publish", headers=supervisor_headers).status_code == 409

    approved = client.post(f"/api/instructions/{instruction_id}/approve", headers=supervisor_headers)
    assert approved.status_code == 200
    assert client.get("/api/instructions", params={"permit_id": ids["permit"], "language": "ta"},
                      headers=worker_headers).json()["data"] == []
    published = client.post(f"/api/instructions/{instruction_id}/publish", headers=supervisor_headers)
    assert published.status_code == 200
    assert published.json()["data"]["approval_status"] == "published"

    worker_instruction = client.get("/api/instructions", params={"permit_id": ids["permit"], "language": "ta"},
                                    headers=worker_headers).json()["data"]
    assert len(worker_instruction) == 1
    assert worker_instruction[0]["version"] == 7
    assert "expected_answer" not in worker_instruction[0]["questions"][0]

    briefing_response = client.post("/api/briefings", headers=worker_headers,
                                    json={"permit_id": ids["permit"], "language": "ta"})
    assert briefing_response.status_code == 201
    briefing = briefing_response.json()["data"]["briefing"]
    assert briefing["instruction_id"] == instruction_id
    assert briefing["instruction_version"] == 7
    completed_review = client.patch(f"/api/briefings/{briefing['id']}/progress", headers=worker_headers,
                                    json={"current_step": 100, "completed": True})
    assert completed_review.status_code == 200

    recorded = []
    for answer in ("எனக்கு தெரியவில்லை", "", "வேறு சோதனை பதில்"):
        response = client.post(f"/api/briefings/{briefing['id']}/assessments", headers=worker_headers,
                               json={"question_id": worker_instruction[0]["questions"][0]["id"], "answer": answer})
        assert response.status_code == 201
        recorded.append(response.json()["data"])

    assert [(item["result"], item["attempt_count"]) for item in recorded] == [
        ("incorrect", 1), ("unclear", 2), ("incorrect", 3),
    ]
    assert recorded[0]["worker_answer"] == "எனக்கு தெரியவில்லை"
    assert recorded[0]["question_version"] == 7
    session = client.get(f"/api/briefings/{briefing['id']}", headers=worker_headers).json()["data"]["briefing"]
    assert session["status"] == "supervisor_review"
    pending = client.get("/api/assessments", params={"pending_review": "true"},
                         headers=supervisor_headers).json()["data"]
    assert len(pending) == 1
    assert pending[0]["expected_answer"] == "fixture phrase"

    second_briefing_response = client.post("/api/briefings", headers=worker_headers,
                                           json={"permit_id": ids["permit"], "language": "ta"})
    second_briefing = second_briefing_response.json()["data"]["briefing"]
    assert client.patch(f"/api/briefings/{second_briefing['id']}/progress", headers=worker_headers,
                        json={"current_step": 100, "completed": True}).status_code == 200
    correct = client.post(f"/api/briefings/{second_briefing['id']}/assessments", headers=worker_headers,
                          json={"question_id": worker_instruction[0]["questions"][0]["id"],
                                "answer": "the fixture phrase"})
    assert correct.status_code == 201
    assert correct.json()["data"]["result"] == "correct"
    assert correct.json()["data"]["attempt_count"] == 1
    assert correct.json()["data"]["question_version"] == 7
    completed = client.get(f"/api/briefings/{second_briefing['id']}", headers=worker_headers).json()["data"]["briefing"]
    assert completed["status"] == "completed"
    assert completed["completed_at"] is not None


@pytest.mark.parametrize(("language", "text"), [
    ("ta", "நான் என்ன செய்ய வேண்டும்?"),
    ("en", "What should I do?"),
    ("hi", "मुझे क्या करना चाहिए?"),
])
def test_multilingual_safety_questions_are_routed_for_review(system, language, text):
    response = system["client"].post("/api/intelligence/interpret", headers=auth(system["tokens"]["worker"]), json={
        "text": text,
        "language": language,
        "context": "briefing",
    })
    assert response.status_code == 200
    result = response.json()["data"]
    assert result["intent"] == "safety_question"
    assert result["requires_supervisor_review"] is True
    assert result["approved_instruction"] is None


def test_supervisor_briefing_metrics_use_assigned_sessions_and_saved_timestamps(system):
    client = system["client"]
    ids = system["ids"]
    now = utc_now()
    with system["sessions"]() as db:
        instruction = SafetyInstruction(
            task_type="Maintenance",
            title="TEST FIXTURE ONLY — not safety guidance",
            content="TEST FIXTURE ONLY — not safety guidance",
            language="en",
            version=99,
            approval_status=ApprovalStatus.DRAFT,
        )
        db.add(instruction)
        db.flush()
        question = SafetyQuestion(instruction_id=instruction.id, question="TEST FIXTURE ONLY",
                                  expected_answer="test answer", acceptable_answers=[], language="en", version=99)
        db.add(question)
        db.flush()
        first = BriefingSession(
            worker_id=ids["worker"], permit_id=ids["permit"], instruction_id=instruction.id,
            instruction_version=99, status=BriefingStatus.COMPLETED, current_step=100,
            started_at=now - timedelta(seconds=180), completed_at=now - timedelta(seconds=120),
        )
        second = BriefingSession(
            worker_id=ids["worker"], permit_id=ids["permit"], instruction_id=instruction.id,
            instruction_version=99, status=BriefingStatus.COMPLETED, current_step=100,
            started_at=now - timedelta(seconds=100), completed_at=now,
        )
        other_permit = Permit(permit_number="PTW-UNASSIGNED", worker_id=ids["other_worker"],
                              task_type="Maintenance", work_location="Test Bay",
                              status=PermitStatus.ACTIVE, valid_from=now)
        db.add_all([first, second, other_permit])
        db.flush()
        unassigned = BriefingSession(
            worker_id=ids["other_worker"], permit_id=other_permit.id, instruction_id=instruction.id,
            instruction_version=99, status=BriefingStatus.COMPLETED, current_step=100,
            started_at=now - timedelta(seconds=10_000), completed_at=now,
        )
        db.add_all([
            unassigned,
            AssessmentResult(session_id=first.id, worker_id=ids["worker"], permit_id=ids["permit"],
                             question_id=question.id, question_version=99, worker_answer="test first attempt",
                             result=AssessmentResultStatus.INCORRECT, attempt_count=1),
            AssessmentResult(session_id=first.id, worker_id=ids["worker"], permit_id=ids["permit"],
                             question_id=question.id, question_version=99, worker_answer="test retry",
                             result=AssessmentResultStatus.CORRECT, attempt_count=2),
            AssessmentResult(session_id=second.id, worker_id=ids["worker"], permit_id=ids["permit"],
                             question_id=question.id, question_version=99, worker_answer="",
                             result=AssessmentResultStatus.UNCLEAR, attempt_count=1),
        ])
        db.commit()
        assigned_ids = {first.id, second.id}

    supervisor_headers = auth(system["tokens"]["supervisor"])
    response = client.get("/api/supervisor/overview", headers=supervisor_headers)
    assert response.status_code == 200
    summary = response.json()["data"]
    assert summary["completed_briefings"] == 2
    assert summary["average_completion_seconds"] == 80.0
    assert summary["correct_assessments"] == 1
    assert summary["incorrect_assessments"] == 0
    assert summary["unclear_assessments"] == 1
    assert summary["assistance_required"] == 0

    sessions = client.get("/api/supervisor/briefings", headers=supervisor_headers)
    assert sessions.status_code == 200
    records = sessions.json()["data"]
    assert {record["id"] for record in records} == assigned_ids
    assert all(record["worker_name"] == "Worker One" for record in records)
    assert {record["duration_seconds"] for record in records} == {60, 100}


def test_websocket_requires_an_allowed_origin_and_valid_token(system):
    client = system["client"]
    tokens = system["tokens"]
    with pytest.raises(WebSocketDisconnect) as origin_error:
        with client.websocket_connect("/api/ws/updates", headers={"origin": "https://untrusted.example"}):
            pass
    assert origin_error.value.code == 4403

    with client.websocket_connect("/api/ws/updates", headers={"origin": "http://localhost:5173"}) as socket:
        socket.send_json({"token": tokens["worker"]})
        assert socket.receive_json() == {"type": "connected"}
        socket.send_text("ping")
        assert socket.receive_json() == {"type": "pong"}

    expired = jwt.encode({"sub": "1", "exp": utc_now() - timedelta(seconds=5)}, settings.jwt_secret,
                         algorithm=settings.jwt_algorithm)
    with client.websocket_connect("/api/ws/updates", headers={"origin": "http://localhost:5173"}) as socket:
        socket.send_json({"token": expired})
        with pytest.raises(WebSocketDisconnect) as token_error:
            socket.receive_json()
    assert token_error.value.code == 4401

    with client.websocket_connect("/api/ws/updates", headers={"origin": "http://localhost:5173"}) as socket:
        socket.send_json({"token": tokens["worker"]})
        assert socket.receive_json() == {"type": "connected"}
        with system["sessions"]() as db:
            worker = db.get(User, system["ids"]["worker"])
            worker.is_active = False
            db.commit()
        socket.send_text("ping")
        with pytest.raises(WebSocketDisconnect) as inactive_error:
            socket.receive_json()
    assert inactive_error.value.code == 4401


def test_runtime_security_configuration_rejects_unsafe_values():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="local-demo-secret-change-me", _env_file=None)
    with pytest.raises(ValidationError):
        Settings(environment="development", cors_origins="*", _env_file=None)
    with pytest.raises(ValidationError):
        Settings(environment="development", jwt_algorithm="none", _env_file=None)

    Settings(environment="production", jwt_secret="a-private-random-value-with-at-least-32-bytes", _env_file=None)


def test_password_verifier_bounds_stored_hash_parameters():
    encoded = hash_password("test-password-123")
    assert verify_password("test-password-123", encoded)
    assert not verify_password("incorrect", encoded)
    assert not verify_password("anything", "pbkdf2_sha256$999999999999$YWJj$ZGVm")
    assert not verify_password("anything", "malformed")
