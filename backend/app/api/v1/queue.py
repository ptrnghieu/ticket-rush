"""
Virtual Queue endpoints — backed by Redis for real-time position tracking.

Flow:
  1. Admin activates queue mode for an event  (POST /admin/events/{id}/queue/activate)
  2. Users join the queue                     (POST /queue/join/{event_id})
  3. Background worker admits batches every 30s and broadcasts via WebSocket
  4. Admitted users check their token         (GET  /queue/check/{event_id}/{token})
  5. Admitted users proceed to seat selection (seat lock enforces queue check)
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_master_db, get_slave_db
from app.core.redis_client import async_redis
from app.models.queue_session import QueueSession, QueueStatus
from app.models.user import User
from app.repositories.queue_session import QueueSessionRepository
from app.schemas.queue import QueueJoinResponse, QueueStatusResponse
from app.services.auth import get_current_user
from app.services.queue import RedisQueueService

router = APIRouter()


def _queue_svc() -> RedisQueueService:
    return RedisQueueService(async_redis)


@router.post(
    "/join/{event_id}",
    response_model=QueueJoinResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enter the virtual waiting room for an event",
)
async def join_queue(
    event_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    svc = _queue_svc()

    # Idempotent join — get existing or create new Redis session
    redis_session = await svc.join(event_id, current_user.id)

    # Mirror to DB for persistence / analytics (upsert pattern)
    repo = QueueSessionRepository(db)
    db_session = repo.get_user_session(current_user.id, event_id)
    if not db_session:
        db_session = QueueSession(
            user_id=current_user.id,
            event_id=event_id,
            token=redis_session["token"],
            position=redis_session["position"],
            status=QueueStatus.waiting,
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)

    return QueueJoinResponse(
        id=db_session.id,
        event_id=event_id,
        token=redis_session["token"],
        position=redis_session["position"],
        status=QueueStatus(redis_session["status"]),
    )


@router.get(
    "/status/{event_id}",
    response_model=QueueStatusResponse,
    summary="Live queue position and estimated wait time",
)
async def queue_status(
    event_id: int,
    current_user: User = Depends(get_current_user),
):
    svc = _queue_svc()
    session = await svc.get_session(event_id, current_user.id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not in the queue for this event",
        )

    from app.core.config import settings
    # live_rank may be None if already admitted (removed from sorted set)
    live_rank = session.get("live_rank") or session["position"]
    batches_ahead = max(0, live_rank - 1) // settings.QUEUE_BATCH_SIZE
    estimated_wait = round(batches_ahead * 0.5, 1)

    return QueueStatusResponse(
        id=0,   # Redis-only session; DB id not needed here
        position=live_rank,
        status=QueueStatus(session["status"]),
        queue_size=session["queue_size"],
        estimated_wait_minutes=estimated_wait,
    )


@router.get(
    "/check/{event_id}/{token}",
    summary="Verify whether a queue token has been admitted (10-min window)",
)
async def check_admission(event_id: int, token: str):
    svc = _queue_svc()
    admitted = await svc.is_admitted(event_id, token)
    return {"admitted": admitted, "event_id": event_id}


@router.delete(
    "/leave/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave the queue voluntarily",
)
async def leave_queue(
    event_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    svc = _queue_svc()
    await svc.leave(event_id, current_user.id)

    # Mark DB session as expired
    repo = QueueSessionRepository(db)
    db_session = repo.get_user_session(current_user.id, event_id)
    if db_session:
        db_session.status = QueueStatus.expired
        db.commit()
