# VoiceGuard AI

VoiceGuard AI is a multilingual, voice-first industrial safety workflow prototype. Its hackathon MVP uses fictional demo records and is not an operational safety or emergency dispatch system.

See [the Phase 0 scope](docs/requirements-analysis.md) for the user journey, safety boundaries, and acceptance criteria.

## Docker Compose quick start

With Docker Engine and the Compose v2 plugin installed, start the complete demo from the repository root:

```powershell
docker compose up --build
```

No `.env` file or paid API key is required for the basic demo. Open `http://localhost:8080`; verify the API through the frontend proxy at `http://localhost:8080/api/health`. SQLite data is stored in the named `voiceguard_data` volume and survives container restarts. See [Docker deployment details](docs/phase-12-docker-deployment.md). The GitHub Actions Docker smoke workflow is configured to build and start the Compose services, exercise the proxied API and worker-to-supervisor flow, restart the API to check persistence, and tear down its isolated CI volume; its first run is still pending.

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

## Mobile PWA behavior

The production frontend includes an installable PWA manifest, app icons, and an offline application shell. Install prompts are browser-controlled and require HTTPS or localhost; when no prompt is offered, use the browser's own “Add to Home Screen” option if available. The service worker caches the static app shell and built assets only. API requests and authenticated worker or supervisor records are never stored for offline use, so reporting and acknowledgement require a live backend connection.

### Install and check the PWA

1. Serve the app from `http://localhost:8080` with Compose, or from an HTTPS deployment. A plain LAN HTTP address is not a secure context and may prevent service-worker registration, microphone access, and installation.
2. In a supported browser, use **Install app** when offered. Otherwise use that browser's **Install app** or **Add to Home Screen** menu. iOS browsers may use the share menu and do not expose the same install prompt.
3. Launch the installed app and confirm it opens in standalone display mode.
4. To check the offline shell, load the app once, disconnect the network, and reload a client-side route. The cached shell can render; API-backed sign-in, reporting, acknowledgement, and updates cannot work offline.

Offline shell behavior does not imply offline speech recognition. Browser speech recognition may require a network and a browser speech provider. Text-to-speech depends on the device/browser voice packs and has not been verified offline.

Voice uses the browser Web Speech API when that browser exposes speech recognition for the selected locale (`ta-IN`, `en-IN`, or `hi-IN`). Browser and device support varies, and speech services may process audio outside the device. Text entry remains available if recognition is unsupported or fails. Spoken playback also depends on an installed browser/device voice for the selected language. This repository has not been verified on a physical Android device; do not treat these browser capabilities as native Android verification.

### Manual browser voice test

Open `/worker/voice-diagnostics` from the welcome page using HTTPS or localhost. Select Tamil (`ta-IN`), English (`en-IN`), and Hindi (`hi-IN`) one at a time. For each language, check the browser API/voice list, press **Test microphone**, grant the browser's microphone permission, speak a short non-sensitive phrase, stop if needed, and verify that a real transcript appears. Then press **Play test phrase** and confirm audible playback. Record recognition/TTS errors and whether an actual transcript was received. API availability alone is not a successful microphone test. Do not type a phrase and report it as recognized speech. Browser recognition may send audio to its provider; do not speak sensitive incident details during diagnostics.

The diagnostic screen reports API presence, browser identity where available, permission state where supported, installed Tamil/English/Hindi voices, transcript success, and recognition/TTS errors. It does not create a fake transcript or claim a successful microphone test when no transcript arrives.

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

The supervisor console shows records only for assigned workers. Recent activity links to its record queue, briefing sessions expand to show permit and instruction details, and completion averages are calculated from saved start/completion timestamps. Assessment summaries use the latest saved result per question; empty metrics stay empty rather than using sample totals. The console receives authenticated WebSocket update events and falls back to polling when the socket is unavailable. Workers can submit a persisted simulated SOS, retry it safely with an idempotency key, and see the supervisor's acknowledgement. The SOS never contacts emergency services. See [the Phase 9–10 workflow notes](docs/phase-9-10-supervisor-and-sos.md).

## Phase 11 security and workflow checks

Protected routes derive the account from a signed, expiring bearer token and enforce worker/supervisor roles and assignment scope. Supervisor review actions are audited. Production-like environments reject the built-in demo JWT secret, wildcard credentialed CORS, and non-HS256 JWT settings; demo passwords are fictional and must not be reused. Set a private random `JWT_SECRET` of at least 32 bytes and list exact trusted origins before running outside development. See [the Phase 11 security notes](docs/phase-11-security-testing.md).

Run the isolated backend authorization and workflow suite with:

```powershell
cd backend
uv sync --group dev
uv run python -m pytest -q
```

## Phase 12 Docker Compose demo

Run `docker compose up --build` from the project root, then open `http://localhost:8080`. SQLite persists in a named volume. The demo starts without paid AI credentials or a downloaded speech model. See [the Docker deployment notes](docs/phase-12-docker-deployment.md).

## Phase 13 final demo and submission

Use only these fictional accounts:

| Role | ID | Password |
| --- | --- | --- |
| Worker | `WRK-1001` | `demo123` |
| Supervisor | `SUP-1001` | `demo123` |

### Worker-to-supervisor demonstration

1. Start Compose with `docker compose up --build`, open `http://localhost:8080`, and verify `/api/health` reports healthy.
2. In a worker browser profile, sign in as `WRK-1001`, select assigned active permit `PTW-1001`, and choose Tamil.
3. On the hazard screen, dictate a fictional concern only after the diagnostics screen proves the browser returned a real transcript. If not, type the concern and identify it as text input. Review and correct category, location, and description.
4. Continue to confirmation, review the displayed transcript/details, and explicitly confirm submission. The report is submitted only after the backend responds successfully.
5. In a separate supervisor browser profile, sign in as `SUP-1001`, open the new hazard report, inspect its details, and acknowledge receipt with a note.
6. Return to the worker profile and verify the saved acknowledgement/status appears after refresh or live update.
7. Show SOS only as simulated; it never contacts emergency services. Do not present briefing or assessment content until the designated safety reviewer has approved the exact instruction, translations, questions, and answers.

See the [demo and submission checklist](docs/phase-13-demo-and-submission.md) and [pitch deck outline](docs/phase-13-pitch-outline.md).

### Release verification disclosure

**Verified in this checkout:** 11 backend tests pass; frontend lint and production build pass; static PWA validation passes. The worker-to-supervisor workflow was also exercised in Brave against FastAPI and an isolated SQLite database: a worker submitted a report after explicit confirmation, a supervisor acknowledged it, and the worker saw the saved acknowledgement after signing in again. That browser report used typed text, not speech recognition.

**Not verified:** Docker Compose startup and the GitHub Actions smoke workflow have not run. PWA installation/standalone launch and a real browser-offline reload have not been tested. No physical Android device was tested. Brave exposed speech recognition/synthesis APIs during diagnostics, but microphone permission stayed at `prompt`, no Tamil/English/Hindi voices were listed, and the microphone check produced no transcript; actual microphone input and audible TTS therefore remain unverified. No approved SOP content is seeded, so do not demonstrate briefing or assessment content as approved. Complete the Docker CI and manual browser/device checks before treating these gates as passed.
