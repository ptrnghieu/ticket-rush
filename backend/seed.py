"""
Seed script — run once to populate the database with demo data.
Usage:  python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from app.core.database import MasterSessionLocal
from app.core.security import hash_password
from app.models.base import Base
from app.models.user import User, GenderEnum
from app.models.venue import Venue
from app.models.event import Event, EventStatus
from app.models.section import Section
from app.services.seat import SeatService

db = MasterSessionLocal()

try:
    # ── Admin user ─────────────────────────────────────────────────────────
    admin = db.query(User).filter(User.email == "admin@ticketrush.vn").first()
    if not admin:
        admin = User(
            email="admin@ticketrush.vn",
            password_hash=hash_password("Admin@123"),
            full_name="Admin",
            age=35,
            gender=GenderEnum.male,
            role="admin",
        )
        db.add(admin)
        db.flush()
        print("✓ Admin user created  (admin@ticketrush.vn / Admin@123)")
    else:
        print("· Admin user already exists")

    # ── Regular user ────────────────────────────────────────────────────────
    user = db.query(User).filter(User.email == "user@example.com").first()
    if not user:
        user = User(
            email="user@example.com",
            password_hash=hash_password("User@1234"),
            full_name="Nguyen Van A",
            age=25,
            gender=GenderEnum.male,
            role="customer",
        )
        db.add(user)
        db.flush()
        print("✓ Demo user created   (user@example.com / User@1234)")

    # ── Venue ───────────────────────────────────────────────────────────────
    venue = db.query(Venue).filter(Venue.name == "Nhà hát Lớn Hà Nội").first()
    if not venue:
        venue = Venue(
            name="Nhà hát Lớn Hà Nội",
            location="1 Tràng Tiền, Hoàn Kiếm, Hà Nội",
            capacity=1000,
        )
        db.add(venue)
        db.flush()
        print(f"✓ Venue created (id={venue.id})")

    # ── Events ──────────────────────────────────────────────────────────────
    events_data = [
        {
            "name": "Đêm Nhạc Trịnh 2026",
            "description": "Chương trình âm nhạc tưởng nhớ nhạc sĩ Trịnh Công Sơn với những ca khúc bất hủ.",
            "start_time": datetime.now() + timedelta(days=30),
            "poster_url": "https://images.unsplash.com/photo-1540039155733-5bb30b99f9d5?w=800",
            "sections": [
                {"name": "VIP",      "price": 800_000, "row_count": 3,  "col_count": 10},
                {"name": "Standard", "price": 350_000, "row_count": 5,  "col_count": 15},
                {"name": "Economy",  "price": 200_000, "row_count": 8,  "col_count": 20},
            ],
        },
        {
            "name": "Rock In Saigon 2026",
            "description": "Festival rock lớn nhất năm với sự góp mặt của các ban nhạc hàng đầu Việt Nam.",
            "start_time": datetime.now() + timedelta(days=60),
            "poster_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "sections": [
                {"name": "Golden",   "price": 1_200_000, "row_count": 2, "col_count": 8},
                {"name": "Silver",   "price": 600_000,   "row_count": 4, "col_count": 12},
                {"name": "General",  "price": 300_000,   "row_count": 6, "col_count": 20},
            ],
        },
        {
            "name": "Comedy Night Vol. 5",
            "description": "Đêm hài kịch độc đáo với các nghệ sĩ hài nổi tiếng.",
            "start_time": datetime.now() + timedelta(days=15),
            "poster_url": "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800",
            "sections": [
                {"name": "Front Row", "price": 500_000, "row_count": 2, "col_count": 10},
                {"name": "Standard",  "price": 250_000, "row_count": 6, "col_count": 15},
            ],
        },
    ]

    seat_svc = SeatService(db)

    for edata in events_data:
        existing = db.query(Event).filter(Event.name == edata["name"]).first()
        if existing:
            print(f"· Event already exists: {edata['name']}")
            continue

        event = Event(
            venue_id=venue.id,
            name=edata["name"],
            description=edata["description"],
            start_time=edata["start_time"],
            poster_url=edata.get("poster_url"),
            status=EventStatus.on_sale,
        )
        db.add(event)
        db.flush()

        for sdata in edata["sections"]:
            section = Section(
                event_id=event.id,
                name=sdata["name"],
                price=sdata["price"],
                row_count=sdata["row_count"],
                col_count=sdata["col_count"],
            )
            db.add(section)
            db.flush()
            seats = seat_svc.generate_seats(section.id, section.row_count, section.col_count)
            print(f"  ✓ {sdata['name']}: {len(seats)} seats")

        print(f"✓ Event created: {edata['name']}")

    db.commit()
    print("\nSeed complete!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
    raise
finally:
    db.close()
