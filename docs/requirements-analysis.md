# VoiceGuard AI: Requirements Analysis and MVP Scope

**Phase:** 0 — Requirement analysis and MVP scope<br>
**Baseline date:** 27 November 2026<br>
**Status:** Scope defined for the hackathon demonstration. Candidate safety copy requires review by the designated demonstration safety reviewer before it is loaded into the app.

## 1. Objective

Build one complete, repeatable, multilingual voice-first demonstration of an industrial safety workflow. A fictional worker receives a permit-linked safety briefing, answers a short understanding check, reports a hazard by voice, and sees the supervisor's acknowledgement. A simulated SOS can be raised at any point.

The MVP demonstrates workflow and persistence. It is not an operational safety system, a permit-to-work authority, or an emergency dispatch service.

## 2. Users and roles

| Role | MVP responsibilities | Access boundary |
| --- | --- | --- |
| Worker | Sign in to the demo, select an assigned active permit, choose a language, complete a briefing and assessment, submit a hazard report, raise a simulated SOS, and view their own record statuses. | Can view and create records for their own worker account and assigned permits. Cannot acknowledge reports, approve instructions, or access another worker's records. |
| Supervisor | Sign in to the demo, view worker reports and assessment items needing review, acknowledge hazard and simulated SOS records, add a note, and see the action recorded. | Supervisor actions are authorized by the backend and recorded with the supervisor identity and timestamp. |

Authentication is demo-grade. The application must label demo accounts as fictional and must not imply that this authentication is production-ready.

## 3. Supported languages and voice fallback

| Code | Language | Browser speech locale |
| --- | --- | --- |
| `ta` | Tamil | `ta-IN` |
| `en` | English | `en-IN` |
| `hi` | Hindi | `hi-IN` |

The worker can switch languages for the interaction. The primary speech path uses browser speech recognition and speech synthesis. Recognition availability and quality depend on the browser and device; it may use a browser vendor's remote service. Recording-based Faster-Whisper is an optional configured fallback, not a guaranteed offline mode. If speech recognition or playback is unavailable, show the transcript or response as text and keep text entry available. A transcript must be shown for confirmation before a critical submission.

Translations of safety instructions and assessment criteria must preserve the reviewed source meaning. Do not generate or publish a translation as approved safety content automatically.

## 4. End-to-end worker journey

1. The worker signs in with the fictional demo account.
2. The worker selects an active permit assigned to that account. The backend verifies ownership and permit status.
3. The worker chooses Tamil, English, or Hindi. The selected language is used for prompts and voice output where supported.
4. The app retrieves the published safety instruction associated with the permit's task and displays and reads it aloud. The worker can ask to repeat it or request a simpler explanation. The answer must stay within the reviewed instruction; missing or ambiguous content is escalated instead of invented.
5. The worker answers a short spoken understanding question. The app shows the recognized answer and evaluates it against explicitly approved answer variants. It records `correct`, `incorrect`, or `unclear`. It allows up to three attempts; unresolved results require supervisor review.
6. The worker reports a hazard by voice. The app drafts the category, location, and description, reads those details back, and asks for confirmation or correction before submission.
7. The backend saves the confirmed report against the authenticated worker and selected permit. An idempotency key prevents a retry or double tap from creating a duplicate report. The worker sees `submitted` only after persistence is confirmed.
8. The supervisor sees the report in the dashboard, reviews it, and acknowledges it with an optional note. The acknowledgement, actor, and time are saved.
9. The worker sees the persisted `acknowledged` status without signing in again. Live updates use WebSocket with polling as a fallback.
10. An SOS control remains available throughout the worker journey. In this MVP it creates a clearly labelled simulated event for the supervisor dashboard; it does not contact emergency services.

## 5. Fictional demonstration records

All records below are synthetic and must be labelled as demo data in the interface.

| Record | Demo value |
| --- | --- |
| Worker | `WRK-1001`, Prem Demo Worker; role `worker`; preferred language Tamil (`ta`) |
| Worker demo password | `demo123` (demo only; never reuse for a real account) |
| Permit | `PTW-1001`; assigned to `WRK-1001`; Equipment Maintenance; Pump House 04; active for the demonstration |
| Supervisor | `SUP-1001`, Demo Supervisor; role `supervisor` |
| Supervisor demo password | `demo123` (demo only; never reuse for a real account) |
| Hazard example | “Pump four pakkathula oil leak irukku” → proposed category `oil_leak`, location `Pump 4`; worker confirmation is required |

The backend, not a client-supplied worker identifier, determines which worker owns a session, permit, report, or SOS record. Seed data must not contain real worker or site information.

## 6. Demonstration safety content and approval gate

Safety content is controlled data, not generated advice. Each instruction and question must be linked to a task, language, version, and approval status. Only content with an explicit supervisor approval and published status can be presented as an instruction or used to score an answer. Preserve the version used by each briefing and assessment.

The engineering blueprint provides these candidate demonstration strings:

