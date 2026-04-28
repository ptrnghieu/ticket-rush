from typing import TYPE_CHECKING, List

from sqlalchemy import String, Integer, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.seat import Seat


class Section(Base, TimestampMixin):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # Grid dimensions — used by the seat-matrix generator
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    col_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="sections")
    seats: Mapped[List["Seat"]] = relationship(
        back_populates="section", cascade="all, delete-orphan"
    )
