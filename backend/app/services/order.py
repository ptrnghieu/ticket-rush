"""
OrderService — converts locked seats into a confirmed, paid order.

Full payment flow (all within one transaction):
  1. Verify active locks belong to the requesting user
  2. Re-acquire seat X-locks (FOR UPDATE, ascending id — deadlock-safe)
  3. Validate seat statuses haven't changed since locking
  4. Create Order (pending) + OrderItems with snapshotted prices
  5. Mock payment gateway call (replace with real SDK in production)
  6. Mark Order → paid, Seats → sold, Locks → converted
  7. COMMIT (TicketService issues QR tickets in a separate call)
"""

from datetime import datetime
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import OrderNotFoundError, OrderStateError, PaymentDeclinedError
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.seat import SeatStatus
from app.models.section import Section
from app.models.ticket_lock import LockStatus
from app.repositories.order import OrderRepository
from app.repositories.seat import SeatRepository
from app.repositories.ticket_lock import TicketLockRepository


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.seat_repo = SeatRepository(db)
        self.lock_repo = TicketLockRepository(db)
        self.order_repo = OrderRepository(db)

    def create_order_from_locks(self, user_id: int, seat_ids: List[int]) -> Order:
        """
        Build a pending order from the user's active seat locks.
        Prices are snapshotted from the section at order time.
        """
        seat_ids = sorted(set(seat_ids))

        try:
            # Verify every requested seat is locked by this user
            active_locks = self.lock_repo.get_active_locks_for_user(user_id)
            user_locked_seat_ids = {lock.seat_id for lock in active_locks}

            missing_locks = [sid for sid in seat_ids if sid not in user_locked_seat_ids]
            if missing_locks:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Seats not locked by you or lock expired: {missing_locks}",
                )

            # Re-acquire row-level locks before reading prices and writing
            seats = self.seat_repo.lock_multiple_for_update(seat_ids)
            if len(seats) != len(seat_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more seats not found",
                )

            # Sanity check — seats must still be in 'locked' state
            for seat in seats:
                if seat.status != SeatStatus.locked:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Seat {seat.id} status changed unexpectedly to '{seat.status.value}'",
                    )

            # Snapshot section prices (section.price may change after order)
            total = 0.0
            order_items: List[OrderItem] = []
            for seat in seats:
                section = self.db.get(Section, seat.section_id)
                price = float(section.price) if section else 0.0
                total += price
                order_items.append(OrderItem(seat_id=seat.id, price=price))

            order = Order(
                user_id=user_id,
                status=OrderStatus.pending,
                total_amount=total,
            )
            self.db.add(order)
            self.db.flush()  # populate order.id before assigning to items

            for item in order_items:
                item.order_id = order.id
                self.db.add(item)

            self.db.commit()
            self.db.refresh(order)
            return order

        except HTTPException:
            self.db.rollback()
            raise
        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create order: {exc}",
            )

    def process_payment(self, order_id: int, user_id: int) -> Order:
        """
        Confirm payment and atomically finalise the order.

        On success: Order → paid | Seats → sold | Locks → converted
        Raises PaymentDeclinedError if the gateway rejects (mock always passes).
        """
        try:
            order = self.order_repo.get_with_items(order_id)
            if not order or order.user_id != user_id:
                raise OrderNotFoundError(order_id)
            if order.status != OrderStatus.pending:
                raise OrderStateError(order.status.value)

            seat_ids = sorted([item.seat_id for item in order.order_items])
            seats = self.seat_repo.lock_multiple_for_update(seat_ids)

            # ── Mock payment gateway ──────────────────────────────────────────
            # Replace this block with a real provider SDK call.
            # Raise PaymentDeclinedError on failure so the TX rolls back.
            payment_approved = True
            if not payment_approved:
                raise PaymentDeclinedError()
            # ─────────────────────────────────────────────────────────────────

            for seat in seats:
                seat.status = SeatStatus.sold
                lock = self.lock_repo.get_active_lock_for_seat(seat.id)
                if lock:
                    lock.status = LockStatus.converted

            order.status = OrderStatus.paid
            self.db.commit()
            self.db.refresh(order)
            return order

        except (OrderNotFoundError, OrderStateError, PaymentDeclinedError):
            self.db.rollback()
            raise
        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Payment processing failed: {exc}",
            )

    def cancel_order(self, order_id: int, user_id: int) -> Order:
        """Cancel a pending order and restore all seats to available."""
        try:
            order = self.order_repo.get_with_items(order_id)
            if not order or order.user_id != user_id:
                raise OrderNotFoundError(order_id)
            if order.status != OrderStatus.pending:
                raise OrderStateError(order.status.value)

            seat_ids = sorted([item.seat_id for item in order.order_items])
            seats = self.seat_repo.lock_multiple_for_update(seat_ids)

            for seat in seats:
                if seat.status == SeatStatus.locked:
                    seat.status = SeatStatus.available
                    lock = self.lock_repo.get_active_lock_for_seat(seat.id)
                    if lock:
                        lock.status = LockStatus.released

            order.status = OrderStatus.cancelled
            self.db.commit()
            self.db.refresh(order)
            return order

        except (OrderNotFoundError, OrderStateError):
            self.db.rollback()
            raise
        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to cancel order: {exc}",
            )

    def get_user_orders(self, user_id: int) -> List[Order]:
        return self.order_repo.get_user_orders(user_id)
