# Phase 8 — Voice-based hazard reporting

Phase 8 connects the worker's voice and text hazard draft to the authenticated hazard API. Workers review all fields and explicitly confirm before a report is saved.

## Worker flow

1. The worker speaks through browser speech recognition or the optional configured transcription fallback, or enters the report as text.
2. The transcript and deterministic category/location suggestions populate an editable draft. The worker chooses or corrects the category, location, and description.
3. The confirmation screen reads back the report in the selected speech locale and shows the transcript plus all fields. The worker must check the confirmation box before submitting.
4. The frontend posts the report with the selected permit and an `Idempotency-Key`. The backend derives the worker from the access token, verifies the permit is assigned and active, stores the transcript and report details, and records an audit event.
5. The UI shows `submitted` only after receiving a persisted report record. On network uncertainty, the draft stays on screen and retry uses the same idempotency key. Editing the report or changing workers/permits clears the key so a changed report is a new submission.
6. A backend session and active assigned permit are required before the worker can enter or confirm a report. If the backend is unavailable, sign-in or submission fails; the application does not offer a local-only report path.

Hazard suggestions remain editable and do not submit anything. The confirmed report becomes visible to authorized supervisors through the existing scoped hazard listing. This prototype does not contact emergency services; for an actual emergency, workers must follow their site's emergency procedures.

## API behavior

- `POST /api/hazards` requires worker authentication and an `Idempotency-Key` header. Repeating the same request with the same key returns the existing record for that worker.
- `GET /api/hazards` returns a worker's own reports or reports for workers assigned to the authenticated supervisor.
- `POST /api/hazards/{id}/acknowledge` records the supervisor identity and acknowledgement time.
