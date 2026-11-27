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
