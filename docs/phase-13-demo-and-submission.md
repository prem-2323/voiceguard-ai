# Phase 13: Release and demonstration checklist

## Empty-install setup

1. Start the stack with `docker compose up --build` from the repository root.
2. Open `http://localhost:8080` and confirm `/api/health` reports healthy.
3. Create a site supervisor interactively with `docker compose exec -T api python -m app.cli create-supervisor`.
4. Provision worker accounts and approved site records through authorized processes. No sample accounts, permits, instructions, questions, or reports are bundled.
5. The current API creates permits as drafts and cannot activate or clear them. Obtain active permits from the authorized permit source; do not bypass this gate for a user-facing walkthrough.

## Worker-to-supervisor walkthrough

1. Use separate worker and supervisor browser profiles and site-provisioned accounts.
2. Confirm the worker sees only assigned, active permit records. Do not begin a briefing unless the task and language have a reviewer-approved published instruction.
3. Check browser voice diagnostics with a non-sensitive phrase. If recognition is unavailable, enter the hazard as text and identify it accurately as typed input.
4. Review the transcript and extracted category, location, and description. Explicitly confirm submission and wait for the API's saved response.
5. Sign in as the assigned supervisor, open the persisted report, inspect its details, and acknowledge receipt.
6. Return to the worker profile and verify that the saved acknowledgement appears after refresh or live update.
7. If shown, SOS is explicitly simulated and does not contact emergency services.

## Safety-content gate

No approved safety briefing or assessment is bundled. Do not present candidate or generated wording as a site procedure. The designated safety reviewer must approve the exact instruction, supported-language version, question, and answer variants before they are added and published through supervisor-protected actions.

## Test data and release limits

Backend tests create disposable records in isolated temporary SQLite databases; Compose smoke tests create a per-run disposable volume and remove it during cleanup. Neither source is application seed data. The local `backend/data/voiceguard.db` included no operational records; the verified sample accounts, assignment, and permit were removed, leaving all tables empty.

Real worker/permit-system integration, approved site SOP content, physical Android voice testing, and actual PWA installation remain unverified. Browser speech may require network access, and Tamil TTS depends on an installed voice. Do not claim these checks passed without testing the target environment.
