# VoiceGuard AI

VoiceGuard AI is a multilingual, voice-first industrial safety workflow prototype. Its hackathon MVP uses fictional demo records and is not an operational safety or emergency dispatch system.

See [the Phase 0 scope](docs/requirements-analysis.md) for the user journey, safety boundaries, and acceptance criteria.

## Phase 1 development setup

### Prerequisites

- Node.js 22.12 or newer (Node 22.23 was used for the initial setup).
- Python 3.12.
- [uv](https://docs.astral.sh/uv/) for the backend environment and dependency lock.

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` requests to the backend at `http://127.0.0.1:8000`.

### Backend

In a second terminal:

```powershell
cd backend
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API health endpoint is `http://127.0.0.1:8000/api/health`. Interactive API documentation is at `http://127.0.0.1:8000/api/docs`. The SQLite database is created at `backend/data/voiceguard.db` on first startup.

The frontend can also be started independently; its API base URL is configurable with `VITE_API_BASE_URL` (see `frontend/.env.example`). Backend settings and allowed development origins are documented in `backend/.env.example`.

## Dependency files

- `frontend/package-lock.json` locks the JavaScript dependency tree; use `npm ci` for reproducible installs.
- `backend/uv.lock` locks the Python dependency tree; use `uv sync` to install it.
- `backend/requirements.txt` is the pinned production dependency export for tools that install from pip.

## Phase 4 voice engine

The worker screens use browser speech recognition and speech synthesis for Tamil, English, and Hindi where the browser supports them. Text entry remains available, and the hazard confirmation screen displays the transcript and requires the worker to confirm the report details.

Faster-Whisper is an optional local fallback. The default backend does not install it or download a model. See [the Phase 4 setup and behavior](docs/phase-4-voice-engine.md) for installing the optional dependency and configuring an existing local model directory.

## Phase 5 multilingual intelligence

Voice commands and hazard fields use deterministic Tamil, English, and Hindi phrase rules. Hazard suggestions stay editable and require confirmation; repeat requests can only return a published instruction matched to the worker's active permit and language. See [the Phase 5 behavior and limits](docs/phase-5-multilingual-intelligence.md).

## Phase 6 worker briefing

Workers can sign in with a demo account, select an assigned active permit, choose Tamil, English, or Hindi, and load the matching published instruction. Starting the briefing creates a saved session; reading progress and review status persist and can be resumed after signing in again. Repeated voice requests stay pinned to the instruction version in that session. No demo safety instruction is invented or seeded: the supervisor must approve and publish content before a worker can start a briefing. See [the Phase 6 worker flow](docs/phase-6-worker-briefing.md).

## Phase 7 understanding assessment

Workers can answer questions attached to the saved briefing by speech or text. Answers are compared with the supervisor-approved answer variants, attempts are capped at three, and repeated unsuccessful attempts put the session into supervisor review. Expected answers are never returned to the worker. See [the Phase 7 assessment flow](docs/phase-7-assessment.md).

## Phase 8 hazard reporting

Workers can dictate or type a hazard, review and correct the suggested category, location, and description, hear a readback, then explicitly confirm submission. The report is marked submitted only after the backend persists it; retries reuse an idempotency key to avoid duplicates. Offline confirmation is labeled preview-only. See [the Phase 8 reporting flow](docs/phase-8-hazard-reporting.md).

## Phases 9–10 supervisor updates and simulated SOS

The supervisor console shows records only for assigned workers. It receives authenticated WebSocket update events and falls back to polling when the socket is unavailable. Workers can submit a persisted simulated SOS, retry it safely with an idempotency key, and see the supervisor's acknowledgement. The SOS never contacts emergency services. See [the Phase 9–10 workflow notes](docs/phase-9-10-supervisor-and-sos.md).

## Phase 11 security and workflow checks

Protected routes derive the account from a signed, expiring bearer token and enforce worker/supervisor roles and assignment scope. Supervisor review actions are audited. Production-like environments reject the built-in demo JWT secret, wildcard credentialed CORS, and non-HS256 JWT settings; demo passwords are fictional and must not be reused. Set a private random `JWT_SECRET` of at least 32 bytes and list exact trusted origins before running outside development. See [the Phase 11 security notes](docs/phase-11-security-testing.md).

Run the isolated backend authorization and workflow suite with:

```powershell
cd backend
uv sync --group dev
uv run pytest -q
```

## Phase 12 Docker Compose demo

Run `docker compose up --build` from the project root, then open `http://localhost:8080`. SQLite persists in a named volume. The demo starts without paid AI credentials or a downloaded speech model. See [the Docker deployment notes](docs/phase-12-docker-deployment.md).

## Phase 13 final demo and submission

The final demo script uses the fictional worker and supervisor accounts to demonstrate a confirmed hazard report, supervisor acknowledgement and worker status refresh, followed by a simulated SOS if time allows. No reviewed safety instruction is seeded, so briefing and assessment content remain gated until the designated reviewer approves the exact copy. See the [demo and submission checklist](docs/phase-13-demo-and-submission.md) and [pitch deck outline](docs/phase-13-pitch-outline.md).
