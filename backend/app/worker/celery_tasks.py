"""
Celery task wrappers — thin shell around the sync task functions.

Celery workers cannot push directly to the in-process WS manager.
Instead they publish seat/queue events to Redis pub/sub channels so
the FastAPI process can forward them to WebSocket clients.
"""

import json
import logging

from app.worker.celery_app import celery_app
from app.worker.tasks import sync_release_expired_locks, sync_admit_queue_batches
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_redis():
    import redis as _redis
    return _redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None,
        db=settings.REDIS_DB,
        decode_responses=True,
    )


@celery_app.task(name="app.worker.celery_tasks.release_expired_locks")
def release_expired_locks():
    released = sync_release_expired_locks()
    if not released:
        return

    r = _get_redis()
    for event_id, seat_id in released:
        r.publish(
            f"seat:event:{event_id}",
            json.dumps({"type": "seat_status_changed", "seat_id": seat_id, "status": "available"}),
        )


@celery_app.task(name="app.worker.celery_tasks.admit_queue_batches")
def admit_queue_batches():
    admitted = sync_admit_queue_batches()
    if not admitted:
        return

    r = _get_redis()
    for event_id, user_id, token in admitted:
        r.publish(
            f"seat:event:{event_id}",
            json.dumps({"type": "queue_admitted", "user_id": user_id, "token": token}),
        )
