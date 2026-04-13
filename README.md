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

### ✅ Done
- [ ] Auth (register, login, JWT)
- [ ] Event list + search
- [ ] Event detail + seat map render
- [ ] Seat lock với DB transaction
- [ ] Real-time seat update (WebSocket)
- [ ] Checkout + confirm
- [ ] Auto-release expired locks (cronjob)
- [ ] My Tickets + QR code
- [ ] Admin: tạo sự kiện + cấu hình zones
- [ ] Admin: real-time dashboard
- [ ] Admin: thống kê khán giả
- [ ] Virtual Queue

> Cập nhật file này sau mỗi feature hoàn thành.

---

## Lưu ý quan trọng

- Mọi seat lock PHẢI dùng `SELECT FOR UPDATE` — xem `seat.service.js`
- Không commit file `.env`
- Frontend KHÔNG được dùng page reload — dùng `fetch()` cho tất cả