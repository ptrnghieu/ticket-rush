"""
QueueSession — virtual waiting-room record.

When demand exceeds capacity the event switches to queue mode:
  1. Each arriving user gets a QueueSession with a monotonically
     increasing position and a unique token.
  2. The background worker admits QUEUE_BATCH_SIZE users at a time
     by setting status → 'admitted' and publishing the token to Redis
     so the frontend can proceed to seat selection.
  3. The WebSocket layer pushes live position updates to waiting users.
"""

import enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.event import Event


class QueueStatus(str, enum.Enum):
    waiting = "waiting"
    admitted = "admitted"
    expired = "expired"
    completed = "completed"


class QueueSession(Base, TimestampMixin):
    __tablename__ = "queue_sessions"
    __table_args__ = (
        UniqueConstraint("token", name="uq_queue_token"),
        # Worker reads waiting sessions in position order
        Index("ix_queue_event_position", "event_id", "position"),
        Index("ix_queue_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    # Opaque token the frontend polls with; issued on queue entry
    token: Mapped[str] = mapped_column(String(128), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[QueueStatus] = mapped_column(
        SAEnum(QueueStatus), nullable=False, default=QueueStatus.waiting
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="queue_sessions")
    event: Mapped["Event"] = relationship(back_populates="queue_sessions")
