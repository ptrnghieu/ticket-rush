"""
Ticket — the final issued e-ticket after successful payment.

qr_code stores a base64-encoded PNG or a URL pointing to the QR image.
A UNIQUE constraint on seat_id is the last line of defence against
double-issuance (the service layer also enforces this, but the DB
constraint is the authoritative guard).
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.seat import Seat
    from app.models.user import User
    from app.models.order import Order


class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("seat_id", name="uq_ticket_seat"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qr_code: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    seat: Mapped["Seat"] = relationship(back_populates="ticket")
    user: Mapped["User"] = relationship(back_populates="tickets")
    order: Mapped["Order"] = relationship()
