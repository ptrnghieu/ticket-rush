from pydantic import BaseModel, ConfigDict

from app.models.queue_session import QueueStatus


class QueueJoinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    token: str
    position: int
    status: QueueStatus


class QueueStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    status: QueueStatus
    queue_size: int
    estimated_wait_minutes: float
