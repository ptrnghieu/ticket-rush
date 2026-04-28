# TicketRush 🎫

A production-grade flash-sale e-ticket platform built for high concurrency. Handles thousands of simultaneous seat selections without double-selling through pessimistic row-level locking, a Redis virtual queue, and real-time WebSocket updates.

## Architecture

```
┌─────────────────┐     HTTP/WS      ┌──────────────────────────────┐
│  React Frontend │ ◄──────────────► │  FastAPI Backend             │
│  Vite · Port 5173│                 │  Uvicorn · Port 8000         │
└─────────────────┘                  └──────┬───────────┬───────────┘
                                            │           │
                                    ┌───────▼───┐  ┌────▼──────┐
                                    │  MySQL 8  │  │  Redis 7  │
                                    │  Master + │  │  Queue +  │
                                    │  Slave(s) │  │  Sessions │
                                    └───────────┘  └───────────┘
```

**Key design decisions:**

| Problem                | Solution                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Double-sell prevention | `SELECT ... FOR UPDATE` pessimistic locking per seat                        |
| Deadlock prevention    | Always acquire multiple locks in ascending `seat_id` order                  |
| Flash-sale queue       | Redis `ZSET` (sorted set) — atomic `ZPOPMIN` batch admission                |
| Read scalability       | MySQL master–slave routing; all reads go to slave pool                      |
| Real-time updates      | Native WebSocket rooms grouped by `event_id`                                |
| Background jobs        | Asyncio task scheduler (lock expiry every 30 s, queue admission every 30 s) |

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Frontend      | React 18, Vite, React Router v6, Axios         |
| Backend       | FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2       |
| Auth          | JWT (python-jose) + bcrypt (passlib)           |
| Database      | MySQL 8 (InnoDB) with master–slave replication |
| Cache / Queue | Redis 7                                        |
| Real-time     | WebSocket (FastAPI native)                     |
| QR Tickets    | `qrcode` + Pillow → base64 PNG                 |

## Features

- **Event browsing** — search, filter by status
- **Seat matrix** — live color-coded grid (available / locked / sold) updated in real time via WebSocket
- **Pessimistic seat locking** — 10-minute hold while user checks out
- **Checkout flow** — lock seats → create order → mock payment → QR ticket
- **My Tickets** — QR code display for all purchased tickets
- **Virtual queue** — Redis waiting room for high-demand flash sales; users admitted in configurable batches every 30 s
- **Admin dashboard** — occupancy stats, revenue, seat fill chart, queue on/off toggle
- **Admin event management** — create events, add sections, auto-generate seat grids, publish/put on sale

---

## Local Setup

### Prerequisites

| Tool                    | Version            |
| ----------------------- | ------------------ |
| Python                  | 3.11+              |
| Node.js                 | 18+                |
| Docker + Docker Compose | Any recent version |
| Git                     | Any                |

### 1. Clone the repository

```bash
git clone https://github.com/ptrnghieu/ticket-rush.git
cd ticket-rush
```

### 2. Start infrastructure (MySQL + Redis)

```bash
docker compose up -d
```

This starts:

- **MySQL 8** on `localhost:3306` (database `ticketrush`, root password `password`)
- **Redis 7** on `localhost:6379`

Wait ~10 seconds for MySQL to finish initialising, then confirm:

```bash
docker compose ps
# Both services should show "healthy"
```

### 3. Set up the Python backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Environment variables (optional)

All settings have sensible defaults that match the Docker Compose file, so no `.env` is required for local development. To override anything, copy the example:

```bash
cp .env.example .env
# Edit .env as needed
```

Key variables:

| Variable                     | Default              | Description                                |
| ---------------------------- | -------------------- | ------------------------------------------ |
| `DB_MASTER_HOST`             | `localhost`          | MySQL host                                 |
| `DB_MASTER_PASSWORD`         | `password`           | MySQL root password                        |
| `DB_NAME`                    | `ticketrush`         | Database name                              |
| `REDIS_HOST`                 | `localhost`          | Redis host                                 |
| `SECRET_KEY`                 | `dev-secret-key-...` | JWT signing key — **change in production** |
| `SEAT_LOCK_DURATION_SECONDS` | `600`                | How long a seat hold lasts (seconds)       |
| `QUEUE_BATCH_SIZE`           | `50`                 | Users admitted per queue batch             |

### 4. Start the backend

```bash
# From the backend/ directory, with .venv active
uvicorn app.main:app --reload --port 8000
```

