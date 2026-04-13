const cron = require('node-cron');
const pool = require('../config/db');
const { client: redis } = require('../config/redis');
const seatEvents = require('../socket/seatEvents');

const LOCK_INTERVAL = process.env.SEAT_LOCK_TTL_SECONDS
  ? `${process.env.SEAT_LOCK_TTL_SECONDS} seconds`
  : '10 minutes';

/**
 * Find all seats that have been locked beyond their TTL and release them:
 *  1. UPDATE seats → 'available' (locked → available)
 *  2. UPDATE bookings → 'expired' (pending → expired)
 *  3. DEL Redis lock keys
 *  4. Broadcast 'seats:updated' per event via Socket.io
 *
 * Runs inside one transaction per (event, booking) group so partial failures
 * don't leave seats in an inconsistent state.
 */
async function releaseExpiredSeats() {
  let rows;
  try {
    const result = await pool.query(
      `SELECT
         s.id          AS seat_id,
         sz.event_id,
         bs.booking_id
       FROM seats s
       JOIN seat_zones sz ON sz.id = s.zone_id
       LEFT JOIN booking_seats bs ON bs.seat_id = s.id
       WHERE s.status = 'locked'
         AND s.locked_at < NOW() - INTERVAL '${LOCK_INTERVAL}'
       ORDER BY sz.event_id, bs.booking_id`
    );
    rows = result.rows;
  } catch (err) {
    console.error('[release-job] Query error:', err.message);
    return;
  }

  if (rows.length === 0) return;

  // ── Group by (eventId, bookingId) ─────────────────────────────────────────
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.event_id}:${row.booking_id ?? 'orphan'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        eventId:   Number(row.event_id),
        bookingId: row.booking_id ? Number(row.booking_id) : null,
        seatIds:   [],
      });
    }
    groups.get(key).seatIds.push(Number(row.seat_id));
  }

  let releasedCount = 0;

  for (const { eventId, bookingId, seatIds } of groups.values()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Release seats
      await client.query(
        `UPDATE seats
         SET status = 'available', locked_by = NULL, locked_at = NULL
         WHERE id = ANY($1) AND status = 'locked'`,
        [seatIds]
      );

      // Expire the pending booking if one exists
      if (bookingId) {
        await client.query(
          `UPDATE bookings SET status = 'expired'
           WHERE id = $1 AND status = 'pending'`,
          [bookingId]
        );
      }

      await client.query('COMMIT');

      // Clean up Redis and notify clients
      if (bookingId) {
        await redis.del(`lock:${bookingId}`).catch(() => {});
      }
      seatEvents.broadcastSeatUpdate(eventId, seatIds, 'available');
      releasedCount += seatIds.length;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(
        `[release-job] Failed to release booking ${bookingId} (event ${eventId}):`,
        err.message
      );
    } finally {
      client.release();
    }
  }

  if (releasedCount > 0) {
    console.log(
      `[release-job] Released ${releasedCount} seat(s) across ${groups.size} booking(s)`
    );
  }
}

/**
 * Start the cron job. Called once from server.js after DB + Redis are ready.
 * Schedule: every 30 seconds  →  '* /30 * * * * *' (6-field, with seconds)
 */
function start() {
  // node-cron v4 6-field format: second minute hour day month weekday
  cron.schedule('*/30 * * * * *', () => {
    releaseExpiredSeats().catch((err) => {
      console.error('[release-job] Unhandled error:', err.message);
    });
  });

  console.log('[release-job] Started — checking every 30 s for expired seat locks');
}

module.exports = { start, releaseExpiredSeats };
