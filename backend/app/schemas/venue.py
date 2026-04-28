from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class VenueCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    location: str = Field(..., min_length=1)
    capacity: int = Field(..., ge=0)


class VenueUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    location: Optional[str] = None
    capacity: Optional[int] = Field(None, ge=0)


class VenueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str
    capacity: int
