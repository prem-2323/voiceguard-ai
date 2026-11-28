# Phase 11: Security and workflow verification

## Safeguards

- Passwords are stored as salted PBKDF2-SHA256 hashes. Verification rejects malformed hashes and iteration counts outside the configured safe bounds.
- JWTs use HS256, expire, and identify a database user. Authorization reads the user's current role and active state from the database; the browser cannot select its identity by request payload.
- Worker access is limited to their own data. Supervisor queries and record actions require an assignment to that worker.
- WebSocket sessions validate the origin and bearer token at connection time, re-check token validity on keepalive, and reject unexpected client messages.
- Credentialed CORS does not accept `*`. Non-development settings require a private JWT secret with at least 32 bytes.
- Supervisor actions and workflow events write audit entries. Tests use a temporary file-backed SQLite database created by pytest and do not touch the demo database.

## Verification coverage

`backend/tests/test_security_workflows.py` covers role enforcement, assigned-worker boundaries, instruction approval and publication gates, assessment version and attempt history, Tamil/English/Hindi text-question routing, supervisor briefing scope and timestamp-derived completion metrics, SOS idempotency and acknowledgement, hazard confirmation and permit requirements, hazard idempotency and acknowledgement, audit visibility, WebSocket origin/token checks, and unsafe configuration rejection. These tests exercise text/API workflows; they do not validate microphone recognition or speech synthesis on a device.

Run with `cd backend; uv sync --group dev; uv run python -m pytest -q`.

These controls support a fictional demo. They are not a production identity, safety, or emergency-response certification.
