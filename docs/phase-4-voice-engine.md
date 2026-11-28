# Phase 4 — Hybrid voice engine

**Status:** Browser voice adapters are implemented. Voice output and recognition are assistive UI capabilities; workers must review text before any critical action.

## Browser voice

The worker interface uses the browser Web Speech APIs when available:

- Speech recognition selects `ta-IN`, `en-IN`, or `hi-IN` from the language choice. It captures one utterance at a time and places the final transcript in the hazard description draft.
- Speech synthesis reads the visible briefing status message and the hazard report fields back in the selected locale. It is also reusable for future approved briefing content; it does not create or translate safety instructions.
- Browser and device support varies. Browser speech recognition may use a browser vendor's remote service. Text entry remains available when APIs, microphone permission, a language, network access, or playback voices are unavailable.
- A worker must review the transcript and report fields on the confirmation screen before continuing. Voice capture itself never submits a report.

Voice capture requires a verified backend login for server transcription and a configured worker account for saved workflows. If the API is unavailable, sign-in fails and no local-only workflow or fake submission is offered.

## Optional local Faster-Whisper fallback

The default backend does not install Faster-Whisper, download a model, or require a paid AI credential. To enable the record-and-transcribe button:

1. Install the optional Python dependency with `pip install -r backend/requirements-whisper.txt`.
2. Place a compatible Faster-Whisper model directory on the backend machine. Set `WHISPER_MODEL_PATH` in `backend/.env` to that local directory. The backend only loads an existing directory and never resolves a remote model name.
3. Configure `WHISPER_DEVICE` (`cpu` by default), `WHISPER_COMPUTE_TYPE` (`int8` by default), and `WHISPER_MAX_AUDIO_MB` (20 MB by default) as needed.
4. Restart the backend and sign in with a provisioned worker account. `GET /api/voice/capabilities` reports whether the optional path is available; `POST /api/voice/transcribe` accepts multipart audio plus `language=en|ta|hi`.

The route is worker-authenticated, accepts common browser audio formats, applies an upload-size cap, and writes its temporary audio under an automatically removed temporary directory. It returns only the transcript and language. No audio, transcript-derived safety decision, or model output is saved by the voice service. An empty/failed transcription returns an error so the UI can keep the report in text entry.

## Implementation locations

- Browser engine and controls: `frontend/src/services/speech.ts`, `frontend/src/components/voice/VoiceControls.tsx`
- Worker screens and selected language: `frontend/src/pages/worker/WorkerPages.tsx`
- Optional backend: `backend/app/api/voice.py`, configured through `backend/app/core/config.py`
- Optional install: `backend/requirements-whisper.txt`
