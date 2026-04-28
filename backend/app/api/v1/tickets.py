from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_master_db
from app.models.user import User
from app.schemas.ticket import TicketResponse
from app.services.auth import get_current_user
from app.services.ticket import TicketService

router = APIRouter()


@router.get(
    "",
    response_model=List[TicketResponse],
    summary="List all e-tickets issued to the current user",
)
def my_tickets(
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    return TicketService(db).get_user_tickets(current_user.id)
