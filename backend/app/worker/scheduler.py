"""
Asyncio-based background scheduler.

Each job runs its synchronous DB work in a thread pool via asyncio.to_thread
(never blocks the event loop), then uses the async WebSocket manager to
broadcast results to connected clients.

Lifecycle:
    tasks = await start_background_workers()   # called from FastAPI lifespan
    ...
    stop_background_workers(tasks)             # called on shutdown
"""

import asyncio
import logging
from typing import List

logger = logging.getLogger(__name__)

# How often each job fires (seconds)
LOCK_EXPIRY_INTERVAL = 30
QUEUE_ADMISSION_INTERVAL = 30


async def _release_expired_locks_job() -> None:
    """
    Thread-pool → DB expiry sweep → async WS broadcast.
    """
    from app.worker.tasks import sync_release_expired_locks
    from app.websocket.manager import manager
    from app.websocket.events import SEAT_STATUS_CHANGED

    released = await asyncio.to_thread(sync_release_expired_locks)
    for event_id, seat_id in released:
        await manager.broadcast_to_event(
            event_id,
            {
                "type": SEAT_STATUS_CHANGED,
                "seat_id": seat_id,
                "status": "available",
            },
        )


async def _admit_queue_batches_job() -> None:
    """
    Thread-pool → DB batch admission → async WS broadcast.
    """
    from app.worker.tasks import sync_admit_queue_batches
    from app.websocket.manager import manager
    from app.websocket.events import QUEUE_ADMITTED

    admitted = await asyncio.to_thread(sync_admit_queue_batches)
    for event_id, user_id, token in admitted:
        await manager.broadcast_to_event(
            event_id,
            {
                "type": QUEUE_ADMITTED,
                "user_id": user_id,
                "token": token,
            },
        )


async def _run_every(interval: float, job, name: str) -> None:
    """Run `job` every `interval` seconds; log but don't crash on errors."""
    # Small initial delay so the DB is ready before the first sweep
    await asyncio.sleep(10)
    while True:
        try:
            await job()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Background job '%s' raised: %s", name, exc)
        await asyncio.sleep(interval)


async def start_background_workers() -> List[asyncio.Task]:
    """
    Create and return all periodic background tasks.
    Tasks run inside the FastAPI asyncio event loop, giving them direct
    access to the in-process WebSocket manager.
    """
    tasks = [
        asyncio.create_task(
            _run_every(LOCK_EXPIRY_INTERVAL, _release_expired_locks_job, "release_expired_locks"),
            name="release_expired_locks",
        ),
        asyncio.create_task(
            _run_every(QUEUE_ADMISSION_INTERVAL, _admit_queue_batches_job, "admit_queue_batches"),
            name="admit_queue_batches",
        ),
    ]
    logger.info("Started %d background worker(s)", len(tasks))
    return tasks


def stop_background_workers(tasks: List[asyncio.Task]) -> None:
    for task in tasks:
        if not task.done():
            task.cancel()
    logger.info("Background workers cancelled")
