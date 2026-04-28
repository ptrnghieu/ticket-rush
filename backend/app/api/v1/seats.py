"""
Seat Matrix & Locking endpoints.

Read routes (GET) use the slave session for horizontal read scalability.
Write routes (POST/DELETE) use the master session — SELECT … FOR UPDATE
can only be issued against the primary writer node.
"""

from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_master_db, get_slave_db
from app.models.seat import SeatStatus
from app.models.user import User
from app.schemas.seat import LockRequest, LockResponse, SeatMatrixResponse
from app.services.auth import get_current_user
from app.services.seat import SeatService

router = APIRouter()


@router.get(
    "/{section_id}",
    response_model=SeatMatrixResponse,
    summary="Seat matrix for a section (real-time status)",
)
def get_seat_matrix(section_id: int, db: Session = Depends(get_slave_db)):
    seats = SeatService(db).get_seat_matrix(section_id)
    available = sum(1 for s in seats if s.status == SeatStatus.available)
    return SeatMatrixResponse(
        section_id=section_id,
        seats=seats,
        available_count=available,
        total_count=len(seats),
    )


@router.post(
    "/lock",
    response_model=List[LockResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Lock one or more seats (10-min hold, pessimistic locking)",
)
def lock_seats(
    payload: LockRequest,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    svc = SeatService(db)
    if len(payload.seat_ids) == 1:
        return [svc.lock_seat(payload.seat_ids[0], current_user.id)]
    return svc.lock_multiple_seats(payload.seat_ids, current_user.id)


@router.delete(
    "/{seat_id}/lock",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Release a seat lock before it expires",
)
def release_lock(
    seat_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    SeatService(db).release_lock(seat_id, current_user.id)
