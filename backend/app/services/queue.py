"""
RedisQueueService — virtual waiting room backed entirely by Redis.

Redis data layout
─────────────────────────────────────────────────────────────────────────────
queue:event:{id}:mode          STRING   "active" | "inactive"
queue:event:{id}:counter       STRING   monotonic position counter (INCR)
queue:event:{id}:waiting       ZSET     member=user_id (str), score=position
queue:session:{id}:{uid}       HASH     token, position, status, joined_at
                                        TTL = SESSION_TTL
queue:admitted:{id}:{token}    STRING   "1", TTL = ADMISSION_TTL
─────────────────────────────────────────────────────────────────────────────

Design rationale:
  - INCR on counter is atomic → no two users get the same position
  - ZPOPMIN removes and returns the N lowest-scored members atomically
    → batch admission cannot race between concurrent worker instances
  - Short-lived "admitted" keys let the seat-selection page gate access
    without a DB round-trip
"""

import uuid
from datetime import datetime
from typing import List, Optional, Tuple

import redis.asyncio as aioredis


class RedisQueueService:
    SESSION_TTL = 7_200   # 2 h — how long session data lives in Redis
    ADMISSION_TTL = 600   # 10 min — window to proceed after being admitted

    def __init__(self, r: aioredis.Redis) -> None:
        self.r = r

    # ── Key helpers ───────────────────────────────────────────────────────────

    def _mode_key(self, eid: int) -> str:
        return f"queue:event:{eid}:mode"

    def _counter_key(self, eid: int) -> str:
        return f"queue:event:{eid}:counter"

    def _waiting_key(self, eid: int) -> str:
        return f"queue:event:{eid}:waiting"

    def _session_key(self, eid: int, uid: int) -> str:
        return f"queue:session:{eid}:{uid}"

    def _admitted_key(self, eid: int, token: str) -> str:
        return f"queue:admitted:{eid}:{token}"

    # ── Queue mode ────────────────────────────────────────────────────────────

    async def activate(self, event_id: int) -> None:
        """Admin action: enable queue mode for an event."""
        await self.r.set(self._mode_key(event_id), "active")

    async def deactivate(self, event_id: int) -> None:
        """Admin action: disable queue mode (direct access restored)."""
        await self.r.set(self._mode_key(event_id), "inactive")

    async def is_active(self, event_id: int) -> bool:
        return (await self.r.get(self._mode_key(event_id))) == "active"

    # ── Enqueue ───────────────────────────────────────────────────────────────

    async def join(self, event_id: int, user_id: int) -> dict:
        """
        Idempotent join: returns existing session data if the user is already
        waiting, otherwise atomically assigns a position and enqueues them.

        Returns:
            {"token": str, "position": int, "status": str}
        """
        session_key = self._session_key(event_id, user_id)
        existing = await self.r.hgetall(session_key)
        if existing:
            await self.r.expire(session_key, self.SESSION_TTL)
            existing["position"] = int(existing["position"])
            return existing

        # Assign a globally unique, monotonically increasing position
        position = await self.r.incr(self._counter_key(event_id))
        token = str(uuid.uuid4())

        pipe = self.r.pipeline()
        pipe.zadd(self._waiting_key(event_id), {str(user_id): position})
        pipe.hset(
            session_key,
            mapping={
                "token": token,
                "position": str(position),
                "status": "waiting",
                "joined_at": datetime.utcnow().isoformat(),
            },
        )
        pipe.expire(session_key, self.SESSION_TTL)
        await pipe.execute()

        return {"token": token, "position": position, "status": "waiting"}

    async def leave(self, event_id: int, user_id: int) -> None:
        """Remove a user from the queue (explicit leave or expiry)."""
        pipe = self.r.pipeline()
        pipe.zrem(self._waiting_key(event_id), str(user_id))
        pipe.delete(self._session_key(event_id, user_id))
        await pipe.execute()

    # ── Position ──────────────────────────────────────────────────────────────

    async def get_rank(self, event_id: int, user_id: int) -> Optional[int]:
        """
        Current 1-based rank in the waiting sorted set.
        Returns None if the user is not in the queue.
        """
        rank = await self.r.zrank(self._waiting_key(event_id), str(user_id))
        return (rank + 1) if rank is not None else None

    async def get_queue_size(self, event_id: int) -> int:
        return await self.r.zcard(self._waiting_key(event_id))

    async def get_session(self, event_id: int, user_id: int) -> Optional[dict]:
        """Full session data enriched with live rank and queue size."""
        data = await self.r.hgetall(self._session_key(event_id, user_id))
        if not data:
            return None
        data["position"] = int(data["position"])
        data["live_rank"] = await self.get_rank(event_id, user_id)
        data["queue_size"] = await self.get_queue_size(event_id)
        return data

    # ── Admission ─────────────────────────────────────────────────────────────

    async def admit_batch(
        self, event_id: int, batch_size: int
    ) -> List[Tuple[int, str]]:
        """
        Atomically pop the next `batch_size` users from the front of the queue.

        ZPOPMIN is O(log N + M) and atomic — no two concurrent workers can
        admit the same user even without a distributed lock.

        Returns list of (user_id, token) pairs for WebSocket broadcasting.
        """
        # ZPOPMIN returns [(b"member", score), ...]
        popped: list = await self.r.zpopmin(self._waiting_key(event_id), batch_size)
        if not popped:
            return []

        admitted: List[Tuple[int, str]] = []
        pipe = self.r.pipeline()

        for member, _score in popped:
            uid = int(member)
            skey = self._session_key(event_id, uid)
            pipe.hset(skey, "status", "admitted")
            pipe.expire(skey, self.SESSION_TTL)

        await pipe.execute()

        for member, _score in popped:
            uid = int(member)
            token = await self.r.hget(self._session_key(event_id, uid), "token")
            if token:
                # Grant a 10-minute admission window
                await self.r.setex(
                    self._admitted_key(event_id, token),
                    self.ADMISSION_TTL,
                    "1",
                )
                admitted.append((uid, token))

        return admitted

    async def is_admitted(self, event_id: int, token: str) -> bool:
        """
        Verify that a token was admitted and the 10-minute window has not elapsed.
        Called by the seat-selection page before allowing seat locking.
        """
        return (await self.r.get(self._admitted_key(event_id, token))) == "1"

    async def consume_admission(self, event_id: int, token: str) -> None:
        """Delete the admission key once the user starts selecting seats."""
        await self.r.delete(self._admitted_key(event_id, token))

    # ── Sync variants (for background worker thread pool) ─────────────────────

    @staticmethod
    def sync_admit_batch(
        sync_r,
        event_id: int,
        batch_size: int,
    ) -> List[Tuple[int, str]]:
        """
        Synchronous version — called from sync_admit_queue_batches() in tasks.py.
        Uses the sync Redis client passed in to avoid event-loop conflicts.
        """
        waiting_key = f"queue:event:{event_id}:waiting"
        session_prefix = f"queue:session:{event_id}:"
        admitted_prefix = f"queue:admitted:{event_id}:"

        popped = sync_r.zpopmin(waiting_key, batch_size)
        if not popped:
            return []

        admitted: List[Tuple[int, str]] = []
        pipe = sync_r.pipeline()

        for member, _score in popped:
            uid = int(member)
            pipe.hset(f"{session_prefix}{uid}", "status", "admitted")
            pipe.expire(f"{session_prefix}{uid}", RedisQueueService.SESSION_TTL)

        pipe.execute()

        for member, _score in popped:
            uid = int(member)
            token = sync_r.hget(f"{session_prefix}{uid}", "token")
            if token:
                sync_r.setex(
                    f"{admitted_prefix}{token}",
                    RedisQueueService.ADMISSION_TTL,
                    "1",
                )
                admitted.append((uid, token))

        return admitted
