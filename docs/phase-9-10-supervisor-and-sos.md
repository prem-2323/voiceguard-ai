# Phases 9–10: Supervisor updates and simulated SOS

## Supervisor workspace

- Supervisor login uses the backend demo account. The API scopes worker, permit, hazard, assessment, SOS, and audit records to assigned workers.
- The dashboard displays live backend records and provides acknowledgement/review actions where the API supports them.
- Acknowledgement notes and review outcomes are stored with the supervisor actor and timestamp. A hazard acknowledgement records receipt; it does not close the hazard or clear a permit. Assessment review does not pass the assessment or authorize work.
- Authenticated WebSocket events refresh affected pages. A five-second polling fallback continues while the socket is connecting or unavailable.

## Simulated SOS behavior

- A signed-in worker can explicitly submit an SOS demo event linked to the selected permit and location.
- The backend requires an idempotency key and stores the key and event in one transaction. Retrying the same request returns the existing event.
- The assigned supervisor can acknowledge receipt. The worker sees the saved acknowledgement through live updates or polling.
- Every screen identifies the event as simulated and states that no emergency services are contacted. For a real emergency, workers are told to follow site procedures immediately.

## Limitations

WebSocket delivery is in-process; the deployment uses one API instance. Polling remains the recovery path if the socket or event notification is unavailable. All records are fictional demonstration data.
