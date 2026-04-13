# PRD — TicketRush
> Phiên bản: 1.0 | INT3306 Spring 2026

## 1. Tổng quan sản phẩm

**TicketRush** là nền tảng bán vé sự kiện âm nhạc/giải trí trực tuyến.
Được vận hành bởi một đơn vị tổ chức sự kiện (1 Admin), phục vụ khán giả (Customer).

**Điểm khác biệt cốt lõi**: Hệ thống phải xử lý đúng flash sale — hàng nghìn người cùng
click vào cùng 1 ghế, chỉ 1 người thắng, không ai bị bán trùng vé.

---

## 2. Vai trò & Quyền

| Role | Mô tả |
|------|-------|
| `customer` | Xem sự kiện, giữ ghế, thanh toán, xem vé |
| `admin` | Toàn quyền: tạo sự kiện, xem dashboard, thống kê |

---

## 3. Features Chi Tiết

### 3.1 Authentication

**Register (Customer)**
- Form: họ tên, email, password, ngày sinh, giới tính
- Validate: email format, password ≥ 8 ký tự, ngày sinh hợp lệ
- Response: JWT token + user info

**Login**
- Form: email + password
- Response: JWT token (expire 24h), lưu vào `localStorage`
- Redirect về trang trước nếu bị chặn do chưa đăng nhập

**Logout**
- Xoá token khỏi localStorage, redirect về trang chủ

**Acceptance criteria**:
- [ ] Token invalid → 401, redirect đến login
- [ ] Login sai password → hiện lỗi rõ, không reload trang
- [ ] Admin không thể đăng ký qua form (seeded trực tiếp vào DB)

---

### 3.2 Trang Chủ — Danh Sách Sự Kiện

**Hiển thị**:
- Grid các event card: ảnh, tên, ngày, địa điểm, giá từ, trạng thái (Sắp diễn ra / Đang mở bán / Hết vé)
- Tìm kiếm theo tên sự kiện (debounce 300ms)
- Filter theo trạng thái

**Acceptance criteria**:
- [ ] Load event list bằng `fetch()`, không reload trang
- [ ] Tìm kiếm realtime, không cần bấm nút
- [ ] Event hết vé hiển thị badge "SOLD OUT", disable nút đặt vé

---

### 3.3 Trang Chi Tiết Sự Kiện + Sơ Đồ Ghế

**Thông tin sự kiện**: ảnh banner, mô tả, ngày giờ, địa điểm, danh sách các zone + giá

**Sơ đồ ghế**:
- Render grid ghế theo ma trận (rows × cols) mỗi zone
- Màu sắc theo trạng thái:
  - `available` → xanh lá
  - `locked` (người khác đang giữ) → xám
  - `sold` → đỏ/tối
  - `selected` (user đang chọn) → xanh dương
- Click ghế `available` → chuyển sang `selected`, tối đa 4 ghế/lần
- Click ghế `selected` → bỏ chọn
- Nút "Giữ Chỗ" → gọi API lock, redirect sang checkout

**Real-time update**:
- WebSocket hoặc Polling 500ms
- Khi người khác lock/release ghế → cập nhật màu ngay, không cần f5

**Acceptance criteria**:
- [ ] Không thể click ghế đã `locked` hoặc `sold`
- [ ] Seat state update trong ≤ 1 giây sau khi người khác thay đổi
- [ ] Nếu ghế user đang chọn bị người khác lock → deselect + thông báo

---

### 3.4 Giữ Chỗ (Seat Lock API)

**Flow**:
1. User click "Giữ Chỗ" với danh sách seat IDs
2. Backend: `BEGIN TRANSACTION`
3. `SELECT * FROM seats WHERE id = ANY($1) FOR UPDATE`
4. Kiểm tra tất cả ghế còn `available`
5. Nếu có ghế nào đã bị lock/sold → rollback, trả lỗi
6. Nếu OK → update status = `locked`, ghi `locked_by`, `locked_at`
7. `COMMIT`
8. Tạo booking record, set Redis TTL = 600s
9. Broadcast seat update qua WebSocket

**Acceptance criteria**:
- [ ] Race condition test: 2 request đồng thời cho cùng ghế → chỉ 1 thành công
- [ ] Locked seat expire sau đúng 10 phút → tự động `available`
- [ ] Không được lock quá 4 ghế/booking

---

### 3.5 Thanh Toán (Checkout — Simplified)

**Hiển thị**:
- Danh sách ghế đã chọn, zone, giá từng ghế, tổng tiền
- Countdown timer 10:00 (đếm ngược từ lúc lock)
- Nút "XÁC NHẬN THANH TOÁN"

**Khi bấm Xác nhận**:
- API: update seats status = `sold`, tạo tickets với QR code
- Redirect sang trang "Đặt Vé Thành Công" với danh sách vé

**Khi hết giờ**:
- Auto redirect về trang sự kiện, thông báo "Đã hết thời gian giữ chỗ"

**Acceptance criteria**:
- [ ] Timer đếm ngược đúng thực tế (lấy từ `locked_at`, không tính từ lúc load trang)
- [ ] Không thể confirm sau khi hết TTL (backend check)
- [ ] Mỗi vé có QR code duy nhất

---

### 3.6 Quản Lý Vé (My Tickets)

- Danh sách vé đã mua: tên sự kiện, ngày, ghế, zone
- Click vào vé → xem QR code (full screen friendly)
- Trạng thái vé: `active` / `used` / `cancelled`

