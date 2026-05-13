from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event, EventStatus, EventType
from app.models.favorite import Favorite
from app.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    def __init__(self, db: Session) -> None:
        super().__init__(Event, db)

    def _attach_favorite_counts(self, events: List[Event]) -> List[Event]:
        if not events:
            return events
        ids = [e.id for e in events]
        counts: Dict[int, int] = dict(
            self.db.execute(
                select(Favorite.event_id, func.count().label("c"))
                .where(Favorite.event_id.in_(ids))
                .group_by(Favorite.event_id)
            ).all()
        )
        for e in events:
            e.favorite_count = counts.get(e.id, 0)
        return events

    def get_published(
        self,
        skip: int = 0,
        limit: int = 20,
        event_type: Optional[EventType] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Event]:
        stmt = (
            select(Event)
            .where(Event.status == EventStatus.on_sale)
            .order_by(Event.start_time.asc())
            .offset(skip)
            .limit(limit)
            .options(selectinload(Event.venue))
        )
        if event_type is not None:
            stmt = stmt.where(Event.event_type == event_type)
        if date_from is not None:
            stmt = stmt.where(Event.start_time >= date_from)
        if date_to is not None:
            stmt = stmt.where(Event.start_time <= date_to)
        events = list(self.db.scalars(stmt).all())
        return self._attach_favorite_counts(events)

    def get_trending(self, limit: int = 6) -> List[Event]:
        fav_subq = (
            select(Favorite.event_id, func.count().label("fav_count"))
            .group_by(Favorite.event_id)
            .subquery()
        )
        stmt = (
            select(Event)
            .join(fav_subq, Event.id == fav_subq.c.event_id)
            .where(Event.status == EventStatus.on_sale)
            .order_by(fav_subq.c.fav_count.desc())
            .limit(limit)
            .options(selectinload(Event.venue))
        )
        events = list(self.db.scalars(stmt).all())
        return self._attach_favorite_counts(events)

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
