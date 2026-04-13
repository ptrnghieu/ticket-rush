const pool = require('../config/db');

/**
 * Create ticket records inside a transaction — one ticket per seat.
 * @param {object} client - pg transaction client
 * @param {number} bookingId
 * @param {Array<{ seatId: number, qrToken: string }>} items
 * @returns {Promise<object[]>} Created ticket rows
 */
async function bulkCreateInTx(client, bookingId, items) {
  const tickets = [];
  for (const { seatId, qrToken } of items) {
    const { rows } = await client.query(
      `INSERT INTO tickets (booking_id, seat_id, qr_code)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [bookingId, seatId, qrToken]
    );
    tickets.push(rows[0]);
  }
  return tickets;
}

/**
 * Return all active tickets for a user, including seat and event context.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
async function findByUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.qr_code,
       t.status,
       t.created_at,
       s.row_label,
       s.col_number,
       sz.name       AS zone_name,
       sz.color      AS zone_color,
       sz.price      AS seat_price,
       e.id          AS event_id,
       e.title       AS event_title,
       e.event_date,
       e.venue,
       e.banner_url,
       b.id          AS booking_id
     FROM tickets t
     JOIN bookings   b   ON b.id   = t.booking_id
     JOIN seats      s   ON s.id   = t.seat_id
     JOIN seat_zones sz  ON sz.id  = s.zone_id
     JOIN events     e   ON e.id   = b.event_id
     WHERE b.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = { bulkCreateInTx, findByUser };
