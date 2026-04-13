# TicketRush — Claude Code Instructions

## Project Overview
TicketRush là nền tảng bán vé sự kiện trực tuyến (âm nhạc/giải trí).
Điểm cốt lõi: chịu tải cao, xử lý flash sale với hàng nghìn user cùng lúc, không bán trùng ghế.
Môn: INT3306 - Phát triển ứng dụng web | Spring 2026 | Demo: 11-16/5/2026

## Tech Stack

### Frontend
- Vanilla HTML/CSS/JavaScript (ES Modules)
- Fetch API cho mọi request (KHÔNG dùng full page reload)
- WebSocket hoặc Polling (500ms) cho real-time seat updates
- Không dùng frontend framework nặng (React/Vue) trừ khi team thống nhất

### Backend
- Node.js + Express.js
- PostgreSQL (primary DB)
- Redis (session store + seat lock TTL + queue)
- Bull (background job — auto-release expired locks)
- Socket.io (real-time seat status broadcast)

### Dev Tools
- Docker + docker-compose (PostgreSQL + Redis)
- Nodemon (dev server)
- Jest (unit tests cho business logic)

## Folder Structure

```
ticketrush/
├── CLAUDE.md
├── PRD.md
├── README.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app setup
│   │   ├── server.js           # HTTP + WebSocket server entry
│   │   ├── config/
│   │   │   ├── db.js           # PostgreSQL pool
│   │   │   └── redis.js        # Redis client
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── event.routes.js
│   │   │   ├── seat.routes.js
│   │   │   ├── booking.routes.js
│   │   │   └── admin.routes.js
│   │   ├── controllers/        # Thin — chỉ parse req/res, gọi service
│   │   ├── services/           # Business logic — mọi DB transaction ở đây
│   │   │   ├── seat.service.js     # Lock/release/sell ghế
│   │   │   ├── booking.service.js
│   │   │   ├── queue.service.js    # Virtual queue logic
│   │   │   └── ticket.service.js   # QR code generation
│   │   ├── models/             # DB query functions (không dùng ORM)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT verify
│   │   │   └── role.middleware.js   # Admin guard
│   │   ├── jobs/
│   │   │   └── releaseExpiredSeats.job.js  # Cronjob mỗi 30s
│   │   ├── socket/
│   │   │   └── seatEvents.js       # Broadcast seat state changes
│   │   └── utils/
│   │       ├── qrcode.js
│   │       └── response.js         # Chuẩn hoá JSON response
│   ├── migrations/             # SQL migration files (001_init.sql, ...)
│   └── package.json
├── frontend/
│   ├── index.html              # Landing + event list
│   ├── event.html              # Chi tiết sự kiện + sơ đồ ghế
│   ├── checkout.html           # Xác nhận thanh toán
│   ├── my-tickets.html         # Quản lý vé của user
│   ├── queue.html              # Trang phòng chờ (Virtual Queue)
│   ├── admin/
│   │   ├── dashboard.html      # Real-time dashboard
│   │   ├── events.html         # Quản lý sự kiện
│   │   └── create-event.html   # Tạo sự kiện + sơ đồ ghế
│   ├── css/
│   │   ├── main.css
│   │   ├── seat-map.css
│   │   └── admin.css
│   └── js/
│       ├── api.js              # Fetch wrapper (base URL, auth headers)
│       ├── auth.js             # Login/logout/token management
│       ├── seat-map.js         # Render + interact sơ đồ ghế
│       ├── socket-client.js    # WebSocket connection + seat update handler
│       └── queue.js            # Virtual queue polling logic
└── tools/
    ├── seed.sql                # Sample data
    └── load-test.js            # Stress test script (optional)
```

## Coding Conventions

### Backend
- Dùng `async/await`, không dùng callback
- Mọi DB operation trong `services/`, controller chỉ gọi service
- Wrap business logic trong `try/catch`, throw lỗi có message rõ ràng
- Format JSON response thống nhất: `{ success, data, error }`
- Dùng `pg` (node-postgres) trực tiếp, không dùng ORM
- Đặt tên hàm theo động từ: `lockSeat()`, `releaseExpiredLocks()`, `createBooking()`

### Frontend
- ES Modules (`import/export`), không dùng `require()`
- Không dùng jQuery
- Fetch wrapper trong `api.js` — mọi call đi qua đó, không fetch trực tiếp trong HTML
- Cập nhật DOM sau API call, không reload trang
- Tên function camelCase, tên CSS class kebab-case

### Database
- Mọi hành động "giữ ghế" PHẢI dùng `BEGIN / SELECT FOR UPDATE / COMMIT`
- Tên bảng: snake_case (events, seat_zones, seats, bookings, tickets)
- Foreign key constraint đầy đủ

## Commands

```bash
# Dev setup
docker-compose up -d          # Start PostgreSQL + Redis
cd backend && npm install
npm run migrate               # Chạy migration SQL
npm run seed                  # Insert sample data
npm run dev                   # Start backend (port 3000)

# Frontend: mở trực tiếp qua Live Server hoặc
npx serve frontend            # Static server (port 5000)

# Test
npm run test                  # Unit tests
npm run test:watch
```

## Critical Rules

1. **Race condition** — TUYỆT ĐỐI dùng `SELECT FOR UPDATE` khi lock ghế. Không được dùng application-level check.
2. **No real payment** — Checkout chỉ cần bấm "Xác nhận" là xong, không tích hợp payment gateway.
3. **Auto-release** — Cronjob mỗi 30 giây: ghế `locked` quá 10 phút → chuyển về `available`, broadcast qua WebSocket.
4. **Secrets** — KHÔNG commit `.env`. Chỉ commit `.env.example`.
5. **AJAX only** — Frontend dùng `fetch()` cho mọi thao tác. Không submit `<form>` kiểu truyền thống.

## Seat States

```
available → locked (user click giữ ghế, TTL 10 phút)
locked    → sold   (user confirm thanh toán)
locked    → available (hết 10 phút, cronjob release)
```

## Definition of Done

Một feature hoàn thành khi:
1. API endpoint trả đúng dữ liệu, status code chính xác
2. Frontend cập nhật UI không cần reload
3. Edge case được xử lý (ghế đã bị giữ, session hết hạn, ...)
4. Không có `console.error` bị bỏ qua trong production code
5. Function có JSDoc comment nếu logic phức tạp

## See Also
- @PRD.md — Chi tiết đầy đủ tất cả features và acceptance criteria
- @README.md — Setup guide
- @backend/migrations/ — Database schema