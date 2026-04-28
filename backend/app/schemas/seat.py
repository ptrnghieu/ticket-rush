from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.seat import SeatStatus
from app.models.ticket_lock import LockStatus


class SeatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    row_number: int
    seat_number: int
    row_label: Optional[str]
    status: SeatStatus


class SeatMatrixResponse(BaseModel):
    section_id: int
    seats: List[SeatResponse]
    available_count: int
    total_count: int


class LockRequest(BaseModel):
    seat_ids: List[int] = Field(..., min_length=1, max_length=10)


class LockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seat_id: int
    user_id: int
    expires_at: datetime
    status: LockStatus


class SectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0)
    row_count: int = Field(..., ge=1, le=100)
    col_count: int = Field(..., ge=1, le=100)


class SectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    name: str
    price: float
    row_count: int
    col_count: int


class OccupancyResponse(BaseModel):
    event_id: int
    available: int
    locked: int
    sold: int
    total: int
    occupancy_rate: float
