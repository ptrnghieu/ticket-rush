from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.ticket import Ticket
from app.repositories.base import BaseRepository


class TicketRepository(BaseRepository[Ticket]):
    def __init__(self, db: Session) -> None:
        super().__init__(Ticket, db)

    def get_by_seat(self, seat_id: int) -> Optional[Ticket]:
        stmt = select(Ticket).where(Ticket.seat_id == seat_id)
        return self.db.scalars(stmt).first()

    def get_user_tickets(self, user_id: int) -> List[Ticket]:
        stmt = (
            select(Ticket)
            .where(Ticket.user_id == user_id)
            .order_by(Ticket.issued_at.desc())
            .options(
                selectinload(Ticket.seat),
                selectinload(Ticket.order),
            )
        )
        return list(self.db.scalars(stmt).all())
