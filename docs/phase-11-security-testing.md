# Phase 11: Security and workflow verification

## Safeguards

- Passwords are stored as salted PBKDF2-SHA256 hashes. Verification rejects malformed hashes and iteration counts outside the configured safe bounds.
- JWTs use HS256, expire, and identify a database user. Authorization reads the user's current role and active state from the database; the browser cannot select its identity by request payload.
- Worker access is limited to their own data. Supervisor queries and record actions require an assignment to that worker.
- WebSocket sessions validate the origin and bearer token at connection time, re-check token validity on keepalive, and reject unexpected client messages.
- Credentialed CORS does not accept `*`. Non-development settings require a private JWT secret with at least 32 bytes.
- Supervisor actions and workflow events write audit entries. Tests use a temporary in-memory SQLite database and do not touch the demo database.

## Verification coverage

`backend/tests/test_security_workflows.py` covers role enforcement, assigned-worker boundaries, SOS idempotency and acknowledgement, hazard idempotency and acknowledgement, audit visibility, WebSocket origin/token checks, and unsafe configuration rejection.

Run with `cd backend; uv sync --group dev; uv run pytest -q`.

These controls support a fictional demo. They are not a production identity, safety, or emergency-response certification.
