from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.event import EventStatus, EventType
from app.schemas.venue import VenueResponse


class SectionBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
    row_count: int
    col_count: int


class EventCreate(BaseModel):
    venue_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=2000)
    start_time: datetime
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = Field(None, max_length=500)
    event_type: Optional[EventType] = EventType.other


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = None
    event_type: Optional[EventType] = None


class EventStatusUpdate(BaseModel):
    status: EventStatus


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    start_time: datetime
    end_time: Optional[datetime]
    status: EventStatus
    event_type: Optional[EventType]
    poster_url: Optional[str]
    venue: VenueResponse
    created_at: datetime
    favorite_count: int = 0


class EventDetailResponse(EventResponse):
    sections: List[SectionBrief] = []