On first start the backend automatically creates all database tables. You should see:

```
INFO:     Started server process [...]
INFO:     Application startup complete.
```

Verify it's working:

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"TicketRush"}
```

Interactive API docs are available at **http://localhost:8000/docs**

### 5. Seed demo data

```bash
# From the backend/ directory, with .venv active
python seed.py
```

This creates:

| Account   | Email                 | Password    | Role     |
| --------- | --------------------- | ----------- | -------- |
| Admin     | `admin@ticketrush.vn` | `Admin@123` | Admin    |
| Demo user | `user@example.com`    | `User@1234` | Customer |

And three sample events with sections and seats already generated:

- **Đêm Nhạc Trịnh 2026** — 265 seats across 3 sections
- **Rock In Saigon 2026** — 184 seats across 3 sections
- **Comedy Night Vol. 5** — 110 seats across 2 sections

### 6. Set up and start the frontend

```bash
# From the repo root
cd frontend
npm install
npm run dev
```

The dev server starts at **http://localhost:5173** and proxies all `/api/*` requests to the backend at `localhost:8000`.

### All three services at a glance

Open three terminal tabs:

```bash
# Tab 1 — Infrastructure
docker compose up -d

# Tab 2 — Backend (from backend/)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Tab 3 — Frontend (from frontend/)
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Project Structure

```
ticket-rush/
├── docker-compose.yml          # MySQL + Redis
├── backend/
│   ├── requirements.txt
│   ├── seed.py                 # Demo data loader
│   └── app/
│       ├── main.py             # FastAPI app + lifespan
│       ├── core/
│       │   ├── config.py       # Pydantic settings
│       │   ├── database.py     # Master-slave routing
│       │   ├── security.py     # JWT + bcrypt
│       │   └── redis_client.py # Sync + async clients
│       ├── models/             # SQLAlchemy ORM models
│       ├── repositories/       # Data access layer
│       ├── services/           # Business logic
│       ├── schemas/            # Pydantic request/response
│       ├── api/v1/             # REST + WebSocket routers
│       └── worker/
│           ├── scheduler.py    # Asyncio background jobs
│           └── tasks.py        # Sync job implementations
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Router
        ├── hooks/
        │   ├── useAuth.jsx     # Auth context
        │   └── useWebSocket.js # WS with auto-reconnect
        ├── services/api.js     # All API calls (Axios)
        ├── components/
        │   ├── SeatMap.jsx     # Live seat grid
        │   ├── QueueRoom.jsx   # Virtual queue UI
        │   └── QRTicket.jsx    # QR ticket display
        └── pages/
            ├── Home.jsx
            ├── Event.jsx       # Seat selection
            ├── Checkout.jsx    # Payment flow
            ├── MyTickets.jsx
            └── admin/
                ├── Dashboard.jsx
                ├── Events.jsx
                └── CreateEvent.jsx
```

## API Reference

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

| Method   | Path                                 | Description                    |
| -------- | ------------------------------------ | ------------------------------ |
| `POST`   | `/api/v1/auth/register`              | Register new account           |
| `POST`   | `/api/v1/auth/login`                 | Login, returns JWT             |
| `GET`    | `/api/v1/events`                     | List published/on-sale events  |
| `GET`    | `/api/v1/events/{id}`                | Event detail + sections        |
| `GET`    | `/api/v1/seats/{section_id}`         | Seat matrix for a section      |
| `POST`   | `/api/v1/seats/lock`                 | Lock seats (10-min hold)       |
| `DELETE` | `/api/v1/seats/{id}/lock`            | Release a lock                 |
| `POST`   | `/api/v1/orders`                     | Create order from locked seats |
| `POST`   | `/api/v1/orders/{id}/pay`            | Pay order + issue QR tickets   |
| `GET`    | `/api/v1/tickets`                    | My tickets                     |
| `POST`   | `/api/v1/queue/join/{event_id}`      | Join virtual queue             |
| `GET`    | `/api/v1/queue/status/{event_id}`    | Queue position + wait time     |
| `WS`     | `/api/v1/ws/events/{event_id}`       | Real-time seat/queue events    |
| `GET`    | `/api/v1/admin/dashboard/{event_id}` | Occupancy + revenue stats      |

## Stopping Everything

```bash
# Stop the frontend and backend with Ctrl+C in their terminals, then:
docker compose down          # stop containers (keeps data)
docker compose down -v       # stop + delete all data
```
