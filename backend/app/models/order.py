import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import Numeric, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.order_item import OrderItem


class OrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"
    refunded = "refunded"


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus), nullable=False, default=OrderStatus.pending
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="orders")
    order_items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
