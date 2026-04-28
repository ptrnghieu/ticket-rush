"""
Synchronous job implementations.

These functions run in a thread pool via asyncio.to_thread() so they never
block the FastAPI event loop. Each function:
  - Opens its own SQLAlchemy session (master)
  - Does all DB work inside that session
  - Closes the session in a finally block
  - Returns data (not side-effects) so the async caller can broadcast via WS

Also exported as Celery tasks (see celery_app.py) for horizontal scale-out.
"""

import logging
from typing import List, Tuple

from app.core.config import settings
from app.core.database import MasterSessionLocal
from app.models.queue_session import QueueStatus
from app.models.seat import SeatStatus
from app.models.ticket_lock import LockStatus

logger = logging.getLogger(__name__)

# Type aliases for broadcast payloads
_ReleasedSeat = Tuple[int, int]   # (event_id, seat_id)
_AdmittedUser = Tuple[int, int, str]  # (event_id, user_id, token)


def sync_release_expired_locks() -> List[_ReleasedSeat]:
    """
    Find every active TicketLock whose expires_at has passed, then atomically:
      1. SELECT seat FOR UPDATE  (prevent race with booking or other expiry runs)
      2. seat.status  → available
      3. lock.status  → expired
      4. COMMIT

    Returns (event_id, seat_id) pairs so the scheduler can broadcast
    SEAT_STATUS_CHANGED to the correct WS room.
    """
    db = MasterSessionLocal()
    released: List[_ReleasedSeat] = []

    try:
        from app.repositories.ticket_lock import TicketLockRepository
        from app.repositories.seat import SeatRepository
        from app.models.section import Section

        lock_repo = TicketLockRepository(db)
        seat_repo = SeatRepository(db)

        expired_locks = lock_repo.get_expired_active_locks()
        if not expired_locks:
            return released

        for lock in expired_locks:
            try:
                # Re-acquire row lock before mutating; prevents race with checkout
                seat = seat_repo.lock_for_update(lock.seat_id)

                if seat and seat.status == SeatStatus.locked:
                    seat.status = SeatStatus.available

                lock.status = LockStatus.expired
                db.commit()

                # Resolve event_id for WS broadcast
                if seat:
                    section = db.get(Section, seat.section_id)
                    if section:
                        released.append((section.event_id, lock.seat_id))

            except Exception as exc:
                db.rollback()
                logger.error("Failed to release lock id=%s: %s", lock.id, exc)

        if released:
            logger.info("Released %d expired seat lock(s)", len(released))

    finally:
        db.close()

    return released


def sync_admit_queue_batches() -> List[_AdmittedUser]:
    """
    For every event that has waiting users, admit the next QUEUE_BATCH_SIZE
    sessions (SELECT … FOR UPDATE SKIP LOCKED prevents double-admission
    when multiple workers run concurrently).

    Returns (event_id, user_id, token) triples for WS broadcasting.
    """
    db = MasterSessionLocal()
    admitted: List[_AdmittedUser] = []

    try:
        from sqlalchemy import select
        from app.models.queue_session import QueueSession
        from app.repositories.queue_session import QueueSessionRepository

        # Find all events that have at least one waiting user
        stmt = (
            select(QueueSession.event_id)
            .where(QueueSession.status == QueueStatus.waiting)
            .distinct()
        )
        event_ids = [row[0] for row in db.execute(stmt).all()]

        for event_id in event_ids:
            repo = QueueSessionRepository(db)
            batch = repo.get_next_waiting_batch(event_id, settings.QUEUE_BATCH_SIZE)

            for session in batch:
                session.status = QueueStatus.admitted
                admitted.append((event_id, session.user_id, session.token))

            if batch:
                db.commit()
                logger.info("Admitted %d user(s) for event %s", len(batch), event_id)

    except Exception as exc:
        db.rollback()
        logger.error("Queue admission failed: %s", exc)
    finally:
        db.close()

    return admitted
