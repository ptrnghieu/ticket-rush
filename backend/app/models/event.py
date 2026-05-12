import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.venue import Venue
    from app.models.section import Section
    from app.models.queue_session import QueueSession


class EventStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    on_sale = "on_sale"
    sold_out = "sold_out"
    ended = "ended"
    cancelled = "cancelled"


class EventType(str, enum.Enum):
    concert = "concert"
    festival = "festival"
    theater = "theater"
    sports = "sports"
    conference = "conference"
    cinema = "cinema"
    comedy = "comedy"
    other = "other"


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    venue_id: Mapped[int] = mapped_column(
        ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[EventStatus] = mapped_column(
        SAEnum(EventStatus), nullable=False, default=EventStatus.draft
    )
    event_type: Mapped[Optional[EventType]] = mapped_column(
        SAEnum(EventType), nullable=True, default=EventType.other
    )
    poster_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    venue: Mapped["Venue"] = relationship(back_populates="events")
    sections: Mapped[List["Section"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    queue_sessions: Mapped[List["QueueSession"]] = relationship(
        back_populates="event"
    )
