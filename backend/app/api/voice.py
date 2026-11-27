import importlib.util
from functools import lru_cache
from pathlib import Path
import tempfile
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.api.dependencies import require_roles
from app.core.config import settings
from app.models import User
from app.models.enums import UserRole
from app.schemas import success

router = APIRouter(tags=["voice"])
_MIME_SUFFIX = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/aac": ".aac",
}


class TranscriptionData(BaseModel):
    transcript: str
    language: Literal["en", "ta", "hi"]


def _local_model_path() -> Path | None:
    configured = settings.whisper_model_path.strip()
    if not configured:
        return None
    path = Path(configured).expanduser().resolve()
    return path if path.is_dir() else None


def _whisper_ready() -> bool:
    return _local_model_path() is not None and importlib.util.find_spec("faster_whisper") is not None


@lru_cache(maxsize=1)
def _load_model(model_path: str, device: str, compute_type: str):
    from faster_whisper import WhisperModel

    return WhisperModel(model_path, device=device, compute_type=compute_type)


def _transcribe(path: Path, model_path: str, language: str) -> str:
    model = _load_model(model_path, settings.whisper_device, settings.whisper_compute_type)
    segments, _ = model.transcribe(str(path), language=language, beam_size=3, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()


@router.get("/voice/capabilities")
def voice_capabilities(user: User = Depends(require_roles(UserRole.WORKER))):
    del user
    return success({"whisper_fallback_available": _whisper_ready()})


@router.post("/voice/transcribe")
async def transcribe_audio(
    request: Request,
    audio: UploadFile = File(...),
    language: Literal["en", "ta", "hi"] = Form(...),
    user: User = Depends(require_roles(UserRole.WORKER)),
):
    del user
    model_path = _local_model_path()
    if model_path is None or importlib.util.find_spec("faster_whisper") is None:
        raise HTTPException(status_code=503, detail="Optional local Whisper transcription is not configured")
    max_bytes = max(1, settings.whisper_max_audio_mb) * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared_length = int(content_length)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid content length") from exc
        if declared_length > max_bytes + 64 * 1024:
            raise HTTPException(status_code=413, detail="Audio upload exceeds the configured size limit")
    media_type = (audio.content_type or "").split(";", maxsplit=1)[0].lower()
    suffix = _MIME_SUFFIX.get(media_type)
    if suffix is None:
        raise HTTPException(status_code=415, detail="Use a supported browser audio format")
    try:
        content = await audio.read(max_bytes + 1)
    finally:
        await audio.close()
    if not content:
        raise HTTPException(status_code=422, detail="The audio recording is empty")
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio must be no larger than {max_bytes // (1024 * 1024)} MB")
    try:
        with tempfile.TemporaryDirectory(prefix="voiceguard-audio-") as temp_dir:
            audio_path = Path(temp_dir) / f"recording{suffix}"
            audio_path.write_bytes(content)
            transcript = await run_in_threadpool(_transcribe, audio_path, str(model_path), language)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The local transcription model could not process this recording") from exc
    if not transcript:
        raise HTTPException(status_code=422, detail="No speech was recognized; you can enter the report as text")
    return success(TranscriptionData(transcript=transcript, language=language), "Audio transcribed locally")
