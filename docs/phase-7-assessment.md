# Phase 7 — Spoken understanding assessment

The assessment uses only the questions and answer variants attached to the worker's saved, published briefing version. It supports spoken answers through browser speech recognition and typed answers when speech is unavailable.

## Worker flow

1. The worker must sign in, select an assigned active permit, and mark its briefing reviewed.
2. The screen loads the current briefing session and that session's saved assessment results. It shows one unanswered or not-yet-correct question at a time in the selected language.
3. The worker can hear the question aloud, speak an answer, edit the recognized transcript, or type an answer. An explicit “I'm not sure” action records an unclear attempt.
4. The backend normalizes Unicode, case, punctuation, and whitespace, then compares the answer with the question's approved expected and acceptable answer variants. This is deterministic matching, not semantic or AI grading. It does not show answer variants to the worker.
5. A correct answer advances to the next question. Each question allows up to three attempts. Three incorrect or unclear attempts move the briefing to `supervisor_review`; passing every question moves it to `completed`.

Assessment answers, outcome, attempt count, question version, and time are persisted and audited. The client reloads prior answers so the worker can resume. Session and question access is scoped to the authenticated worker; supervisors can query assigned workers' assessment records.

No question or expected answer is seeded. A supervisor must create, approve, and publish an instruction with reviewed questions before the assessment is available. This deterministic comparison checks an answer against approved variants; it does not certify a worker's fitness or authorization to work.

## API behavior

- `GET /api/briefings/current` supplies the saved instruction version and its worker-safe question text.
- `GET /api/assessments?session_id=…` returns attempts for the authenticated worker's session without exposing expected answers.
- `POST /api/briefings/{session_id}/assessments` records one answer and enforces the attempt limit and briefing review gate.
- `GET /api/assessments?pending_review=true` lets an assigned supervisor find assessment results for sessions awaiting review.