---

### 3.7 Virtual Queue (Tính năng nâng cao)

**Kích hoạt khi**: số user đang active trên trang sự kiện vượt ngưỡng (config: `MAX_CONCURRENT_USERS`, default 200)

**Flow**:
1. User vào trang sự kiện → backend check Redis counter
2. Nếu vượt ngưỡng → redirect sang `/queue?eventId=xxx`
3. Trang queue: hiển thị vị trí trong hàng đợi, thông báo không reload
4. Backend: cứ mỗi 30s, cấp token cho 50 user đầu hàng → họ được vào trang đặt vé
5. User nhận token → auto redirect về trang sự kiện kèm `?queueToken=xxx`
6. Backend verify token trước khi cho phép lock ghế

**Acceptance criteria**:
- [ ] Vị trí hàng đợi cập nhật realtime (WebSocket hoặc polling 2s)
- [ ] Token chỉ dùng được 1 lần
- [ ] User không được phép lách hàng (không có token → từ chối)

---

### 3.8 Admin — Quản Lý Sự Kiện

**Tạo sự kiện**:
- Form: tên, mô tả, ảnh banner (upload), ngày giờ, địa điểm
- Cấu hình zones: tên zone, màu sắc, số hàng × số ghế/hàng, giá vé
- Preview sơ đồ ghế trước khi lưu

**Danh sách sự kiện**:
- Xem tất cả sự kiện, status (draft / on_sale / ended)
- Sửa/xoá sự kiện (chỉ được xoá khi chưa có booking)

**Acceptance criteria**:
- [ ] Tạo sự kiện → tự động generate tất cả seat records trong DB
- [ ] Không thể xoá sự kiện đã có booking

---

### 3.9 Admin — Real-time Dashboard

**Metrics hiển thị**:
- Tổng vé đã bán / tổng vé
- % lấp đầy từng zone (progress bar)
- Biểu đồ doanh thu theo giờ (line chart)
- Số ghế đang `locked` (đang trong hàng chờ thanh toán)

**Real-time**: tự động refresh mỗi 10 giây hoặc nhận push từ WebSocket

**Acceptance criteria**:
- [ ] Dữ liệu update không cần reload trang
- [ ] Hiển thị đúng sau khi có booking mới

---

### 3.10 Admin — Thống Kê Khán Giả

- Phân bố độ tuổi (histogram)
- Phân bố giới tính (pie chart)
- Top sự kiện bán chạy

**Dữ liệu lấy từ**: thông tin user đã đăng ký (ngày sinh, giới tính) join với bookings

---

## 4. Database Schema (tóm tắt)

```sql
users         (id, name, email, password_hash, dob, gender, role, created_at)
events        (id, title, description, banner_url, venue, event_date, status, created_at)
seat_zones    (id, event_id, name, color, rows, cols, price, created_at)
seats         (id, zone_id, row_label, col_number, status, locked_by, locked_at)
bookings      (id, user_id, event_id, status, total_price, created_at)
booking_seats (booking_id, seat_id)
tickets       (id, booking_id, seat_id, qr_code, status, created_at)
queue_tokens  (id, user_id, event_id, token, used, created_at)
```

**Seat status ENUM**: `available`, `locked`, `sold`
**Booking status ENUM**: `pending`, `confirmed`, `expired`
**Ticket status ENUM**: `active`, `used`, `cancelled`

---

## 5. API Endpoints (tóm tắt)

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/events                        # list
GET    /api/events/:id                    # detail + zones
GET    /api/events/:id/seats              # seat map data

POST   /api/bookings/lock                 # { eventId, seatIds[] } → lock seats
POST   /api/bookings/:id/confirm          # xác nhận thanh toán
GET    /api/bookings/my                   # lịch sử booking của user

GET    /api/tickets/my                    # vé của user

GET    /api/queue/position?eventId=       # vị trí trong hàng đợi

GET    /api/admin/events                  # (admin only)
POST   /api/admin/events                  # tạo sự kiện
PUT    /api/admin/events/:id
DELETE /api/admin/events/:id
GET    /api/admin/dashboard/:eventId      # stats
GET    /api/admin/analytics               # audience stats
```

---

## 6. Tiêu Chí Chấm Điểm (từ đề bài)

| # | Tiêu chí | Hệ số | Cách đảm bảo |
|---|----------|-------|-------------|
| 1 | Chức năng & features | 0.35 | Implement đủ 3.1–3.9 |
| 2 | Thiết kế: Logic, dễ dùng | 0.1 | UX flow rõ ràng, không dead-end |
| 3 | Giao diện: Responsive, đẹp, có bản sắc | 0.2 | CSS cẩn thận, mobile-friendly |
| 4 | Hiệu năng: fetch/AJAX, JSON, DOM update | 0.1 | **Không dùng page reload** |
| 5 | Phong cách lập trình: pattern, tách biệt, comment | 0.05 | MVC, JSDoc, code sạch |
| 6 | Validate input | 0.05 | Client + server side validate |
| 7 | Bảo mật: auth, session, phân quyền | 0.05 | JWT, middleware, bcrypt |
| 8 | URL rewriting / routing | 0.05 | Express router, clean URLs |
| 9 | DB OOP / độc lập CSDL | 0.05 | Model layer tách riêng |

---

## 7. Out of Scope

- Tích hợp cổng thanh toán thật (VNPay, MoMo, ...)
- Email notification
- Mobile app
- Multi-organizer (chỉ có 1 Admin)