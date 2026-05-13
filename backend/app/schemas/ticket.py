from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class VenueInTicket(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    location: Optional[str] = None


class EventInTicket(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = None
    venue: VenueInTicket


class SectionInTicket(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    price: float
    event: EventInTicket


class SeatInTicket(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    row_label: Optional[str] = None
    row_number: int
    seat_number: int
    section: SectionInTicket


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seat_id: int
    user_id: int
    order_id: int
    qr_code: Optional[str]
    issued_at: datetime
    seat: Optional[SeatInTicket] = None
