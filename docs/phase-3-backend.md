# Phase 3 — Backend and database

**Status:** Workflow API implemented. This API is not an operational safety authority, permit-to-work authority, or emergency dispatch system.

## Startup and persistence

The FastAPI lifespan creates missing SQLAlchemy tables but does not seed accounts, assignments, permits, hazards, or safety content. SQLite foreign-key enforcement and a busy timeout are enabled. Timestamps are stored in UTC and returned with UTC timezone information. The first supervisor is created explicitly with `uv run python -m app.cli create-supervisor`.

From `backend/`, run `uv run python -m app.cli create-supervisor` to provision a supervisor, then `uv run uvicorn app.main:app --reload`. Interactive API docs are at `/api/docs`; readiness is checked at `/api/health`. Configure `DATABASE_URL`, `JWT_SECRET`, and the other settings with `backend/.env.example`. The fallback JWT secret is for local development only.

There are no bundled credentials or permits. Worker and permit records must be provisioned from an authorized source. The API can create draft permits but cannot activate or clear them.

## Records

| Table | Purpose |
| --- | --- |
| `users` | Operator-provisioned accounts, password hashes, role, language and active flag |
| `supervisor_assignments` | Explicit boundary for which worker records a supervisor can access |
| `permits` | Worker-linked permits, task, location and status/validity |
| `safety_instructions` | Language- and version-specific draft, approved and published content |
| `safety_questions` | Version-linked questions and explicit accepted answer variants |
| `briefing_sessions` | Worker, permit, instruction version, read progress and workflow status |
| `assessment_results` | Each answer attempt, deterministic result and reviewer |
| `hazard_reports` | Confirmed worker report, optional transcript, idempotency key and acknowledgement |
| `hazard_notes` | Supervisor notes attached to a hazard report |
| `emergency_records` | Persisted SOS simulation and supervisor acknowledgement |
| `audit_logs` | Actor, action, entity, timestamp and structured details |

## API envelope and access

Successful routes return `{ "success": true, "message": "...", "data": ..., "error": null }`. HTTP and validation errors use the same keys with `success: false`. Sign in at `POST /api/auth/login`; send the returned bearer token in `Authorization: Bearer <token>`. `/api/docs` lists request fields and status codes.

| Area | Routes |
| --- | --- |
| Authentication and identity | `POST /api/auth/login`, `GET /api/users/me` |
| Workers | `GET /api/workers`, `POST /api/workers`, `GET /api/workers/{worker_id}` |
| Permits | `GET /api/permits`, `GET /api/permits/{permit_id}`, `POST /api/permits`, `PATCH /api/permits/{permit_id}/status` |
| Instructions | `GET /api/instructions`, `GET /api/instructions/{instruction_id}`, `POST /api/instructions`, `POST /api/instructions/{instruction_id}/approve`, `POST /api/instructions/{instruction_id}/publish` |
| Briefings and assessment | `POST /api/briefings`, `GET /api/briefings/{session_id}`, `PATCH /api/briefings/{session_id}/progress`, `POST /api/briefings/{session_id}/assessments`, `GET /api/assessments`, `POST /api/assessments/{assessment_id}/review` |
| Hazards | `POST /api/hazards`, `GET /api/hazards`, `GET /api/hazards/{hazard_id}`, `POST /api/hazards/{hazard_id}/acknowledge`, `POST /api/hazards/{hazard_id}/notes`, `GET /api/hazards/{hazard_id}/notes` |
| Simulated SOS | `POST /api/emergency/sos`, `GET /api/emergency`, `POST /api/emergency/{emergency_id}/acknowledge` |
| Supervisor and audit | `GET /api/supervisor/overview`, `GET /api/audit` |

Workers only read their own account, permits, briefing and records. Supervisors only see workers in `supervisor_assignments`; their mutations are audited. The backend takes worker identity from the token rather than accepting a worker ID in report submissions. Hazard submissions require an `Idempotency-Key` header; retries by the same worker return the existing record.

## Workflow and safeguards

1. A supervisor creates instruction text and answer variants as a draft. The question language must match its instruction language.
2. A supervisor explicitly approves a draft with at least one question, then publishes it in a separate action. Published versions are immutable. Application startup inserts no safety language or translations.
3. A worker can only start a briefing on their active permit when a matching published instruction exists for the selected language. If not, the API returns a conflict and no briefing is created. Worker instruction responses omit expected answers.
4. Read progress is marked complete with `current_step: 100` and `completed: true`. This marks the instruction as reviewed; the briefing is only completed after all included questions have correct answers.
5. Assessment matching normalizes case, punctuation and whitespace, then compares against the exact expected answer and explicitly stored acceptable variants. Blank answers are `unclear`. Three incorrect or unclear attempts route the briefing to supervisor review.
6. Permit creation is draft-only through this API. Supervisors can suspend or close a permit, but this API cannot activate or clear one.
7. Hazard acknowledgement and simulated SOS acknowledgement save the supervisor ID and UTC time. SOS rows always have `is_simulated=true`; no external service is contacted.

This phase uses SQLAlchemy `create_all` for first-run schema creation. It does not yet include a migration framework for upgrading an existing database after model changes.
