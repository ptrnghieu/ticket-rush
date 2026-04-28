from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event, EventStatus
from app.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    def __init__(self, db: Session) -> None:
        super().__init__(Event, db)

    def get_published(self, skip: int = 0, limit: int = 20) -> List[Event]:
        """Read-only listing — safe to call with a slave session."""
        stmt = (
            select(Event)
            .where(Event.status.in_([EventStatus.published, EventStatus.on_sale]))
            .order_by(Event.start_time.asc())
            .offset(skip)
            .limit(limit)
            .options(selectinload(Event.venue))
        )
        return list(self.db.scalars(stmt).all())

    def get_with_sections(self, event_id: int) -> Optional[Event]:
        """Eagerly load venue + sections for the event detail page."""
        stmt = (
            select(Event)
            .where(Event.id == event_id)
            .options(
                selectinload(Event.venue),
                selectinload(Event.sections),
            )
        )
        return self.db.scalars(stmt).first()

    def get_all_admin(self, skip: int = 0, limit: int = 50) -> List[Event]:
        stmt = (
            select(Event)
            .order_by(Event.created_at.desc())
            .offset(skip)
            .limit(limit)
            .options(selectinload(Event.venue))
        )
        return list(self.db.scalars(stmt).all())
