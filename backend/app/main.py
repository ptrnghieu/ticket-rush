from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import master_engine
import app.models  # noqa: F401 — registers all ORM models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DDL: create tables that don't exist yet.
    # In production replace with: alembic upgrade head
    from app.models.base import Base
    Base.metadata.create_all(bind=master_engine)
    yield
    master_engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Flash Sale E-Ticket Platform — high-concurrency seat booking",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["ops"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}


# ── Routers registered here in Phase 3 ──────────────────────────────────────
# from app.api.v1 import auth, events, seats, orders, tickets, admin, queue
# app.include_router(auth.router,    prefix="/api/v1/auth",    tags=["auth"])
# app.include_router(events.router,  prefix="/api/v1/events",  tags=["events"])
# app.include_router(seats.router,   prefix="/api/v1/seats",   tags=["seats"])
# app.include_router(orders.router,  prefix="/api/v1/orders",  tags=["orders"])
# app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["tickets"])
# app.include_router(admin.router,   prefix="/api/v1/admin",   tags=["admin"])
# app.include_router(queue.router,   prefix="/api/v1/queue",   tags=["queue"])
