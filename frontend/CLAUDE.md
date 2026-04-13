# Frontend — Claude Code Context

## Core Rules
- ES Modules (`import`/`export`) trong tất cả JS files
- Mọi API call đi qua `js/api.js` — KHÔNG fetch trực tiếp
- KHÔNG dùng `<form action="...">` submit truyền thống
- KHÔNG reload trang (window.location chỉ dùng cho redirect có chủ đích)
- DOM update sau khi fetch thành công

## API Wrapper (js/api.js)
```js
// Cách dùng đúng
import { api } from './api.js';
const data = await api.get('/events');
const result = await api.post('/bookings/lock', { seatIds });
```
api.js tự động đính kèm JWT token từ localStorage vào header.

## Seat Map (js/seat-map.js)
- Render từ data: `{ zones: [{ id, name, rows, cols, seats: [...] }] }`
- Mỗi ghế là `<div class="seat" data-id="..." data-status="..."></div>`
- CSS class theo status: `.seat--available`, `.seat--locked`, `.seat--sold`, `.seat--selected`
- Hàm `updateSeatStatus(seatId, status)` — gọi khi nhận WebSocket event

## WebSocket (js/socket-client.js)
```js
// Listen seat updates
socket.on('seats:updated', ({ seatIds, status }) => {
  seatIds.forEach(id => updateSeatStatus(id, status));
});
```

## Form Validation
- Validate client-side trước khi submit
- Hiển thị lỗi inline (dưới field), không dùng `alert()`
- Disable nút submit khi đang loading, re-enable sau khi xong

## CSS Conventions
- Class names: kebab-case (`seat-map`, `event-card`, `btn-primary`)
- CSS Variables trong `main.css` cho màu sắc và spacing
- Mobile-first, breakpoint tablet: 768px, desktop: 1200px
- Không dùng `!important` trừ khi thực sự cần

## Countdown Timer
Trong checkout.html: tính từ `locked_at` trả về từ API, không tính từ lúc load trang.
Khi hết giờ: gọi API release + redirect về trang sự kiện.