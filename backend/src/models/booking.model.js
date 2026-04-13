const pool = require('../config/db');

/**
 * Create a booking record inside a transaction.
 * @param {object} client - pg transaction client
 * @param {{ userId: number, eventId: number, totalPrice: number }} params
 * @returns {Promise<object>}
 */
async function createInTx(client, { userId, eventId, totalPrice }) {
  const { rows } = await client.query(
    `INSERT INTO bookings (user_id, event_id, status, total_price)
     VALUES ($1, $2, 'pending', $3)
     RETURNING *`,
    [userId, eventId, totalPrice]
  );
  return rows[0];
}

/**
 * Insert booking_seats rows inside a transaction.
 * Uses a single multi-row INSERT — bookingId repeated for each seatId.
 * @param {object} client
 * @param {number} bookingId
 * @param {number[]} seatIds
 */
async function addSeatsInTx(client, bookingId, seatIds) {
  const values = seatIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await client.query(
    `INSERT INTO booking_seats (booking_id, seat_id) VALUES ${values}`,
    [bookingId, ...seatIds]
  );
}

/**
 * Find a booking by id including its seat IDs.
 * @param {number} id
 * @returns {Promise<object|null>}  booking row with extra `seat_ids: number[]`
 */
async function findById(id) {
  const { rows } = await pool.query(
    `SELECT b.*, COALESCE(array_agg(bs.seat_id) FILTER (WHERE bs.seat_id IS NOT NULL), '{}') AS seat_ids
     FROM bookings b
     LEFT JOIN booking_seats bs ON bs.booking_id = b.id
     WHERE b.id = $1
     GROUP BY b.id`,
    [id]
  );
  return rows[0] || null;
}

/**
 * List all bookings for a user, each with event info and seat details.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
async function findByUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       b.id,
       b.status,
       b.total_price,
       b.created_at,
       e.id          AS event_id,
       e.title       AS event_title,
       e.event_date,
       e.venue,
       e.banner_url,
       json_agg(
         json_build_object(
           'id',         s.id,
           'row_label',  s.row_label,
           'col_number', s.col_number,
           'status',     s.status,
           'zone_name',  sz.name,
           'zone_color', sz.color,
           'price',      sz.price
         ) ORDER BY sz.name, s.row_label, s.col_number
       ) AS seats
     FROM bookings b
     JOIN events       e  ON e.id  = b.event_id
     JOIN booking_seats bs ON bs.booking_id = b.id
     JOIN seats         s  ON s.id  = bs.seat_id
     JOIN seat_zones   sz  ON sz.id = s.zone_id
     WHERE b.user_id = $1
     GROUP BY b.id, e.id
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Update booking status inside a transaction.
 * @param {object} client
 * @param {number} bookingId
 * @param {'pending'|'confirmed'|'expired'} status
 */
async function updateStatusInTx(client, bookingId, status) {
  await client.query(
    'UPDATE bookings SET status = $1 WHERE id = $2',
    [status, bookingId]
  );
}

/**
 * Update booking status outside a transaction (uses pool directly).
 * Used by the cronjob to expire bookings.
 * @param {number} bookingId
 * @param {'expired'} status
 */
async function updateStatus(bookingId, status) {
  await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, bookingId]);
}

module.exports = {
  createInTx,
  addSeatsInTx,
  findById,
  findByUser,
  updateStatusInTx,
  updateStatus,
};
