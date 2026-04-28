from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.order import Order
from app.repositories.base import BaseRepository


class OrderRepository(BaseRepository[Order]):
    def __init__(self, db: Session) -> None:
        super().__init__(Order, db)

    def get_with_items(self, order_id: int) -> Optional[Order]:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.order_items))
        )
        return self.db.scalars(stmt).first()

    def get_user_orders(self, user_id: int) -> List[Order]:
        stmt = (
            select(Order)
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .options(selectinload(Order.order_items))
        )
        return list(self.db.scalars(stmt).all())
