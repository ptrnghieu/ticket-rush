"""
WebSocket endpoint for real-time seat-status and queue updates.

Connect:
    ws://host/api/v1/ws/events/{event_id}?token=<jwt>

The JWT token is passed as a query param because browsers cannot set
custom Authorization headers on WebSocket connections.

Auth is optional: unauthenticated clients still receive seat-status
broadcasts; authenticated clients also receive personalised queue events.

Messages received from server:
    {"type": "seat_status_changed", "seat_id": 42, "status": "available"}
    {"type": "queue_position_updated", "position": 15, "queue_size": 200}
    {"type": "queue_admitted", "user_id": 7, "token": "..."}
    {"type": "pong"}

Messages sent by client:
    "ping"   → server replies "pong" (keep-alive)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.websocket.events import PONG
from app.websocket.manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/events/{event_id}")
async def seat_websocket(
    websocket: WebSocket,
    event_id: int,
    token: Optional[str] = Query(None, description="JWT access token (optional)"),
):
    # Decode JWT when provided; store user_id on ws.state for targeted broadcasts
    user_id: Optional[int] = None
    if token:
        try:
            payload = decode_access_token(token)
            user_id = int(payload.get("sub", 0)) or None
        except Exception:
            # Invalid token — accept as unauthenticated rather than refusing
            logger.warning("WS connection with invalid token for event %s", event_id)

    websocket.state.user_id = user_id
    await manager.connect(websocket, event_id)

    try:
        while True:
            data = await websocket.receive_text()
            if data.strip().lower() == "ping":
                await websocket.send_json({"type": PONG})
    except WebSocketDisconnect:
        await manager.disconnect(websocket, event_id)
    except Exception as exc:
        logger.error("WS error event=%s user=%s: %s", event_id, user_id, exc)
        await manager.disconnect(websocket, event_id)
