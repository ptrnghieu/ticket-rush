from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import master_engine
import app.models  # noqa: F401 — registers all ORM models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
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

# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.v1 import auth, events, seats, orders, tickets, queue, admin  # noqa: E402

app.include_router(auth.router,    prefix="/api/v1/auth",    tags=["Auth"])
app.include_router(events.router,  prefix="/api/v1/events",  tags=["Events"])
app.include_router(seats.router,   prefix="/api/v1/seats",   tags=["Seats"])
app.include_router(orders.router,  prefix="/api/v1/orders",  tags=["Orders"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["Tickets"])
app.include_router(queue.router,   prefix="/api/v1/queue",   tags=["Queue"])
app.include_router(admin.router,   prefix="/api/v1/admin",   tags=["Admin"])


@app.get("/health", tags=["Ops"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
