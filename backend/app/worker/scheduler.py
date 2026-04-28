"""
Asyncio-based background scheduler.

Jobs:
  release_expired_locks    every 30s — expire seat holds, broadcast SEAT_STATUS_CHANGED
  admit_queue_batches      every 30s — Redis ZPOPMIN admission, broadcast QUEUE_ADMITTED
  broadcast_queue_status   every 60s — broadcast queue size so clients can estimate wait

Each job:
  1. asyncio.to_thread()  → runs sync DB / Redis work without blocking the event loop
  2. Broadcasts results   → in the same event loop as the WS manager (direct await)

Lifecycle:
    tasks = await start_background_workers()   # FastAPI lifespan startup
    stop_background_workers(tasks)             # FastAPI lifespan shutdown
"""

import asyncio
import logging
from typing import List

logger = logging.getLogger(__name__)

LOCK_EXPIRY_INTERVAL = 30
QUEUE_ADMISSION_INTERVAL = 30
QUEUE_STATUS_INTERVAL = 60


# ── Job implementations ───────────────────────────────────────────────────────

async def _release_expired_locks_job() -> None:
    from app.worker.tasks import sync_release_expired_locks
    from app.websocket.manager import manager
    from app.websocket.events import SEAT_STATUS_CHANGED

    released = await asyncio.to_thread(sync_release_expired_locks)
    for event_id, seat_id in released:
        await manager.broadcast_to_event(
            event_id,
            {"type": SEAT_STATUS_CHANGED, "seat_id": seat_id, "status": "available"},
        )


async def _admit_queue_batches_job() -> None:
    from app.worker.tasks import sync_admit_queue_batches
    from app.websocket.manager import manager
    from app.websocket.events import QUEUE_ADMITTED

    admitted = await asyncio.to_thread(sync_admit_queue_batches)
    for event_id, user_id, token in admitted:
        await manager.broadcast_to_event(
            event_id,
            {"type": QUEUE_ADMITTED, "user_id": user_id, "token": token},
        )


async def _broadcast_queue_status_job() -> None:
    """
    Broadcast queue size to every event room so waiting clients can
    recalculate their estimated wait without a round-trip to the server.
    Each client receives the same lightweight message; their individual
    rank is derived client-side as: my_initial_position - (total_admitted).
    """
    from app.worker.tasks import sync_broadcast_queue_positions
    from app.websocket.manager import manager
    from app.websocket.events import QUEUE_POSITION_UPDATED

    updates = await asyncio.to_thread(sync_broadcast_queue_positions)
    for event_id, queue_size, _ in updates:
        await manager.broadcast_to_event(
            event_id,
            {"type": QUEUE_POSITION_UPDATED, "queue_size": queue_size},
        )


# ── Scheduler loop ────────────────────────────────────────────────────────────

async def _run_every(interval: float, job, name: str) -> None:
    """Run `job` every `interval` seconds; log but never crash on errors."""
    await asyncio.sleep(10)   # small startup delay — let DB/Redis connect first
    while True:
        try:
            await job()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Background job '%s' raised: %s", name, exc)
        await asyncio.sleep(interval)


async def start_background_workers() -> List[asyncio.Task]:
    tasks = [
        asyncio.create_task(
            _run_every(LOCK_EXPIRY_INTERVAL, _release_expired_locks_job, "release_expired_locks"),
            name="release_expired_locks",
        ),
        asyncio.create_task(
            _run_every(QUEUE_ADMISSION_INTERVAL, _admit_queue_batches_job, "admit_queue_batches"),
            name="admit_queue_batches",
        ),
        asyncio.create_task(
            _run_every(QUEUE_STATUS_INTERVAL, _broadcast_queue_status_job, "broadcast_queue_status"),
            name="broadcast_queue_status",
        ),
    ]
    logger.info("Started %d background worker(s)", len(tasks))
    return tasks


def stop_background_workers(tasks: List[asyncio.Task]) -> None:
    for task in tasks:
        if not task.done():
            task.cancel()
    logger.info("Background workers cancelled")
