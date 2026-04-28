from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.queue_session import QueueSession, QueueStatus
from app.repositories.base import BaseRepository


class QueueSessionRepository(BaseRepository[QueueSession]):
    def __init__(self, db: Session) -> None:
        super().__init__(QueueSession, db)

    def get_by_token(self, token: str) -> Optional[QueueSession]:
        stmt = select(QueueSession).where(QueueSession.token == token)
        return self.db.scalars(stmt).first()

    def get_user_session(self, user_id: int, event_id: int) -> Optional[QueueSession]:
        stmt = select(QueueSession).where(
            QueueSession.user_id == user_id,
            QueueSession.event_id == event_id,
            QueueSession.status == QueueStatus.waiting,
        )
        return self.db.scalars(stmt).first()

    def get_next_waiting_batch(
        self, event_id: int, batch_size: int
    ) -> List[QueueSession]:
        """
        Fetch the next N waiting sessions in position order with a
        FOR UPDATE lock so the batch worker can safely update them
        without racing against other worker instances.
        """
        stmt = (
            select(QueueSession)
            .where(
                QueueSession.event_id == event_id,
                QueueSession.status == QueueStatus.waiting,
            )
            .order_by(QueueSession.position.asc())
            .limit(batch_size)
            .with_for_update(skip_locked=True)  # skip rows locked by another worker
        )
        return list(self.db.scalars(stmt).all())

    def get_queue_size(self, event_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(QueueSession)
            .where(
                QueueSession.event_id == event_id,
                QueueSession.status == QueueStatus.waiting,
            )
        )
        return self.db.scalar(stmt) or 0

    def get_next_position(self, event_id: int) -> int:
        """Atomically determine the next queue position for this event."""
        stmt = (
            select(func.max(QueueSession.position))
            .where(QueueSession.event_id == event_id)
        )
        max_pos = self.db.scalar(stmt)
        return (max_pos or 0) + 1
