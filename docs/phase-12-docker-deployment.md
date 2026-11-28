# Phase 12: Docker Compose deployment

## Start the application

From the repository root, run:

```powershell
docker compose up --build
```

Open `http://localhost:8080`. The frontend container serves the built React app and proxies `/api` (including the authenticated WebSocket endpoint) to FastAPI. The API waits for its database health check before the frontend starts. SQLite data persists in the `voiceguard_data` named volume.

The database starts empty and no paid AI credentials are required. Create a supervisor interactively with `docker compose exec -T api python -m app.cli create-supervisor`. Browser speech remains optional, and Faster-Whisper stays disabled unless a local model path is configured. No model is downloaded at build or startup.

To change the published port, set `VOICEGUARD_PORT` before starting. For non-development use, also set `ENVIRONMENT=production`, a private random `JWT_SECRET` of at least 32 bytes, and exact trusted `CORS_ORIGINS`; the backend rejects the built-in local secret in that mode.

## Services

- `frontend`: Node build stage plus Nginx static server, SPA fallback, API/WebSocket proxy, and health check.
- `api`: Python 3.12 FastAPI process running as a non-root user with an API/database health check.
- `voiceguard_data`: persistent SQLite storage. `docker compose down` preserves it; `docker compose down -v` removes it.

This stack is a reproducible local deployment, not a production security or availability configuration. No worker/permit system integration or site-approved content is included.
