import asyncio
from threading import RLock
from typing import Any

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SupervisorAssignment


class UpdateHub:
    """In-process, user-scoped notifications; clients reload authorized records over HTTP."""

    def __init__(self) -> None:
        self._connections: dict[int, dict[WebSocket, asyncio.AbstractEventLoop]] = {}
        self._lock = RLock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        loop = asyncio.get_running_loop()
        with self._lock:
            self._connections.setdefault(user_id, {})[websocket] = loop

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        with self._lock:
            connections = self._connections.get(user_id)
            if connections is None:
                return
            connections.pop(websocket, None)
            if not connections:
                self._connections.pop(user_id, None)

    def notify(self, user_ids: set[int], event_type: str) -> None:
        message: dict[str, Any] = {"type": event_type}
        with self._lock:
            targets = [
                (websocket, loop)
                for user_id in user_ids
                for websocket, loop in self._connections.get(user_id, {}).items()
            ]
        for websocket, loop in targets:
            loop.call_soon_threadsafe(self._schedule_send, websocket, message)

    @staticmethod
    def _schedule_send(websocket: WebSocket, message: dict[str, Any]) -> None:
        asyncio.create_task(UpdateHub._send(websocket, message))

    @staticmethod
    async def _send(websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            # The receiver will be removed when its WebSocket handler observes the close.
            return


update_hub = UpdateHub()


def notify_worker_and_supervisors(db: Session, worker_id: int, event_type: str) -> None:
    supervisor_ids = set(db.scalars(select(SupervisorAssignment.supervisor_id).where(
        SupervisorAssignment.worker_id == worker_id,
    )).all())
    update_hub.notify({worker_id, *supervisor_ids}, event_type)
