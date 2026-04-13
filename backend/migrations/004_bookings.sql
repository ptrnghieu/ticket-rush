-- Migration: 004_bookings.sql
-- bookings, booking_seats, and tickets are already declared in 001_init.sql.
-- This file is the feature boundary marker for the Booking feature.
-- All CREATE TABLE statements use IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    INTEGER             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status      booking_status      NOT NULL DEFAULT 'pending',
  total_price NUMERIC(12, 2)      NOT NULL CHECK (total_price >= 0),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id     INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, seat_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER             NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id     INTEGER             NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  qr_code     TEXT                NOT NULL UNIQUE,
  status      ticket_status       NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, seat_id)
);
