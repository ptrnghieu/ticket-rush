from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ticket_lock import TicketLock, LockStatus
from app.repositories.base import BaseRepository


class TicketLockRepository(BaseRepository[TicketLock]):
    def __init__(self, db: Session) -> None:
        super().__init__(TicketLock, db)

    def get_active_lock_for_seat(self, seat_id: int) -> Optional[TicketLock]:
        stmt = (
            select(TicketLock)
            .where(
                TicketLock.seat_id == seat_id,
                TicketLock.status == LockStatus.active,
            )
        )
        return self.db.scalars(stmt).first()

    def get_active_locks_for_user(self, user_id: int) -> List[TicketLock]:
        """All non-expired active locks held by a user — used before checkout."""
        stmt = (
            select(TicketLock)
            .where(
                TicketLock.user_id == user_id,
                TicketLock.status == LockStatus.active,
                TicketLock.expires_at > datetime.utcnow(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_expired_active_locks(self) -> List[TicketLock]:
        """
        Used exclusively by the background expiry worker (Phase 4).
        Returns locks whose TTL has elapsed but are still marked 'active'.
        """
        stmt = (
            select(TicketLock)
            .where(
                TicketLock.status == LockStatus.active,
                TicketLock.expires_at <= datetime.utcnow(),
            )
        )
        return list(self.db.scalars(stmt).all())
