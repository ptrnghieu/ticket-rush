"""
TicketLock — records the 10-minute pessimistic hold on a seat.

One active lock per seat is enforced at the service layer (after acquiring
SELECT … FOR UPDATE on the seat row).

The background worker scans for rows where:
    status = 'active' AND expires_at < NOW()
and releases them by flipping seat.status → 'available' and
lock.status → 'expired', then broadcasts the change over WebSocket.
"""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.seat import Seat
    from app.models.user import User


class LockStatus(str, enum.Enum):
    active = "active"        # seat is held by the user
    expired = "expired"      # TTL elapsed; seat released by worker
    released = "released"    # user cancelled before TTL
    converted = "converted"  # promoted to a confirmed order


class TicketLock(Base, TimestampMixin):
    __tablename__ = "ticket_locks"
    __table_args__ = (
        # Worker query: find expired active locks efficiently
        Index("ix_ticket_locks_seat_expires", "seat_id", "expires_at"),
        Index("ix_ticket_locks_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[LockStatus] = mapped_column(
        SAEnum(LockStatus), nullable=False, default=LockStatus.active
    )

    # Relationships
    seat: Mapped["Seat"] = relationship(back_populates="ticket_locks")
    user: Mapped["User"] = relationship(back_populates="ticket_locks")
