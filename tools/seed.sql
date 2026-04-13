-- Admin user (password: Admin@123)
INSERT INTO users (name, email, password_hash, dob, gender, role)
VALUES ('Admin', 'admin@ticketrush.vn', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '1990-01-01', 'male', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Sample event
INSERT INTO events (title, description, banner_url, venue, event_date, status)
VALUES (
  'Đêm Nhạc Trịnh 2026',
  'Chương trình âm nhạc tưởng nhớ nhạc sĩ Trịnh Công Sơn.',
  'https://images.unsplash.com/photo-1540039155733-5bb30b99f9d5?w=800',
  'Nhà hát Lớn Hà Nội',
  '2026-06-15 20:00:00',
  'on_sale'
) ON CONFLICT DO NOTHING;

-- Zones for event 1
INSERT INTO seat_zones (event_id, name, color, rows, cols, price)
SELECT id, 'VIP', '#f59e0b', 3, 10, 800000 FROM events WHERE title = 'Đêm Nhạc Trịnh 2026'
ON CONFLICT DO NOTHING;

INSERT INTO seat_zones (event_id, name, color, rows, cols, price)
SELECT id, 'Standard', '#3b82f6', 5, 15, 350000 FROM events WHERE title = 'Đêm Nhạc Trịnh 2026'
ON CONFLICT DO NOTHING;

-- Generate seats for VIP zone
INSERT INTO seats (zone_id, row_label, col_number, status)
SELECT z.id,
  chr(64 + r) AS row_label,
  c AS col_number,
  'available'
FROM seat_zones z
CROSS JOIN generate_series(1, z.rows) r
CROSS JOIN generate_series(1, z.cols) c
WHERE z.name = 'VIP'
ON CONFLICT DO NOTHING;

-- Generate seats for Standard zone
INSERT INTO seats (zone_id, row_label, col_number, status)
SELECT z.id,
  chr(64 + r) AS row_label,
  c AS col_number,
  'available'
FROM seat_zones z
CROSS JOIN generate_series(1, z.rows) r
CROSS JOIN generate_series(1, z.cols) c
WHERE z.name = 'Standard'
ON CONFLICT DO NOTHING;