- **Briefing candidate (Tamil):** “வேலை தொடங்குவதற்கு முன்பு, அனுமதிக்கப்பட்ட PPE அணிந்துள்ளீர்களா என்பதை உறுதிப்படுத்துங்கள். உங்கள் பணி அனுமதியில் குறிப்பிடப்பட்டுள்ள isolation நடைமுறைகளைப் பின்பற்றுங்கள்.”
- **Assessment candidate (English):** “What should you do if the gas alarm sounds?” Expected answer: “Stop work and follow the site emergency evacuation procedure.”

These are candidate demo fixtures, not verified site procedures. The designated reviewer must approve the exact wording and any Tamil or Hindi versions before the app publishes them. Do not create missing translations or add site-specific steps by inference. Until approval, keep the candidate content marked draft and use it only in a non-operational development fixture.

When content is missing, ambiguous, or not approved, the app must say it cannot provide an approved instruction and route the item to supervisor review. It must not invent gas evacuation steps, change permit isolation requirements, clear a permit, authorize hazardous work, or suppress a report.

## 7. MVP scope

### Required in the demonstration

- Fictional worker and supervisor demo login with backend role checks.
- Permit ownership and active-status validation.
- Tamil, English, and Hindi language selection with visible text fallback.
- Published, versioned safety briefing and repeat/simple-explanation actions constrained to approved content.
- Spoken assessment with approved answer variants, attempt tracking, and supervisor review after unresolved attempts.
- Voice hazard capture, transcript and field confirmation, persistent report submission, and idempotent retry handling.
- Supervisor report list, report details, acknowledgement, optional note, and audit information.
- Worker-visible acknowledgement status update.
- Persistent simulated SOS record with supervisor acknowledgement.
- Clear listening, processing, speaking, confirmation, review, and error states.
- Docker Compose startup without paid AI credentials or automatic Whisper model downloads.

### Simulated or optional capabilities

- Authentication and accounts are demonstration-only.
- SOS is a simulation; no emergency call or dispatch integration exists.
- Browser speech services may depend on browser support or network access. Faster-Whisper is optional and separately configured.
- Ollama or another LLM is optional. The default intent and safety workflow uses deterministic rules and approved content.
- WebSocket updates may fall back to polling.
- Permit, worker, and instruction data are fictional seed data, not connected to an industrial system.

### Outside this MVP

- Use at a real worksite or reliance for real-world safety decisions.
- Real permit issuance, clearance, or authorization of hazardous work.
- Contacting emergency services or integrating with site alarms, sensors, or dispatch systems.
- Production identity management, certified translations, or guaranteed offline speech recognition.
- Retaining raw voice recordings by default. The default design stores transcripts and workflow records, not raw audio.

## 8. Quality and safety requirements

- Safety decisions are deterministic and traceable to published, approved content. An optional language model may help interpret a command but cannot make a safety decision.
- Critical actions require worker confirmation of the recognized transcript and extracted details.
- The backend derives the worker from the authenticated session and checks role and permit ownership on protected operations.
- Persisted statuses must reflect backend-confirmed writes. On network failure, show a pending or failed state and allow safe retry; never display a false submission or acknowledgement.
- Use idempotency protection for hazard submission retries and store audit records for supervisor actions.
- Store timestamps in UTC. Keep historical instruction and question versions available for auditability.
- If a real emergency occurs, tell the worker to follow the site's emergency procedure immediately; never imply the app has contacted help.

## 9. Acceptance criteria

Phase 0 is complete when the implementation can be checked against this defined scope. The MVP release is accepted when all of the following are demonstrated:

1. A fictional worker can log in, see only their own active permit, choose one of the three supported languages, and start the permit-linked briefing.
2. The briefing is the published approved version, is available as text, and can be repeated. Missing or draft instructions are not shown as approved.
3. The assessment records the transcript, instruction/question version, result, attempt count, and routes an unresolved third attempt to supervisor review.
4. The worker can speak a hazard, review and correct the proposed category/location/description, and confirm it before submission.
5. The confirmed hazard is persisted and appears in the supervisor dashboard after refresh. Repeating the same submission with the same idempotency key does not create a duplicate.
6. A supervisor can acknowledge the report; the saved acknowledgement records the supervisor and time, and the worker sees the updated status without a new login.
7. A worker can create a simulated SOS event and the supervisor can see and acknowledge it. The UI clearly identifies the event as simulated.
8. Unsupported or denied microphone access leaves a usable text path. Unavailable speech output leaves the written response visible.
9. Network failure never produces a false `submitted` or `acknowledged` status, and retries do not duplicate a report.
10. No workflow claims that real emergency services were contacted, that a permit was cleared, or that unapproved content is an authorized safety instruction.

## 10. Architecture baseline for the MVP

Keep the four-day implementation aligned with the engineering blueprint: React 19, Vite, TypeScript, Tailwind CSS v4, and React Router in the frontend; FastAPI, Pydantic v2, SQLAlchemy, and SQLite in the backend; browser speech recognition and speech synthesis as the primary voice path; optional Faster-Whisper; deterministic safety and intent rules by default; and Docker Compose for the demo. No paid AI provider is required to start the application.

The development schedule in the blueprint targets 27–30 November 2026. Its deadline note conflicts between 29 and 30 November, so the submission portal deadline must be confirmed separately; plan to be ready by 29 November.
