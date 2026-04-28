"""
BaseRepository — generic CRUD backed by SQLAlchemy 2.0.

Repositories are pure DB-access objects:
  - No HTTP exceptions
  - No transaction management (commit/rollback lives in the service layer)
  - flush() after mutations so the service can read generated PKs
    within the same transaction without committing yet
"""

from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: Type[ModelT], db: Session) -> None:
        self.model = model
        self.db = db

    def get_by_id(self, id: int) -> Optional[ModelT]:
        return self.db.get(self.model, id)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelT]:
        stmt = select(self.model).offset(skip).limit(limit)
        return list(self.db.scalars(stmt).all())

    def create(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        self.db.flush()
        self.db.refresh(obj)
        return obj

    def bulk_create(self, objs: List[ModelT]) -> List[ModelT]:
        self.db.add_all(objs)
        self.db.flush()
        return objs

    def delete(self, obj: ModelT) -> None:
        self.db.delete(obj)
        self.db.flush()
