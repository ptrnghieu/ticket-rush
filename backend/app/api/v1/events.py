from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_slave_db
from app.models.event import EventType
from app.schemas.event import EventDetailResponse, EventResponse
from app.services.event import EventService

router = APIRouter()


@router.get(
    "/trending",
    response_model=List[EventResponse],
    summary="Top favorited on-sale events",
)
def trending_events(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_slave_db),
):
    return EventService(db).list_trending(limit=limit)


@router.get(
    "",
    response_model=List[EventResponse],
    summary="List on-sale events with optional filters",
)
def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    event_type: Optional[EventType] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_slave_db),
):
    return EventService(db).list_published(
        skip=skip, limit=limit, event_type=event_type,
        date_from=date_from, date_to=date_to,
    )


@router.get(
    "/{event_id}",
    response_model=EventDetailResponse,
    summary="Event detail with venue and sections",
)
def get_event(event_id: int, db: Session = Depends(get_slave_db)):
    return EventService(db).get_event_detail(event_id)