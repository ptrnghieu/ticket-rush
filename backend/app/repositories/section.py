from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.section import Section
from app.repositories.base import BaseRepository


class SectionRepository(BaseRepository[Section]):
    def __init__(self, db: Session) -> None:
        super().__init__(Section, db)

    def get_by_event(self, event_id: int) -> List[Section]:
        stmt = (
            select(Section)
            .where(Section.event_id == event_id)
            .options(selectinload(Section.seats))
        )
        return list(self.db.scalars(stmt).all())
