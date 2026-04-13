const pool = require('../config/db');

/**
 * List events with optional filters. Includes min_price from seat_zones.
 *
 * @param {{ status?: string, search?: string, includeAll?: boolean }} opts
 * @returns {Promise<object[]>}
 */
async function listAll({ status, search, includeAll = false } = {}) {
  const conditions = [];
  const params = [];

  if (!includeAll) {
    // Public listing: hide draft events
    conditions.push(`e.status != 'draft'`);
  }
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`e.title ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT e.*,
            COALESCE(MIN(sz.price), 0) AS min_price,
            COALESCE(SUM(sz.rows * sz.cols), 0) AS total_seats
     FROM events e
     LEFT JOIN seat_zones sz ON sz.event_id = e.id
     ${where}
     GROUP BY e.id
     ORDER BY e.event_date ASC`,
    params
  );
  return rows;
}

/**
 * Find one event by id (no zones).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Find event with its seat zones.
 * @param {number} id
 * @returns {Promise<{ event: object, zones: object[] }|null>}
 */
async function findWithZones(id) {
  const [evtRes, zonesRes] = await Promise.all([
    pool.query('SELECT * FROM events WHERE id = $1', [id]),
    pool.query(
      `SELECT sz.*,
              COUNT(s.id)                                        AS total_seats,
              COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats,
              COUNT(s.id) FILTER (WHERE s.status = 'sold')      AS sold_seats,
              COUNT(s.id) FILTER (WHERE s.status = 'locked')    AS locked_seats
       FROM seat_zones sz
       LEFT JOIN seats s ON s.zone_id = sz.id
       WHERE sz.event_id = $1
       GROUP BY sz.id
       ORDER BY sz.id`,
      [id]
    ),
  ]);

  if (!evtRes.rows[0]) return null;
  return { event: evtRes.rows[0], zones: zonesRes.rows };
}

/**
 * Create an event record (no zones). Used inside a transaction — accepts a client.
 * @param {object} client - pg transaction client
 * @param {{ title, description, bannerUrl, venue, eventDate, status }} fields
 * @returns {Promise<object>}
 */
async function createInTx(client, { title, description, bannerUrl, venue, eventDate, status }) {
  const { rows } = await client.query(
    `INSERT INTO events (title, description, banner_url, venue, event_date, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, description || null, bannerUrl || null, venue, eventDate, status || 'draft']
  );
  return rows[0];
}

/**
 * Create a seat zone inside a transaction.
 * @param {object} client
 * @param {number} eventId
 * @param {{ name, color, rows, cols, price }} zone
 * @returns {Promise<object>}
 */
async function createZoneInTx(client, eventId, { name, color, rows, cols, price }) {
  const { rows: r } = await client.query(
    `INSERT INTO seat_zones (event_id, name, color, rows, cols, price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [eventId, name, color || '#4CAF50', rows, cols, price]
  );
  return r[0];
}

/**
 * Update event fields (only non-null values are applied).
 * @param {number} id
 * @param {{ title?, description?, bannerUrl?, venue?, eventDate?, status? }} fields
 * @returns {Promise<object|null>}
 */
async function update(id, { title, description, bannerUrl, venue, eventDate, status }) {
  const sets = [];
  const params = [];

  const add = (col, val) => {
    if (val !== undefined) {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
  };

  add('title', title);
  add('description', description);
  add('banner_url', bannerUrl);
  add('venue', venue);
  add('event_date', eventDate);
  add('status', status);

  if (!sets.length) return findById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || null;
}

/**
 * Delete an event by id.
 * @param {number} id
 * @returns {Promise<boolean>} true if deleted
 */
async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Check whether any confirmed/pending bookings exist for this event.
 * @param {number} eventId
 * @returns {Promise<boolean>}
 */
async function hasBookings(eventId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM bookings WHERE event_id = $1 AND status IN ('pending','confirmed') LIMIT 1`,
    [eventId]
  );
  return rows.length > 0;
}

module.exports = {
  listAll,
  findById,
  findWithZones,
  createInTx,
  createZoneInTx,
  update,
  remove,
  hasBookings,
};
