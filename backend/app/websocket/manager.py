"""
WebSocket ConnectionManager — singleton that tracks all live connections.

Connections are grouped by event_id so broadcasts are scoped to clients
watching a specific event. Asyncio-safe; do NOT call from synchronous code.

Usage:
    from app.websocket.manager import manager   # import the singleton
    await manager.connect(websocket, event_id)
    await manager.broadcast_to_event(event_id, {"type": "...", ...})
"""

import asyncio
import logging
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # event_id → set of live WebSocket connections
        self._connections: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, event_id: int) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(event_id, set()).add(websocket)
        logger.info("WS client connected  event=%s total=%s", event_id, self.count(event_id))

    async def disconnect(self, websocket: WebSocket, event_id: int) -> None:
        async with self._lock:
            bucket = self._connections.get(event_id, set())
            bucket.discard(websocket)
            if not bucket:
                self._connections.pop(event_id, None)
        logger.info("WS client disconnected event=%s", event_id)

    async def broadcast_to_event(self, event_id: int, message: dict) -> None:
        """
        Send a JSON message to every client watching event_id.
        Dead connections are silently pruned.
        """
        async with self._lock:
            # Snapshot to avoid holding the lock during I/O
            connections = set(self._connections.get(event_id, set()))

        if not connections:
            return

        dead: Set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)

        if dead:
            async with self._lock:
                bucket = self._connections.get(event_id, set())
                bucket -= dead
                if not bucket:
                    self._connections.pop(event_id, None)

    async def broadcast_to_user(self, event_id: int, user_id: int, message: dict) -> None:
        """
        Send a message to a specific user's connection(s) within an event.
        Stored user_id is attached to the websocket object as ws.state.user_id.
        """
        async with self._lock:
            connections = {
                ws for ws in self._connections.get(event_id, set())
                if getattr(ws.state, "user_id", None) == user_id
            }
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    def count(self, event_id: int) -> int:
        return len(self._connections.get(event_id, set()))


# Module-level singleton — imported by the WS endpoint and the background worker
manager = ConnectionManager()
