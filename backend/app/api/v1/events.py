from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_slave_db
from app.schemas.event import EventDetailResponse, EventResponse
from app.services.event import EventService

router = APIRouter()


@router.get(
    "",
    response_model=List[EventResponse],
    summary="List all published / on-sale events",
)
def list_events(
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    db: Session = Depends(get_slave_db),
):
    return EventService(db).list_published(skip=skip, limit=limit)


@router.get(
    "/{event_id}",
    response_model=EventDetailResponse,
    summary="Event detail with venue and sections",
)
def get_event(event_id: int, db: Session = Depends(get_slave_db)):
    return EventService(db).get_event_detail(event_id)
