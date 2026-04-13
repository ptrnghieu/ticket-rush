const pool = require('../config/db');
const { client: redis } = require('../config/redis');
const bookingModel = require('../models/booking.model');
const ticketModel  = require('../models/ticket.model');
const seatEvents   = require('../socket/seatEvents');
const { generateQRToken } = require('../utils/qrcode');

/**
 * Confirm a pending booking: mark seats sold, generate tickets.
 *
 * Flow:
 *  1. Load booking — 404 if missing
 *  2. Ownership check — 403 if not the booking owner
 *  3. Status guard — 409 if already confirmed/expired
 *  4. Redis TTL check — 409 if lock has expired
 *  5. BEGIN
 *  6. Re-lock seat rows (FOR UPDATE NOWAIT) to prevent concurrent confirms
 *  7. Assert seats still locked by this user
 *  8. UPDATE seats → 'sold'
 *  9. UPDATE booking → 'confirmed'
 * 10. INSERT tickets (one per seat, unique QR token)
 * 11. COMMIT
 * 12. DEL Redis key
 * 13. Broadcast 'seats:updated' status 'sold'
 *
 * @param {number} bookingId
 * @param {number} userId
 * @returns {Promise<{ booking: object, tickets: object[] }>}
 */
async function confirmBooking(bookingId, userId) {
  // ── Steps 1–4: pre-flight checks (outside transaction) ───────────────────
  const booking = await bookingModel.findById(bookingId);
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }
  if (booking.user_id !== userId) {
    throw Object.assign(new Error('Not authorised to confirm this booking'), { status: 403 });
  }
  if (booking.status !== 'pending') {
    throw Object.assign(
      new Error(`Booking is already ${booking.status}`),
      { status: 409 }
    );
  }

  // Redis key must still exist — if it's gone the 10-min TTL has expired
  const lockVal = await redis.get(`lock:${bookingId}`);
  if (!lockVal) {
    throw Object.assign(
      new Error('Booking has expired — seats have been released'),
      { status: 409 }
    );
  }

  const seatIds = booking.seat_ids; // array set by booking.model.findById
  const eventId = booking.event_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Step 6: re-acquire row locks (fail fast if seat is in another tx) ───
    const { rows: lockedSeats } = await client.query(
      `SELECT id FROM seats
       WHERE id = ANY($1) AND status = 'locked' AND locked_by = $2
       FOR UPDATE NOWAIT`,
      [seatIds, userId]
    );

    // ── Step 7: all seats must still be locked by this user ──────────────────
    if (lockedSeats.length !== seatIds.length) {
      throw Object.assign(
        new Error('Booking has expired — seats are no longer held'),
        { status: 409 }
      );
    }

    // ── Step 8: mark seats sold ───────────────────────────────────────────────
    await client.query(
      `UPDATE seats
       SET status = 'sold', locked_by = NULL, locked_at = NULL
       WHERE id = ANY($1)`,
      [seatIds]
    );

    // ── Step 9: confirm booking ───────────────────────────────────────────────
    await bookingModel.updateStatusInTx(client, bookingId, 'confirmed');

    // ── Step 10: create tickets ───────────────────────────────────────────────
    const ticketItems = seatIds.map(seatId => ({ seatId, qrToken: generateQRToken() }));
    const tickets = await ticketModel.bulkCreateInTx(client, bookingId, ticketItems);

    await client.query('COMMIT');

    // ── Steps 12–13: cleanup + broadcast ─────────────────────────────────────
    await redis.del(`lock:${bookingId}`).catch(() => {});
    seatEvents.broadcastSeatUpdate(eventId, seatIds, 'sold');

    // Return the confirmed booking alongside the new tickets
    const confirmedBooking = { ...booking, status: 'confirmed' };
    return { booking: confirmedBooking, tickets };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    if (err.code === '55P03') {
      throw Object.assign(
        new Error('Booking has expired — seats are no longer held'),
        { status: 409 }
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Return all bookings for the current user with event + seat details.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
async function listMyBookings(userId) {
  return bookingModel.findByUser(userId);
}

/**
 * Return all tickets for the current user with seat + event details.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
async function listMyTickets(userId) {
  return ticketModel.findByUser(userId);
}

module.exports = { confirmBooking, listMyBookings, listMyTickets };
