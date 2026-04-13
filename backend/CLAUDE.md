# Backend — Claude Code Context

## Architecture Pattern
Controller → Service → Model (DB)
- **Controller**: parse req, gọi service, format response. Không có logic.
- **Service**: toàn bộ business logic, DB transaction. Throw Error nếu thất bại.
- **Model**: raw SQL queries, trả raw rows. Không có business logic.

## Response Format
Luôn dùng `utils/response.js`:
```js
res.json(success(data))        // { success: true, data }
res.json(error("message", 400)) // { success: false, error: "message" }
```

## Database Rules
- Pool từ `config/db.js` — không tạo connection mới
- Transaction pattern:
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... queries
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
- Seat lock BẮT BUỘC: `SELECT ... FOR UPDATE NOWAIT`
  - `NOWAIT` để fail fast thay vì chờ lock (tránh deadlock)

## Auth Pattern
- JWT verify trong `middleware/auth.middleware.js`
- Admin routes thêm `middleware/role.middleware.js` sau auth middleware
- User ID lấy từ `req.user.id` (được set bởi auth middleware)

## Error Codes
- 400: Bad request / validation fail
- 401: Unauthenticated
- 403: Forbidden (role không đủ)
- 409: Conflict (ghế đã bị lock)
- 500: Server error (log đầy đủ, không expose stack trace)

## Critical: Seat Lock Service
File: `services/seat.service.js`
Hàm `lockSeats(userId, seatIds)`:
1. Validate seatIds không rỗng, ≤ 4 ghế
2. BEGIN transaction
3. SELECT FOR UPDATE NOWAIT
4. Check tất cả status = 'available'
5. UPDATE status = 'locked', locked_by, locked_at
6. COMMIT
7. Emit socket event 'seats:updated'
8. Return booking info

Bất kỳ step nào fail → ROLLBACK, throw Error với message rõ ràng.