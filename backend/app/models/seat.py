"""
Seat — central entity in the concurrency-control flow.

PESSIMISTIC LOCKING STRATEGY
─────────────────────────────
Every booking attempt must acquire an exclusive row-level lock via:

    SELECT * FROM seats WHERE id = :id FOR UPDATE

InnoDB holds this X-lock for the duration of the transaction, so
concurrent requests for the same seat are serialised at the DB level.
No version column or application-level CAS is needed.

Status lifecycle:
    available  →  locked   (lock acquired, 10-min TTL)
    locked     →  sold     (payment confirmed)
    locked     →  available (lock expired / user released)
"""

import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.section import Section
    from app.models.ticket_lock import TicketLock
    from app.models.order_item import OrderItem
    from app.models.ticket import Ticket


class SeatStatus(str, enum.Enum):
    available = "available"
    locked = "locked"
    sold = "sold"


class Seat(Base, TimestampMixin):
    __tablename__ = "seats"
    __table_args__ = (
        # Prevent duplicate seat positions within a section
        UniqueConstraint(
            "section_id", "row_number", "seat_number", name="uq_seat_position"
        ),
        # Fast lookup by status (e.g. find all available seats for a section)
        Index("ix_seats_status", "status"),
        # Composite index for seat-matrix queries
        Index("ix_seats_section_status", "section_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), nullable=False
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Human-readable label shown in the UI (e.g. "A", "B", "VIP-1")
    row_label: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status: Mapped[SeatStatus] = mapped_column(
        SAEnum(SeatStatus), nullable=False, default=SeatStatus.available
    )

    # Relationships
    section: Mapped["Section"] = relationship(back_populates="seats")
    ticket_locks: Mapped[List["TicketLock"]] = relationship(back_populates="seat")
    order_item: Mapped[Optional["OrderItem"]] = relationship(
        back_populates="seat", uselist=False
    )
    ticket: Mapped[Optional["Ticket"]] = relationship(
        back_populates="seat", uselist=False
    )
