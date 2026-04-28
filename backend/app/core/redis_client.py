"""
Redis client factory.

Two clients are exposed:
  sync_redis   — synchronous, used inside background worker thread-pool jobs
  async_redis  — async (redis.asyncio), used directly in FastAPI handlers

Both share the same connection parameters from Settings. The async client
uses a connection pool internally (the default), so it is safe to import
as a module-level singleton in a multi-coroutine FastAPI app.
"""

import redis
import redis.asyncio as aioredis

from app.core.config import settings


def _kwargs() -> dict:
    kw: dict = {
        "host": settings.REDIS_HOST,
        "port": settings.REDIS_PORT,
        "db": settings.REDIS_DB,
        "decode_responses": True,
    }
    if settings.REDIS_PASSWORD:
        kw["password"] = settings.REDIS_PASSWORD
    return kw


# Synchronous client — wrap calls in asyncio.to_thread when used from async code
sync_redis: redis.Redis = redis.Redis(**_kwargs())

# Async client — use directly from async FastAPI route handlers and WS jobs
async_redis: aioredis.Redis = aioredis.Redis(**_kwargs())
