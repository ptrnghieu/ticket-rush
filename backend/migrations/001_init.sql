-- TicketRush — Initial Schema
-- Migration: 001_init.sql

-- ENUMs
CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE seat_status AS ENUM ('available', 'locked', 'sold');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'expired');
CREATE TYPE ticket_status AS ENUM ('active', 'used', 'cancelled');
CREATE TYPE event_status AS ENUM ('draft', 'on_sale', 'ended');

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255)        NOT NULL,
  email         VARCHAR(255)        NOT NULL UNIQUE,
  password_hash VARCHAR(255)        NOT NULL,
  dob           DATE,
  gender        VARCHAR(20),
  role          user_role           NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255)        NOT NULL,
  description TEXT,
  banner_url  VARCHAR(512),
  venue       VARCHAR(255)        NOT NULL,
  event_date  TIMESTAMP WITH TIME ZONE NOT NULL,
  status      event_status        NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seat Zones (each event can have multiple zones with different prices)
CREATE TABLE IF NOT EXISTS seat_zones (
  id         SERIAL PRIMARY KEY,
  event_id   INTEGER             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       VARCHAR(100)        NOT NULL,
  color      VARCHAR(50)         NOT NULL DEFAULT '#4CAF50',
  rows       INTEGER             NOT NULL CHECK (rows > 0),
  cols       INTEGER             NOT NULL CHECK (cols > 0),
  price      NUMERIC(12, 2)      NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seats (one record per physical seat)
CREATE TABLE IF NOT EXISTS seats (
  id          SERIAL PRIMARY KEY,
  zone_id     INTEGER             NOT NULL REFERENCES seat_zones(id) ON DELETE CASCADE,
  row_label   VARCHAR(10)         NOT NULL,
  col_number  INTEGER             NOT NULL,
  status      seat_status         NOT NULL DEFAULT 'available',
  locked_by   INTEGER             REFERENCES users(id) ON DELETE SET NULL,
  locked_at   TIMESTAMP WITH TIME ZONE,
  UNIQUE (zone_id, row_label, col_number)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    INTEGER             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status      booking_status      NOT NULL DEFAULT 'pending',
  total_price NUMERIC(12, 2)      NOT NULL CHECK (total_price >= 0),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Booking ↔ Seat join table
CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id     INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, seat_id)
);

-- Tickets (one per seat per booking, holds QR code)
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER             NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id     INTEGER             NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  qr_code     TEXT                NOT NULL UNIQUE,
  status      ticket_status       NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, seat_id)
);

-- Virtual Queue Tokens
CREATE TABLE IF NOT EXISTS queue_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   INTEGER             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token      VARCHAR(255)        NOT NULL UNIQUE,
  used       BOOLEAN             NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_seats_zone_status    ON seats (zone_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_locked_by      ON seats (locked_by);
CREATE INDEX IF NOT EXISTS idx_seats_locked_at      ON seats (locked_at) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS idx_bookings_user        ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event       ON bookings (event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_booking      ON tickets (booking_id);
CREATE INDEX IF NOT EXISTS idx_queue_tokens_event   ON queue_tokens (event_id, used);
CREATE INDEX IF NOT EXISTS idx_events_status        ON events (status);
