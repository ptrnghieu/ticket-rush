"""
Celery configuration for horizontal scale-out.

Use this when you need multiple worker processes (e.g., Kubernetes pods).
In single-node / dev mode the asyncio scheduler in scheduler.py is sufficient.

To run:
    celery -A app.worker.celery_app worker --loglevel=info
    celery -A app.worker.celery_app beat  --loglevel=info   # periodic scheduler

NOTE: Celery workers cannot access the in-process WebSocket manager directly.
For WS broadcasting from Celery, publish events to a Redis pub/sub channel
and have the FastAPI WS handler subscribe to it (see Redis pub/sub pattern).
"""

from celery import Celery

from app.core.config import settings

_pw = f":{settings.REDIS_PASSWORD}@" if settings.REDIS_PASSWORD else ""
_redis_url = f"redis://{_pw}{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"

celery_app = Celery(
    "ticketrush",
    broker=_redis_url,
    backend=_redis_url,
    include=["app.worker.celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "release-expired-locks": {
            "task": "app.worker.celery_tasks.release_expired_locks",
            "schedule": 30.0,
        },
        "admit-queue-batches": {
            "task": "app.worker.celery_tasks.admit_queue_batches",
            "schedule": 30.0,
        },
    },
)
