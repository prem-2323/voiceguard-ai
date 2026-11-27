# Phase 6 — Worker identification and safety briefing

Phase 6 connects worker identity, assigned permits, published instructions, and a persisted briefing session. The flow supports Tamil, English, and Hindi and keeps instruction text behind the supervisor approval and publication gate.

## Worker flow

1. The worker signs in with the demo worker account (`WRK-1001` / `demo123`). The backend returns a role-scoped access token; a backend outage can still show the clearly labeled local preview.
2. The permit screen requests permits assigned to that worker. The API returns only active permits whose validity window includes the current time.
3. The worker selects a language and opens the briefing for the chosen permit.
4. The app first looks for that worker's saved briefing for the permit and language. If one exists, it resumes the exact published instruction version attached to the session. Otherwise, the app loads the latest matching published instruction.
5. Starting the briefing stores the worker, permit, instruction id, and instruction version. The worker can save reading progress or mark the instruction reviewed. Progress is persisted and recorded in the audit log.
6. Voice playback reads the exact approved instruction. A repeat command in a saved session returns that same version; an unsupported or missing instruction request is routed to supervisor review rather than answered with generated safety guidance.

## API behavior

- `GET /api/permits` scopes worker results to assigned, currently active permits.
- `GET /api/briefings/current?permit_id=…&language=…` resumes the latest saved session for that worker, permit, and language.
- `POST /api/briefings` starts a session only when a matching published instruction exists.
- `PATCH /api/briefings/{id}/progress` persists the reading marker and review completion; it does not mark an assessment as passed.
- `POST /api/intelligence/interpret` accepts the briefing session id for repeat requests so a later publication cannot silently change the content within an active session.

Workers receive instruction questions without expected answers. No sample safety instruction is seeded; a supervisor must publish approved content for the selected task and language before the start button is available.

## Verification

Run the frontend production build and Python compile/OpenAPI checks from the repository root using the commands below. The demo still depends on a supervisor publishing task instructions before a briefing can start.

```powershell
cd frontend
npm run build
cd ../backend
uv run python -m compileall -q app
uv run python -c "from app.main import app; print(len(app.openapi()['paths']), 'API paths')"
```
