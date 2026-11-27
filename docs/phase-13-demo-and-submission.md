# Phase 13: Final demo and submission checklist

## Demo setup

1. On a machine with Docker Compose installed, run `docker compose up --build` from the repository root.
2. Open `http://localhost:8080` and confirm the API reports healthy at `/api/health`.
3. Use two browser profiles so the worker and supervisor sessions stay separate.
4. Use only the fictional demo accounts below. These credentials are for this prototype only.

| Role | Demo ID | Password |
| --- | --- | --- |
| Worker | `WRK-1001` | `demo123` |
| Supervisor | `SUP-1001` | `demo123` |

## Three-minute walkthrough

1. **Worker access:** sign in as `WRK-1001`; show the assigned active permit and the Tamil, English, and Hindi language options. Keep the text path visible as the speech fallback.
2. **Hazard report:** open the report flow, speak or type a fictional concern, review and correct the proposed category, location, and description, then confirm once.
3. **Supervisor action:** in the second browser profile, sign in as `SUP-1001`, open the new report, and acknowledge receipt with a short audit note.
4. **Worker status:** return to the worker screen and show the acknowledged status arriving by WebSocket or polling fallback.
5. **Simulated SOS:** if time allows, submit the simulated event and acknowledge it in the supervisor console. State clearly that no call or dispatch occurs.

## Safety-content gate

The repository intentionally seeds no approved safety briefing. Do not present candidate wording as a verified site procedure. Briefing and assessment screens should remain gated unless the designated safety reviewer has approved the exact instruction, supported-language version, question, and answer variants. Only then should that content be added and approved/published through the supervisor-protected API.

## Submission checklist

- [x] Repository initialized and phase work pushed to `main`.
- [x] Editable eight-slide pitch deck saved in Spaces.
- [x] Demo steps, demo credentials, safety limits, and architecture documented in the repository.
- [x] Backend security/workflow suite: 6 passing tests.
- [x] Frontend production build passes.
- [x] Compose YAML parses and includes health checks and persistent storage.
- [ ] Build and start the containers on a machine with Docker; the Docker CLI was unavailable during this implementation.
- [ ] Obtain designated safety-reviewer approval before including briefing or assessment content in the walkthrough.
- [ ] Add the team, contact, event name, and submission deadline required by the event portal.
- [ ] Record a short demo video or capture screenshots if the portal asks for media.
- [ ] Upload the repository, pitch deck, and any requested demo media to the event portal; this project repository does not automate external submission.

## Presenter limits

Describe this as a fictional workflow prototype. It is not a live site safety system, does not authorize or clear work, and does not contact emergency services. Browser speech support varies by device and may require network access.
