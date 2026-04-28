"""
Virtual Queue endpoints.

Users join the queue when an event is in high-demand mode.
The background worker (Phase 4) admits batches and broadcasts
position updates over WebSocket (Phase 4).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_master_db, get_slave_db
from app.models.queue_session import QueueSession, QueueStatus
from app.models.user import User
from app.repositories.queue_session import QueueSessionRepository
from app.schemas.queue import QueueJoinResponse, QueueStatusResponse
from app.services.auth import get_current_user

router = APIRouter()


@router.post(
    "/join/{event_id}",
    response_model=QueueJoinResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enter the virtual waiting room for an event",
)
def join_queue(
    event_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    repo = QueueSessionRepository(db)

    # Idempotent — return existing session if already waiting
    existing = repo.get_user_session(current_user.id, event_id)
    if existing:
        return existing

    position = repo.get_next_position(event_id)
    session = QueueSession(
        user_id=current_user.id,
        event_id=event_id,
        token=str(uuid.uuid4()),
        position=position,
        status=QueueStatus.waiting,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get(
    "/status/{event_id}",
    response_model=QueueStatusResponse,
    summary="Check your current queue position and estimated wait",
)
def queue_status(
    event_id: int,
    db: Session = Depends(get_slave_db),
    current_user: User = Depends(get_current_user),
):
    repo = QueueSessionRepository(db)
    session = repo.get_user_session(current_user.id, event_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not in the queue for this event",
        )

    queue_size = repo.get_queue_size(event_id)
    # Estimate: one batch of QUEUE_BATCH_SIZE admitted every ~30 seconds
    batches_ahead = max(0, session.position - 1) // settings.QUEUE_BATCH_SIZE
    estimated_wait = round(batches_ahead * 0.5, 1)  # 0.5 min per batch

    return QueueStatusResponse(
        id=session.id,
        position=session.position,
        status=session.status,
        queue_size=queue_size,
        estimated_wait_minutes=estimated_wait,
    )
