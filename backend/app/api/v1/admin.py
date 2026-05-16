"""
Admin-only API — all routes protected by require_admin (RBAC).

Covers:
  - Venue CRUD
  - Event CRUD + status management
  - Section creation + seat grid generation
  - Real-time dashboard (occupancy + revenue)
  - Audience analytics (age, gender breakdown)
  - Queue mode activation / deactivation
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_master_db, get_slave_db
from app.models.favorite import Favorite
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.seat import Seat
from app.models.section import Section
from app.models.ticket import Ticket
from app.models.user import User
from app.models.venue import Venue
from app.schemas.admin import AudienceAnalyticsResponse, DashboardResponse
from app.schemas.event import (
    EventCreate,
    EventDetailResponse,
    EventResponse,
    EventStatusUpdate,
    EventUpdate,
)
from app.schemas.seat import SectionCreate, SectionResponse
from app.schemas.venue import VenueCreate, VenueResponse, VenueUpdate
from app.services.auth import require_admin
from app.services.event import EventService
from app.services.seat import SeatService

router = APIRouter()


# ── Venue CRUD ────────────────────────────────────────────────────────────────

@router.get("/venues", response_model=List[VenueResponse], summary="List all venues")
def list_venues(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_slave_db),
    _: User = Depends(require_admin),
):
    return list(db.scalars(select(Venue).offset(skip).limit(limit)).all())


@router.post(
    "/venues",
    response_model=VenueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new venue",
)
def create_venue(
    payload: VenueCreate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    print(f"Creating venue with payload: {payload}")
    venue = Venue(**payload.model_dump())
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


@router.put("/venues/{venue_id}", response_model=VenueResponse, summary="Update a venue")
def update_venue(
    venue_id: int,
    payload: VenueUpdate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    venue = db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(venue, key, value)
    db.commit()
    db.refresh(venue)
    return venue


@router.delete(
    "/venues/{venue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a venue",
)
def delete_venue(
    venue_id: int,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    venue = db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    db.delete(venue)
    db.commit()


# ── Event CRUD ────────────────────────────────────────────────────────────────

@router.get(
    "/events",
    response_model=List[EventResponse],
    summary="List all events (all statuses)",
)
def list_all_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_slave_db),
    _: User = Depends(require_admin),
):
    return EventService(db).list_all_admin(skip=skip, limit=limit)


@router.post(
    "/events",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event (starts in 'draft' status)",
)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    return EventService(db).create_event(**payload.model_dump())


@router.put("/events/{event_id}", response_model=EventResponse, summary="Update event fields")
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    return EventService(db).update_event(event_id, **payload.model_dump(exclude_none=True))


@router.patch(
    "/events/{event_id}/status",
    response_model=EventResponse,
    summary="Change event status (draft → published → on_sale → ended)",
)
def update_event_status(
    event_id: int,
    payload: EventStatusUpdate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    return EventService(db).update_status(event_id, payload.status)


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event (cascades to sections and seats)",
)
def delete_event(
    event_id: int,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    EventService(db).delete_event(event_id)


# ── Section & Seat management ─────────────────────────────────────────────────

@router.post(
    "/events/{event_id}/sections",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a priced section to an event",
)
def add_section(
    event_id: int,
    payload: SectionCreate,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    return EventService(db).add_section(event_id=event_id, **payload.model_dump())


@router.post(
    "/sections/{section_id}/seats",
    status_code=status.HTTP_201_CREATED,
    summary="Auto-generate seat grid from section row_count × col_count",
)
def generate_seats(
    section_id: int,
    db: Session = Depends(get_master_db),
    _: User = Depends(require_admin),
):
    section = db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    seats = SeatService(db).generate_seats(
        section_id, section.row_count, section.col_count
    )
    return {"message": f"Generated {len(seats)} seats for section {section_id}"}


# ── Real-time Dashboard ───────────────────────────────────────────────────────

@router.get(
    "/dashboard/{event_id}",
    response_model=DashboardResponse,
    summary="Revenue and occupancy dashboard for an event",
)
def event_dashboard(
    event_id: int,
    db: Session = Depends(get_slave_db),
    _: User = Depends(require_admin),
):
    event = EventService(db).get_event_detail(event_id)
    occupancy = SeatService(db).get_occupancy(event_id)

    revenue_stmt = (
        select(func.sum(OrderItem.price))
        .join(Seat, OrderItem.seat_id == Seat.id)
        .join(Section, Seat.section_id == Section.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Section.event_id == event_id, Order.status == OrderStatus.paid)
    )
    total_revenue = float(db.scalar(revenue_stmt) or 0)

    fav_count = int(db.scalar(
        select(func.count()).select_from(Favorite).where(Favorite.event_id == event_id)
    ) or 0)

    total = occupancy["total"] or 1
    return DashboardResponse(
        event_id=event_id,
        event_name=event.name,
        total_seats=occupancy["total"],
        sold_seats=occupancy["sold"],
        locked_seats=occupancy["locked"],
        available_seats=occupancy["available"],
        occupancy_rate=round(occupancy["sold"] / total * 100, 2),
        total_revenue=total_revenue,
        favorite_count=fav_count,
    )


# ── Audience Analytics ────────────────────────────────────────────────────────

@router.get(
    "/analytics/{event_id}",
    response_model=AudienceAnalyticsResponse,
    summary="Age and gender breakdown of ticket buyers for an event",
)
def audience_analytics(
    event_id: int,
    db: Session = Depends(get_slave_db),
    _: User = Depends(require_admin),
):
    buyers_stmt = (
        select(User)
        .join(Ticket, Ticket.user_id == User.id)
        .join(Seat, Ticket.seat_id == Seat.id)
        .join(Section, Seat.section_id == Section.id)
        .where(Section.event_id == event_id)
        .distinct()
    )
    buyers = list(db.scalars(buyers_stmt).all())

    gender_breakdown: dict = {"male": 0, "female": 0, "other": 0, "unknown": 0}
    age_groups: dict = {"under_18": 0, "18_25": 0, "26_35": 0, "36_50": 0, "over_50": 0}

    for buyer in buyers:
        g_key = buyer.gender.value if buyer.gender else "unknown"
        gender_breakdown[g_key] = gender_breakdown.get(g_key, 0) + 1

        if buyer.age is not None:
            if buyer.age < 18:
                age_groups["under_18"] += 1
            elif buyer.age <= 25:
                age_groups["18_25"] += 1
            elif buyer.age <= 35:
                age_groups["26_35"] += 1
            elif buyer.age <= 50:
                age_groups["36_50"] += 1
            else:
                age_groups["over_50"] += 1

    return AudienceAnalyticsResponse(
        event_id=event_id,
        total_buyers=len(buyers),
        gender_breakdown=gender_breakdown,
        age_groups=age_groups,
    )


# ── Queue Mode Management ─────────────────────────────────────────────────────

@router.post(
    "/events/{event_id}/queue/activate",
    summary="Enable virtual queue mode for an event (high-demand flash sale)",
)
async def activate_queue(
    event_id: int,
    _: User = Depends(require_admin),
):
    """
    Activates queue mode. All subsequent join requests are placed in the
    Redis waiting room and admitted in batches of QUEUE_BATCH_SIZE every 30s.
    """
    from app.core.redis_client import async_redis
    from app.services.queue import RedisQueueService

    await RedisQueueService(async_redis).activate(event_id)
    return {"message": f"Queue activated for event {event_id}"}


@router.post(
    "/events/{event_id}/queue/deactivate",
    summary="Disable virtual queue mode (direct seat access restored)",
)
async def deactivate_queue(
    event_id: int,
    _: User = Depends(require_admin),
):
    from app.core.redis_client import async_redis
    from app.services.queue import RedisQueueService

    await RedisQueueService(async_redis).deactivate(event_id)
    return {"message": f"Queue deactivated for event {event_id}"}


@router.get(
    "/events/{event_id}/queue/status",
    summary="Get queue statistics for an event",
)
async def queue_stats(
    event_id: int,
    _: User = Depends(require_admin),
):
    from app.core.redis_client import async_redis
    from app.services.queue import RedisQueueService

    svc = RedisQueueService(async_redis)
    return {
        "event_id": event_id,
        "queue_active": await svc.is_active(event_id),
        "waiting_count": await svc.get_queue_size(event_id),
    }
