from datetime import timedelta

import pytest
from fastapi import WebSocketDisconnect
from jose import jwt
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings, settings
from app.core.security import hash_password, verify_password
from app.core.time import utc_now
from app.models import AuditLog, EmergencyRecord, User


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_role_enforcement_and_assignment_boundaries(system):
    client = system["client"]
    ids = system["ids"]
    tokens = system["tokens"]

    wrong_role = client.post("/api/auth/demo-login", json={
        "worker_id": "WRK-TEST-1", "password": "demo123", "role": "supervisor",
    })
    assert wrong_role.status_code == 401

    worker_login = client.post("/api/auth/demo-login", json={"worker_id": "WRK-TEST-1", "password": "demo123"})
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
    payload = {
        "permit_id": ids["permit"],
        "category": "oil_leak",
        "description": "Oil is visible near the pump.",
        "location": "Test Bay",
        "transcript": "Oil near pump",
    }
    worker_headers = auth(tokens["worker"])
    key_headers = {"Idempotency-Key": "test-hazard-request-key-0001"}

    created = client.post("/api/hazards", json=payload, headers={**worker_headers, **key_headers})
    retried = client.post("/api/hazards", json=payload, headers={**worker_headers, **key_headers})
    assert created.status_code == 201
    assert retried.status_code == 201
    hazard_id = created.json()["data"]["id"]
    assert retried.json()["data"]["id"] == hazard_id

    visible_to_assigned = client.get("/api/hazards", headers=auth(tokens["supervisor"])).json()["data"]
    hidden_from_unassigned = client.get("/api/hazards", headers=auth(tokens["other_supervisor"])).json()["data"]
    assert [item["id"] for item in visible_to_assigned] == [hazard_id]
    assert hidden_from_unassigned == []
    assert client.post(f"/api/hazards/{hazard_id}/acknowledge", json={"note": "Checked"},
                       headers=auth(tokens["other_supervisor"])).status_code == 404

    acknowledged = client.post(f"/api/hazards/{hazard_id}/acknowledge", json={"note": "Received for review"},
                               headers=auth(tokens["supervisor"]))
    assert acknowledged.status_code == 200
    assert acknowledged.json()["data"]["status"] == "acknowledged"
    note_rows = client.get(f"/api/hazards/{hazard_id}/notes", headers=worker_headers).json()["data"]
    assert note_rows[0]["note"] == "Received for review"
    worker_status = client.get("/api/hazards", headers=worker_headers).json()["data"][0]
    assert worker_status["acknowledged_by"] == ids["supervisor"]
    assert worker_status["acknowledged_at"] is not None


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
    encoded = hash_password("demo123")
    assert verify_password("demo123", encoded)
    assert not verify_password("incorrect", encoded)
    assert not verify_password("anything", "pbkdf2_sha256$999999999999$YWJj$ZGVm")
    assert not verify_password("anything", "malformed")
