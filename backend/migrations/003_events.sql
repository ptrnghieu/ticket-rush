-- Migration: 003_events.sql
-- Events, seat zones, and seats are already declared in 001_init.sql.
-- This migration is intentionally idempotent (IF NOT EXISTS guards) and serves
-- as the feature boundary marker for the Events feature.

-- events, seat_zones, and seats tables created in 001_init.sql.
-- No new DDL needed — all objects already exist.

-- Ensure event_status enum values are present (no-op if already defined in 001).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM ('draft', 'on_sale', 'ended');
  END IF;
END$$;

-- No-op guard: create tables only if somehow missing from 001.
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255)             NOT NULL,
  description TEXT,
  banner_url  VARCHAR(512),
  venue       VARCHAR(255)             NOT NULL,
  event_date  TIMESTAMP WITH TIME ZONE NOT NULL,
  status      event_status             NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_zones (
  id         SERIAL PRIMARY KEY,
  event_id   INTEGER                  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       VARCHAR(100)             NOT NULL,
  color      VARCHAR(50)              NOT NULL DEFAULT '#4CAF50',
  rows       INTEGER                  NOT NULL CHECK (rows > 0),
  cols       INTEGER                  NOT NULL CHECK (cols > 0),
  price      NUMERIC(12, 2)           NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seats (
  id         SERIAL PRIMARY KEY,
  zone_id    INTEGER                  NOT NULL REFERENCES seat_zones(id) ON DELETE CASCADE,
  row_label  VARCHAR(10)              NOT NULL,
  col_number INTEGER                  NOT NULL,
  status     seat_status              NOT NULL DEFAULT 'available',
  locked_by  INTEGER                  REFERENCES users(id) ON DELETE SET NULL,
  locked_at  TIMESTAMP WITH TIME ZONE,
  UNIQUE (zone_id, row_label, col_number)
);
