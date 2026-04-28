import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.ticket_lock import TicketLock
    from app.models.order import Order
    from app.models.ticket import Ticket
    from app.models.queue_session import QueueSession


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gender: Mapped[Optional[GenderEnum]] = mapped_column(
        SAEnum(GenderEnum), nullable=True
    )
    # RBAC role: "customer" | "admin"
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="customer")

    # Relationships
    ticket_locks: Mapped[List["TicketLock"]] = relationship(back_populates="user")
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
    tickets: Mapped[List["Ticket"]] = relationship(back_populates="user")
    queue_sessions: Mapped[List["QueueSession"]] = relationship(back_populates="user")
