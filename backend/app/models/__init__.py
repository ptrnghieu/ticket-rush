# Import every model here so SQLAlchemy can:
#   1. Resolve all relationship() string references
#   2. Register all tables with Base.metadata for create_all()

from app.models.base import Base
from app.models.user import User
from app.models.venue import Venue
from app.models.event import Event
from app.models.section import Section
from app.models.seat import Seat
from app.models.ticket_lock import TicketLock
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.ticket import Ticket
from app.models.queue_session import QueueSession
from app.models.favorite import Favorite

__all__ = [
    "Base",
    "User",
    "Venue",
    "Event",
    "Section",
    "Seat",
    "TicketLock",
    "Order",
    "OrderItem",
    "Ticket",
    "QueueSession",
    "Favorite",
]
