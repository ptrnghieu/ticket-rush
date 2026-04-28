from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class OrderCreate(BaseModel):
    seat_ids: List[int] = Field(..., min_length=1, max_length=10)


class PaymentRequest(BaseModel):
    # In production: replace with card token / payment-method ID from your gateway SDK
    payment_method: str = Field("mock", max_length=50)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seat_id: int
    price: float


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: OrderStatus
    total_amount: float
    order_items: List[OrderItemResponse] = []
    created_at: datetime
