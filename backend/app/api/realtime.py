import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models import User
from app.services.events import update_hub

router = APIRouter(tags=["real-time updates"])


@router.websocket("/ws/updates")
async def websocket_updates(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    user_id: int | None = None
    try:
        try:
            raw_authentication = await asyncio.wait_for(websocket.receive_text(), timeout=5)
            if len(raw_authentication) > 4096:
                await websocket.close(code=4401)
                return
            authentication = json.loads(raw_authentication)
        except (json.JSONDecodeError, WebSocketDisconnect, TimeoutError):
            await websocket.close(code=4401)
            return
        token = authentication.get("token") if isinstance(authentication, dict) else None
        claims = decode_access_token(token) if isinstance(token, str) else None
        subject = claims.get("sub") if claims else None
        try:
            user_id = int(subject)
        except (TypeError, ValueError):
            await websocket.close(code=4401)
            return

        with SessionLocal() as db:
            user = db.get(User, user_id)
            if user is None or not user.is_active:
                await websocket.close(code=4401)
                return

        await update_hub.connect(user_id, websocket)
        await websocket.send_json({"type": "connected"})
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                if not isinstance(token, str) or decode_access_token(token) is None:
                    await websocket.close(code=4401)
                    return
                with SessionLocal() as db:
                    user = db.get(User, user_id)
                    if user is None or not user.is_active:
                        await websocket.close(code=4401)
                        return
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.close(code=4400)
                return
    except WebSocketDisconnect:
        pass
    finally:
        if user_id is not None:
            update_hub.disconnect(user_id, websocket)
