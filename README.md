# TicketRush 🎫

Nền tảng bán vé sự kiện trực tuyến — INT3306 Spring 2026

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (ES Modules, Fetch API, WebSocket)
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Cache / Queue**: Redis
- **Real-time**: Socket.io
- **Background Jobs**: Bull (node-cron fallback)

---

## Yêu cầu

- Node.js ≥ 18
- Docker + Docker Compose
- Git

---

## Setup

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd ticketrush
cd backend && npm install
```

### 2. Cấu hình biến môi trường

```bash
cp .env.example .env
# Sửa .env nếu cần (DB_PASSWORD, JWT_SECRET, ...)
```

### 3. Khởi động PostgreSQL + Redis

```bash
docker-compose up -d
```

### 4. Chạy migration & seed data

```bash
cd backend
npm run migrate   # Tạo tables
npm run seed      # Insert sample events + admin account
```

### 5. Khởi động backend

```bash
npm run dev       # Port 3000
```

### 6. Mở frontend

```bash
# Dùng VS Code Live Server, hoặc:
npx serve ../frontend   # Port 5000
```

---

## Tài khoản mặc định (sau khi seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ticketrush.vn | Admin@123 |
| Customer (test) | user@test.vn | Test@123 |

---

## Scripts

```bash
npm run dev        # Dev server với hot reload
npm run start      # Production
npm run migrate    # Chạy tất cả SQL migrations
npm run seed       # Insert sample data
npm run test       # Unit tests
npm run lint       # ESLint check
```

---

## Cấu trúc thư mục

```
ticketrush/
├── backend/
│   ├── src/
│   │   ├── routes/        # Express routers
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic + DB transactions
│   │   ├── models/        # DB query functions
│   │   ├── middleware/    # Auth, role guard
│   │   ├── jobs/          # Background workers
│   │   └── socket/        # WebSocket event handlers
│   └── migrations/        # SQL schema files
├── frontend/
│   ├── *.html             # Pages
│   ├── css/               # Stylesheets
│   ├── js/                # ES Modules
│   └── admin/             # Admin pages
└── tools/                 # Seed scripts, load test
```

---

## Implementation Status

### Backend — 100% hoàn thành

- [x] Auth: register, login, JWT, bcrypt, role middleware
- [x] Events CRUD + auto seat generation khi tạo zone
- [x] Seat lock với `SELECT FOR UPDATE NOWAIT` (race-condition safe)
- [x] Booking confirm + tạo tickets với QR code
- [x] Auto-release khoá hết hạn (cronjob mỗi 30 giây)
- [x] Admin dashboard API: thống kê sold/locked/available + doanh thu theo giờ
- [x] Admin analytics API: phân bố tuổi, giới tính, top sự kiện
- [x] Socket.io broadcast realtime khi seat thay đổi trạng thái

### Frontend — 95% hoàn thành

- [x] `index.html` — danh sách sự kiện, tìm kiếm debounce, filter theo trạng thái
- [x] `login.html` + `register.html` — auth forms, JWT lưu localStorage
- [x] `event.html` — chi tiết sự kiện, sơ đồ ghế tương tác, WebSocket live update
- [x] `checkout.html` — countdown timer (tính từ `locked_at`), xác nhận thanh toán
- [x] `my-tickets.html` — danh sách vé nhóm theo sự kiện, xem QR code fullscreen
- [x] `admin/dashboard.html` — thống kê realtime, biểu đồ doanh thu (Chart.js), tự động refresh 10s
- [x] `admin/events.html` — quản lý sự kiện, inline status change, edit modal đầy đủ, xoá có confirm
- [x] `admin/create-event.html` — tạo sự kiện + zone builder động, preview sơ đồ ghế

### Chưa triển khai

- [ ] Virtual Queue (PRD 3.7) — hàng đợi ảo khi vượt ngưỡng concurrent users

> Tất cả API call đi qua `js/api.js`. Không có page reload trong luồng chính.

---

## Lưu ý quan trọng

- Mọi seat lock PHẢI dùng `SELECT FOR UPDATE` — xem `seat.service.js`
- Không commit file `.env`
- Frontend KHÔNG được dùng page reload — dùng `fetch()` cho tất cả