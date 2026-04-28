"""
SeatService — the heart of TicketRush's concurrency-control system.

PESSIMISTIC ROW-LEVEL LOCKING PROTOCOL
──────────────────────────────────────────────────────────────────────────────
Step 1  BEGIN TRANSACTION    SQLAlchemy session (autocommit=False by default)
Step 2  FOR UPDATE           InnoDB acquires exclusive X-lock on the seat row
Step 3  CHECK available      Only ONE transaction passes; all others block at 2
Step 4  UPDATE → locked      Seat status written inside the locked transaction
Step 5  INSERT lock record   TicketLock with 10-min TTL
Step 6  COMMIT               X-lock released; next waiting transaction unblocks
──────────────────────────────────────────────────────────────────────────────

Multi-seat transactions always acquire locks in ascending seat_id order so
that two concurrent requests for overlapping seat sets can never deadlock.

MUST be injected with the MASTER session — slaves are async replicas and
cannot grant InnoDB X-locks.
"""

from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import LockNotOwnedError, SeatNotAvailableError, SeatNotFoundError
from app.models.seat import Seat, SeatStatus
from app.models.section import Section
from app.models.ticket_lock import LockStatus, TicketLock
from app.repositories.seat import SeatRepository
from app.repositories.ticket_lock import TicketLockRepository


class SeatService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.seat_repo = SeatRepository(db)
        self.lock_repo = TicketLockRepository(db)

    # ── Single-seat lock ──────────────────────────────────────────────────────

    def lock_seat(self, seat_id: int, user_id: int) -> TicketLock:
        """
        Atomically lock one seat for the given user.

        Raises:
            SeatNotFoundError    — seat_id doesn't exist
            SeatNotAvailableError — seat is locked or sold
        """
        try:
            # ── Step 2: Acquire exclusive row-level lock ──────────────────────
            seat = self.seat_repo.lock_for_update(seat_id)
            if not seat:
                raise SeatNotFoundError(seat_id)

            # ── Step 3: Validate — serialised by the X-lock ───────────────────
            if seat.status != SeatStatus.available:
                raise SeatNotAvailableError(seat_id, seat.status.value)

            # ── Step 4: Transition status ─────────────────────────────────────
            seat.status = SeatStatus.locked

            # ── Step 5: Create lock record with TTL ───────────────────────────
            lock = TicketLock(
                seat_id=seat_id,
                user_id=user_id,
                expires_at=datetime.utcnow()
                + timedelta(seconds=settings.SEAT_LOCK_DURATION_SECONDS),
                status=LockStatus.active,
            )
            self.db.add(lock)

            # ── Step 6: Commit — X-lock released, next waiter unblocks ────────
            self.db.commit()
            self.db.refresh(lock)
            return lock

        except (SeatNotFoundError, SeatNotAvailableError):
            self.db.rollback()
            raise
        except Exception:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to lock seat — please try again",
            )

    # ── Multi-seat lock (single atomic transaction) ───────────────────────────

    def lock_multiple_seats(self, seat_ids: List[int], user_id: int) -> List[TicketLock]:
        """
        Lock several seats atomically.

        seat_ids are deduplicated and sorted ascending before locking so
        that concurrent multi-seat requests always acquire locks in the
        same order — eliminating the risk of circular waits (deadlocks).
        """
        seat_ids = sorted(set(seat_ids))

        try:
            # One query acquires all X-locks in id order
            seats = self.seat_repo.lock_multiple_for_update(seat_ids)

            if len(seats) != len(seat_ids):
                found = {s.id for s in seats}
                missing = [sid for sid in seat_ids if sid not in found]
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Seats not found: {missing}",
                )

            # Validate ALL seats before mutating ANY — keeps the TX clean
            unavailable = [s for s in seats if s.status != SeatStatus.available]
            if unavailable:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Seats not available: {[s.id for s in unavailable]}",
                )

            expires_at = datetime.utcnow() + timedelta(
                seconds=settings.SEAT_LOCK_DURATION_SECONDS
            )
            locks: List[TicketLock] = []
            for seat in seats:
                seat.status = SeatStatus.locked
                lock = TicketLock(
                    seat_id=seat.id,
                    user_id=user_id,
                    expires_at=expires_at,
                    status=LockStatus.active,
                )
                self.db.add(lock)
                locks.append(lock)

            self.db.commit()
            for lock in locks:
                self.db.refresh(lock)
            return locks

        except HTTPException:
            self.db.rollback()
            raise
        except Exception:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to lock seats — please try again",
            )

    # ── Release lock (user cancels selection) ─────────────────────────────────

    def release_lock(self, seat_id: int, user_id: int) -> None:
        """
        Release a seat lock before it expires.
        Uses FOR UPDATE to prevent race with the expiry worker.
        """
        try:
            seat = self.seat_repo.lock_for_update(seat_id)
            if not seat:
                raise SeatNotFoundError(seat_id)

            lock = self.lock_repo.get_active_lock_for_seat(seat_id)
            if not lock or lock.user_id != user_id:
                raise LockNotOwnedError()

            lock.status = LockStatus.released
            seat.status = SeatStatus.available
            self.db.commit()

        except (SeatNotFoundError, LockNotOwnedError):
            self.db.rollback()
            raise
        except Exception:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to release seat lock",
            )

    # ── Read operations (use slave session for these) ─────────────────────────

    def get_seat_matrix(self, section_id: int) -> List[Seat]:
        """Returns the full seat grid. Call with a slave DB session."""
        return self.seat_repo.get_by_section(section_id)

    def get_occupancy(self, event_id: int) -> dict:
        """Aggregated status counts for the admin dashboard."""
        return self.seat_repo.count_all_by_status(event_id)

    # ── Admin: seat generation ────────────────────────────────────────────────

    def generate_seats(
        self, section_id: int, row_count: int, col_count: int
    ) -> List[Seat]:
        """
        Generate a full row×col seat grid for a section.
        Row labels cycle A–Z; beyond 26 rows uses numeric string labels.
        """
        _LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        seats: List[Seat] = []
        for row in range(1, row_count + 1):
            label = _LABELS[row - 1] if row <= 26 else str(row)
            for col in range(1, col_count + 1):
                seats.append(
                    Seat(
                        section_id=section_id,
                        row_number=row,
                        seat_number=col,
                        row_label=label,
                        status=SeatStatus.available,
                    )
                )
        self.db.add_all(seats)
        self.db.commit()
        return seats
