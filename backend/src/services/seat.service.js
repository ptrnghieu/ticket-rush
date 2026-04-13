const pool = require('../config/db');
const { client: redis } = require('../config/redis');
const bookingModel = require('../models/booking.model');
const seatEvents   = require('../socket/seatEvents');

const LOCK_TTL = () => parseInt(process.env.SEAT_LOCK_TTL_SECONDS) || 600;

/**
 * Lock seats and create a pending booking — the core critical section.
 *
 * Flow (all inside one transaction):
 *  1. Validate inputs
 *  2. BEGIN
 *  3. SELECT … FOR UPDATE NOWAIT  ← row-level lock; fails immediately if
 *                                    another transaction holds a lock (55P03)
 *  4. Assert all seats are 'available'
 *  5. Verify all seats belong to the requested event
 *  6. UPDATE seats → 'locked'
 *  7. Calculate total price
 *  8. INSERT booking (pending)
 *  9. INSERT booking_seats
 * 10. COMMIT
 * 11. SET Redis key lock:{bookingId}  EX {TTL}
 * 12. Broadcast 'seats:updated' via Socket.io
 *
 * @param {number}   userId
 * @param {number}   eventId
 * @param {number[]} seatIds
 * @returns {Promise<{ booking: object, expiresAt: Date }>}
 */
async function lockSeats(userId, eventId, seatIds) {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw Object.assign(new Error('seatIds must be a non-empty array'), { status: 400 });
  }
  if (seatIds.length > 4) {
    throw Object.assign(new Error('Cannot lock more than 4 seats per booking'), { status: 400 });
  }
  if (!eventId) {
    throw Object.assign(new Error('eventId is required'), { status: 400 });
  }

  // Deduplicate and coerce to integers
  const ids = [...new Set(seatIds.map(Number))];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Step 3: row-level lock (NOWAIT = fail fast, no deadlock wait) ────────
    const { rows: seats } = await client.query(
      `SELECT s.id, s.status, s.zone_id, sz.event_id, sz.price
       FROM seats s
       JOIN seat_zones sz ON sz.id = s.zone_id
       WHERE s.id = ANY($1)
       FOR UPDATE NOWAIT`,
      [ids]
    );

    // ── Step 4: all seats must exist ─────────────────────────────────────────
    if (seats.length !== ids.length) {
      throw Object.assign(new Error('One or more seats not found'), { status: 404 });
    }

    // ── Step 5: all seats must belong to the requested event ─────────────────
    const wrongEvent = seats.filter(s => s.event_id !== eventId);
    if (wrongEvent.length > 0) {
      throw Object.assign(
        new Error('One or more seats do not belong to this event'),
        { status: 400 }
      );
    }

    // ── Step 4 (continued): all must be 'available' ───────────────────────────
    const unavailable = seats.filter(s => s.status !== 'available');
    if (unavailable.length > 0) {
      throw Object.assign(
        new Error('One or more seats are not available'),
        { status: 409 }
      );
    }

    // ── Step 6: lock the seats ────────────────────────────────────────────────
    await client.query(
      `UPDATE seats
       SET status = 'locked', locked_by = $1, locked_at = NOW()
       WHERE id = ANY($2)`,
      [userId, ids]
    );

    // ── Step 7: total price ───────────────────────────────────────────────────
    const totalPrice = seats.reduce((sum, s) => sum + Number(s.price), 0);

    // ── Step 8: create pending booking ────────────────────────────────────────
    const booking = await bookingModel.createInTx(client, {
      userId,
      eventId,
      totalPrice,
    });

    // ── Step 9: link seats to booking ─────────────────────────────────────────
    await bookingModel.addSeatsInTx(client, booking.id, ids);

    await client.query('COMMIT');

    // ── Step 11: Redis TTL ────────────────────────────────────────────────────
    const ttl = LOCK_TTL();
    await redis.set(`lock:${booking.id}`, String(userId), { EX: ttl });

    // ── Step 12: broadcast ────────────────────────────────────────────────────
    seatEvents.broadcastSeatUpdate(eventId, ids, 'locked');

    const expiresAt = new Date(Date.now() + ttl * 1000);
    return { booking, seatIds: ids, expiresAt };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // PostgreSQL 55P03 = lock_not_available (raised by FOR UPDATE NOWAIT)
    if (err.code === '55P03') {
      throw Object.assign(
        new Error('One or more seats are currently being held by another user'),
        { status: 409 }
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Release all locked seats for a booking (used by the auto-release cronjob).
 * Updates seats → 'available', booking → 'expired', removes Redis key,
 * then broadcasts the change.
 *
 * @param {number} bookingId
 * @param {number} eventId
 * @param {number[]} seatIds
 */
async function releaseExpiredLock(bookingId, eventId, seatIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE seats
       SET status = 'available', locked_by = NULL, locked_at = NULL
       WHERE id = ANY($1) AND status = 'locked'`,
      [seatIds]
    );

    await client.query(
      `UPDATE bookings SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
      [bookingId]
    );

    await client.query('COMMIT');

    await redis.del(`lock:${bookingId}`).catch(() => {});
    seatEvents.broadcastSeatUpdate(eventId, seatIds, 'available');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { lockSeats, releaseExpiredLock };
