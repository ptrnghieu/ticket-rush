"""
SeatRepository — the only place in the codebase that issues FOR UPDATE.

Rules:
  - lock_for_update / lock_multiple_for_update MUST be called on a master
    session inside an active transaction.
  - get_by_section is read-only; use a slave session for scale.
  - Always acquire multiple locks in ascending seat_id order to prevent
    deadlocks between concurrent transactions.
"""

from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.seat import Seat, SeatStatus
from app.repositories.base import BaseRepository


class SeatRepository(BaseRepository[Seat]):
    def __init__(self, db: Session) -> None:
        super().__init__(Seat, db)

    def lock_for_update(self, seat_id: int) -> Optional[Seat]:
        """
        Acquire an exclusive InnoDB row-level lock on one seat row.

        Translates to:  SELECT * FROM seats WHERE id = :id FOR UPDATE

        The calling transaction holds this X-lock until it commits or
        rolls back. Every concurrent transaction that calls this method
        with the same seat_id will block here — serialising the check
        at the DB level and making double-sells impossible.

        MUST use master DB session.
        """
        stmt = select(Seat).where(Seat.id == seat_id).with_for_update()
        return self.db.scalars(stmt).first()

    def lock_multiple_for_update(self, seat_ids: List[int]) -> List[Seat]:
        """
        Acquire X-locks on multiple seat rows in a single query.

        Rows are fetched ORDER BY id ASC which matches the ascending
        sort the service layer enforces before calling this method —
        both sides using the same order guarantees no circular waits
        and therefore no deadlocks between multi-seat transactions.
        """
        stmt = (
            select(Seat)
            .where(Seat.id.in_(seat_ids))
            .order_by(Seat.id.asc())
            .with_for_update()
        )
        return list(self.db.scalars(stmt).all())

    def get_by_section(self, section_id: int) -> List[Seat]:
        """Read-only matrix fetch; safe to run on a slave session."""
        stmt = (
            select(Seat)
            .where(Seat.section_id == section_id)
            .order_by(Seat.row_number, Seat.seat_number)
        )
        return list(self.db.scalars(stmt).all())

    def count_by_status(self, section_id: int, status: SeatStatus) -> int:
        stmt = (
            select(func.count())
            .select_from(Seat)
            .where(Seat.section_id == section_id, Seat.status == status)
        )
        return self.db.scalar(stmt) or 0

    def count_all_by_status(self, event_id: int) -> dict:
        """
        Returns {status: count} aggregation across all sections of an event
        for the admin revenue / occupancy dashboard.
        """
        from sqlalchemy import case
        from app.models.section import Section

        stmt = (
            select(
                func.sum(case((Seat.status == SeatStatus.available, 1), else_=0)).label("available"),
                func.sum(case((Seat.status == SeatStatus.locked, 1), else_=0)).label("locked"),
                func.sum(case((Seat.status == SeatStatus.sold, 1), else_=0)).label("sold"),
                func.count().label("total"),
            )
            .join(Section, Seat.section_id == Section.id)
            .where(Section.event_id == event_id)
        )
        row = self.db.execute(stmt).first()
        return {
            "available": row.available or 0,
            "locked": row.locked or 0,
            "sold": row.sold or 0,
            "total": row.total or 0,
        }
