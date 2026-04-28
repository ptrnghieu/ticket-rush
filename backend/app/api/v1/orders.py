from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_master_db
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse, PaymentRequest
from app.services.auth import get_current_user
from app.services.order import OrderService
from app.services.ticket import TicketService

router = APIRouter()


@router.get(
    "",
    response_model=List[OrderResponse],
    summary="List the current user's orders",
)
def list_orders(
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService(db).get_user_orders(current_user.id)


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a pending order from active seat locks",
)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    return OrderService(db).create_order_from_locks(current_user.id, payload.seat_ids)


@router.post(
    "/{order_id}/pay",
    response_model=OrderResponse,
    summary="Process mock payment and confirm order; issues QR tickets on success",
)
def pay_order(
    order_id: int,
    payload: PaymentRequest,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    order = OrderService(db).process_payment(order_id, current_user.id)
    # Ticket issuance is idempotent — safe to call even on retries
    TicketService(db).issue_tickets_for_order(order.id)
    return order


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a pending order and release all locked seats",
)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    OrderService(db).cancel_order(order_id, current_user.id)
