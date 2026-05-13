from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_master_db, get_slave_db
from app.models.event import Event
from app.models.favorite import Favorite
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter()


@router.get("", summary="Get current user's favorited event IDs")
def my_favorites(
    db: Session = Depends(get_slave_db),
    current_user: User = Depends(get_current_user),
) -> List[int]:
    rows = db.scalars(
        select(Favorite.event_id).where(Favorite.user_id == current_user.id)
    ).all()
    return list(rows)


@router.post("/{event_id}", status_code=status.HTTP_201_CREATED, summary="Add event to favorites")
def add_favorite(
    event_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Event, event_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    existing = db.scalars(
        select(Favorite)
        .where(Favorite.user_id == current_user.id, Favorite.event_id == event_id)
    ).first()
    if existing:
        return {"message": "Already favorited"}
    db.add(Favorite(user_id=current_user.id, event_id=event_id))
    db.commit()
    return {"message": "Added to favorites"}


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove event from favorites")
def remove_favorite(
    event_id: int,
    db: Session = Depends(get_master_db),
    current_user: User = Depends(get_current_user),
):
    fav = db.scalars(
        select(Favorite)
        .where(Favorite.user_id == current_user.id, Favorite.event_id == event_id)
    ).first()
    if fav:
        db.delete(fav)
        db.commit()
