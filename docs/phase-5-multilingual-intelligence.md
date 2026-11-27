# Phase 5 — Multilingual safety intelligence

**Status:** Implemented with deterministic rules for the fictional demo. This layer classifies requests and suggests hazard fields; it does not decide whether work is safe.

## Supported interaction

`POST /api/intelligence/interpret` accepts a worker-authenticated request with `text`, selected `language` (`ta`, `en`, or `hi`), and `context` (`general`, `briefing`, or `hazard`). The implementation uses curated phrases, Unicode normalization, exact category terms, and a narrow equipment-plus-number location pattern. It does not call an LLM or store the transcript.

Supported commands include repeat instruction, ask for a simpler explanation, report a hazard, simulated SOS, help, and safety questions. Phrase lists cover Tamil, English, Hindi and selected mixed/Latin transliterations. The selected language controls the response text. Unmatched requests return a safe prompt to rephrase or use the text controls.

Hazard extraction currently suggests only these known categories: `oil_leak`, `gas_alarm`, and `unsafe_scaffold`. It recognizes explicit category words and locations such as `Pump 4`, `Pump four`, `Pump House 04`, Tamil/Hindi pump terms with known number words, and a few named numbered assets. It does not infer an unlisted category or location. Missing or conflicting fields are left for the worker to fill and verify.

For example, `Pump four pakkathula oil leak irukku` in the selected Tamil interaction returns `report_hazard`, category `oil_leak`, location `Pump 4`, and `requires_confirmation: true`. The UI puts those values into editable draft fields and says nothing was submitted.

## Approved safety content

- A repeat command in briefing context requires the worker's active permit number and language. The API derives the worker from the bearer token and returns only the latest matching **published** instruction for that permit's task and language. The UI presents the exact stored title, text, and version and can read that text aloud.
- If no matching published instruction exists, the API returns no content and asks for supervisor review. Draft and approved-but-unpublished versions are never returned.
- A request for a simpler explanation gets no generated paraphrase because the model has no separately reviewed simplification field. It is explicitly routed for supervisor review.
- Open-ended safety questions receive no generated answer. The response asks the worker to get a supervisor review.
- An SOS or hazard command is only classified. It never submits a report, changes permit state, or creates an SOS. The worker must use the separate visible action and confirmation flow.

The hazard screen runs interpretation after voice dictation and also offers a text-based “Suggest category and location” action. In either case, the original transcript stays visible, suggestions remain editable, and confirmation is required. When the backend is unavailable, no automatic fields are filled and the text-entry path remains available.

## Scope limits

The phrase list is intentionally small and reviewable; it is not general Tamil/Hindi speech understanding. Unlisted expressions and locations may be missed. The user must verify every suggestion. Missing or ambiguous safety content is escalated, and the system does not generate site procedures or safety advice.
