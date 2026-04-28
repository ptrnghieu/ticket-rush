"""
Master-Slave database routing for TicketRush.

All WRITE operations  → master_engine   (via get_master_db dependency)
All READ  operations  → slave_engines   (via get_slave_db dependency, round-robin)

When DB_SLAVE_HOSTS is empty the slave pool falls back to the master engine
so the app runs correctly on a single-node dev setup with zero config changes.

InnoDB Row-Level Locking note:
  The seat-booking flow must use get_master_db() even for the initial read
  because SELECT … FOR UPDATE must run on the master — slaves are async
  replicas and cannot grant X-locks.
"""

import itertools
import threading
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from app.core.config import settings


# ── Engine factory ───────────────────────────────────────────────────────────

def _mysql_url(host: str, port: int, user: str, password: str, db: str) -> str:
    return (
        f"mysql+pymysql://{user}:{password}@{host}:{port}/{db}"
        "?charset=utf8mb4"
    )


def _make_engine(host: str, port: int, user: str, password: str):
    return create_engine(
        _mysql_url(host, port, user, password, settings.DB_NAME),
        poolclass=QueuePool,
        pool_size=20,         # persistent connections kept alive
        max_overflow=10,      # extra connections allowed under burst load
        pool_pre_ping=True,   # validate connection health before checkout
        pool_recycle=3600,    # recycle connections hourly (avoids 8-hour MySQL timeout)
        echo=settings.DEBUG,
    )


# ── Master engine ────────────────────────────────────────────────────────────

master_engine = _make_engine(
    settings.DB_MASTER_HOST,
    settings.DB_MASTER_PORT,
    settings.DB_MASTER_USER,
    settings.DB_MASTER_PASSWORD,
)

MasterSessionLocal: sessionmaker[Session] = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=master_engine,
)


# ── Slave engines (round-robin) ──────────────────────────────────────────────

def _build_slave_engines() -> list:
    """
    Parse DB_SLAVE_HOSTS and return one SQLAlchemy engine per replica.
    Falls back to [master_engine] when no slaves are declared.
    """
    raw = settings.DB_SLAVE_HOSTS.strip()
    if not raw:
        return [master_engine]

    slave_user = settings.DB_SLAVE_USER or settings.DB_MASTER_USER
    slave_pw = settings.DB_SLAVE_PASSWORD or settings.DB_MASTER_PASSWORD
    engines = []

    for entry in raw.split(","):
        entry = entry.strip()
        if ":" in entry:
            host, port_str = entry.rsplit(":", 1)
            port = int(port_str)
        else:
            host, port = entry, 3306
        engines.append(_make_engine(host, port, slave_user, slave_pw))

    return engines


_slave_engines = _build_slave_engines()
_slave_iterator = itertools.cycle(_slave_engines)
_slave_lock = threading.Lock()  # guard the shared iterator in multi-threaded uvicorn


def _next_slave_engine():
    """Thread-safe round-robin selection across replica pool."""
    with _slave_lock:
        return next(_slave_iterator)


# ── FastAPI session dependencies ─────────────────────────────────────────────

def get_master_db() -> Generator[Session, None, None]:
    """
    Provide a write-capable SQLAlchemy session bound to the master.

    Usage in a route:
        db: Session = Depends(get_master_db)

    MUST be used for all INSERT / UPDATE / DELETE operations and for any
    SELECT … FOR UPDATE (pessimistic lock) queries.
    """
    db = MasterSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_slave_db() -> Generator[Session, None, None]:
    """
    Provide a read-only SQLAlchemy session bound to a replica (round-robin).

    Usage in a route:
        db: Session = Depends(get_slave_db)

    Safe only for plain SELECT queries. Never use for locking reads.
    """
    factory = sessionmaker(
        autocommit=False, autoflush=False, bind=_next_slave_engine()
    )
    db = factory()
    try:
        yield db
    finally:
        db.close()
