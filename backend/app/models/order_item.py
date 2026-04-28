from typing import TYPE_CHECKING

from sqlalchemy import Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.seat import Seat


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"
    __table_args__ = (
        # A seat can belong to exactly one order — DB-level guarantee
        UniqueConstraint("seat_id", name="uq_order_item_seat"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="RESTRICT"), nullable=False
    )
    # Snapshot the price at purchase time; section.price may change later
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="order_items")
    seat: Mapped["Seat"] = relationship(back_populates="order_item")
