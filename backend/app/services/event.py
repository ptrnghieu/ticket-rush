from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus, EventType
from app.models.section import Section
from app.models.venue import Venue
from app.repositories.event import EventRepository
from app.repositories.section import SectionRepository


class EventService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.event_repo = EventRepository(db)
        self.section_repo = SectionRepository(db)

    def list_published(
        self,
        skip: int = 0,
        limit: int = 20,
        event_type: Optional[EventType] = None,
    ) -> List[Event]:
        return self.event_repo.get_published(skip=skip, limit=limit, event_type=event_type)

    def get_event_detail(self, event_id: int) -> Event:
        event = self.event_repo.get_with_sections(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        return event

    def list_all_admin(self, skip: int = 0, limit: int = 50) -> List[Event]:
        return self.event_repo.get_all_admin(skip=skip, limit=limit)

    def create_event(
        self,
        venue_id: int,
        name: str,
        description: str,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        poster_url: Optional[str] = None,
        event_type: Optional[EventType] = EventType.other,
    ) -> Event:
        venue = self.db.get(Venue, venue_id)
        if not venue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Venue {venue_id} not found",
            )
        event = Event(
            venue_id=venue_id,
            name=name,
            description=description,
            start_time=start_time,
            end_time=end_time,
            status=EventStatus.draft,
            poster_url=poster_url,
            event_type=event_type,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def update_event(self, event_id: int, **fields) -> Event:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        for key, value in fields.items():
            if hasattr(event, key) and value is not None:
                setattr(event, key, value)
        self.db.commit()
        self.db.refresh(event)
        return event

    def update_status(self, event_id: int, new_status: EventStatus) -> Event:
        return self.update_event(event_id, status=new_status)

    def delete_event(self, event_id: int) -> None:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        self.db.delete(event)
        self.db.commit()

    def add_section(
        self,
        event_id: int,
        name: str,
        price: float,
        row_count: int,
        col_count: int,
    ) -> Section:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found",
            )
        section = Section(
            event_id=event_id,
            name=name,
            price=price,
            row_count=row_count,
            col_count=col_count,
        )
        self.db.add(section)
        self.db.commit()
        self.db.refresh(section)
        return section
