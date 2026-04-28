"""
TicketService — issues QR-coded e-tickets after a confirmed payment.

QR code format: base64-encoded PNG embedding a JSON payload with enough
information for an offline scanner to verify the ticket without a DB round-trip.
Issuance is idempotent — calling issue_tickets_for_order twice is safe.
"""

import base64
import io
import json
from typing import List

import qrcode
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.order import OrderStatus
from app.models.ticket import Ticket
from app.repositories.order import OrderRepository
from app.repositories.ticket import TicketRepository


class TicketService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.ticket_repo = TicketRepository(db)
        self.order_repo = OrderRepository(db)

    def issue_tickets_for_order(self, order_id: int) -> List[Ticket]:
        """
        Generate one QR-coded ticket per seat in a paid order.
        Idempotent: already-issued tickets are returned as-is.
        """
        order = self.order_repo.get_with_items(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found",
            )
        if order.status != OrderStatus.paid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tickets can only be issued for paid orders",
            )

        tickets: List[Ticket] = []
        try:
            for item in order.order_items:
                existing = self.ticket_repo.get_by_seat(item.seat_id)
                if existing:
                    tickets.append(existing)
                    continue

                qr_payload = json.dumps(
                    {
                        "platform": "TICKETRUSH",
                        "order_id": order_id,
                        "seat_id": item.seat_id,
                        "user_id": order.user_id,
                        "price": float(item.price),
                    },
                    separators=(",", ":"),
                )

                ticket = Ticket(
                    seat_id=item.seat_id,
                    user_id=order.user_id,
                    order_id=order_id,
                    qr_code=self._make_qr_base64(qr_payload),
                )
                self.db.add(ticket)
                tickets.append(ticket)

            self.db.commit()
            for t in tickets:
                self.db.refresh(t)
            return tickets

        except HTTPException:
            self.db.rollback()
            raise
        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to issue tickets: {exc}",
            )

    def get_user_tickets(self, user_id: int) -> List[Ticket]:
        return self.ticket_repo.get_user_tickets(user_id)

    @staticmethod
    def _make_qr_base64(data: str) -> str:
        """Render a QR code to PNG and return as a data-URI string."""
        img = qrcode.make(data)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{encoded}"
