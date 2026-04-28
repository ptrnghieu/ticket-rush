from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.event import EventStatus
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


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = None


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
    poster_url: Optional[str]
    venue: VenueResponse
    created_at: datetime


class EventDetailResponse(EventResponse):
    sections: List[SectionBrief] = []
