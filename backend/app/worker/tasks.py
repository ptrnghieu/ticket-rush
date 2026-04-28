"""
Synchronous job implementations (run in asyncio.to_thread — never block event loop).

Each function:
  - Opens its own SQLAlchemy + Redis session
  - Does all work, closes resources in finally
  - Returns data for the async caller to broadcast via WebSocket
"""

import logging
from typing import List, Tuple

from app.core.config import settings
from app.core.database import MasterSessionLocal
from app.core.redis_client import sync_redis
from app.models.queue_session import QueueStatus
from app.models.seat import SeatStatus
from app.models.ticket_lock import LockStatus
from app.services.queue import RedisQueueService

logger = logging.getLogger(__name__)

_ReleasedSeat = Tuple[int, int]    # (event_id, seat_id)
_AdmittedUser = Tuple[int, int, str]  # (event_id, user_id, token)


def sync_release_expired_locks() -> List[_ReleasedSeat]:
    """
    Sweep for active TicketLocks past their expiry, then for each:
      1. SELECT seat FOR UPDATE  (prevents race with concurrent booking)
      2. seat.status  → available
      3. lock.status  → expired
      4. COMMIT

    Returns (event_id, seat_id) so the scheduler can broadcast
    SEAT_STATUS_CHANGED to the right WebSocket room.
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
                seat = seat_repo.lock_for_update(lock.seat_id)
                if seat and seat.status == SeatStatus.locked:
                    seat.status = SeatStatus.available
                lock.status = LockStatus.expired
                db.commit()

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
    For every event with waiting users:
      1. Redis ZPOPMIN (atomic batch pop — safe for concurrent workers)
      2. Mark Redis session status → admitted + set admission key (10-min TTL)
      3. Mirror to DB: QueueSession.status → admitted

    Returns (event_id, user_id, token) triples for WebSocket broadcasting.
    """
    db = MasterSessionLocal()
    admitted: List[_AdmittedUser] = []

    try:
        from sqlalchemy import select
        from app.models.queue_session import QueueSession

        # Find events that still have waiting users in Redis
        # Fall back to DB query when Redis has no data (e.g., after restart)
        event_ids_stmt = (
            select(QueueSession.event_id)
            .where(QueueSession.status == QueueStatus.waiting)
            .distinct()
        )
        event_ids = [row[0] for row in db.execute(event_ids_stmt).all()]

        for event_id in event_ids:
            # Primary: use Redis atomic ZPOPMIN
            batch = RedisQueueService.sync_admit_batch(
                sync_redis, event_id, settings.QUEUE_BATCH_SIZE
            )

            if not batch:
                # Redis queue empty → fall back to DB-only admission
                from app.repositories.queue_session import QueueSessionRepository
                repo = QueueSessionRepository(db)
                db_batch = repo.get_next_waiting_batch(event_id, settings.QUEUE_BATCH_SIZE)
                for session in db_batch:
                    session.status = QueueStatus.admitted
                    admitted.append((event_id, session.user_id, session.token))
                if db_batch:
                    db.commit()
                continue

            # Mirror Redis admission to DB
            user_ids = [uid for uid, _token in batch]
            from sqlalchemy import update
            db.execute(
                update(QueueSession)
                .where(
                    QueueSession.event_id == event_id,
                    QueueSession.user_id.in_(user_ids),
                )
                .values(status=QueueStatus.admitted)
            )
            db.commit()

            for uid, token in batch:
                admitted.append((event_id, uid, token))

            logger.info("Admitted %d user(s) for event %s (Redis)", len(batch), event_id)

    except Exception as exc:
        db.rollback()
        logger.error("Queue admission failed: %s", exc)
    finally:
        db.close()

    return admitted


def sync_broadcast_queue_positions() -> List[Tuple[int, int, int]]:
    """
    Collect live queue sizes for all active events so the scheduler
    can send a lightweight QUEUE_BATCH_RELEASED broadcast.

    Returns (event_id, queue_size, admitted_in_last_batch) tuples.
    Used to send a 'queue_position_updated' message to all waiting clients
    without iterating over every individual user.
    """
    db = MasterSessionLocal()
    updates: List[Tuple[int, int, int]] = []

    try:
        from sqlalchemy import select, func
        from app.models.queue_session import QueueSession

        stmt = (
            select(QueueSession.event_id, func.count().label("cnt"))
            .where(QueueSession.status == QueueStatus.waiting)
            .group_by(QueueSession.event_id)
        )
        for row in db.execute(stmt).all():
            event_id, waiting_count = row
            redis_size = sync_redis.zcard(f"queue:event:{event_id}:waiting")
            updates.append((event_id, redis_size or waiting_count, 0))

    finally:
        db.close()

    return updates
