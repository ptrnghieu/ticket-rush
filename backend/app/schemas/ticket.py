from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seat_id: int
    user_id: int
    order_id: int
    qr_code: Optional[str]
    issued_at: datetime
