const pool = require('../config/db');

/**
 * Convert a 0-based row index to a label (A, B, …, Z, AA, AB, …).
 * @param {number} i  0-based
 * @returns {string}
 */
function rowLabel(i) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (i < 26) return alpha[i];
  // For row index >= 26: AA, AB, … AZ, BA, …
  return alpha[Math.floor(i / 26) - 1] + alpha[i % 26];
}

/**
 * Bulk-insert all seats for a zone inside an existing transaction.
 * Builds a single multi-row INSERT for efficiency.
 *
 * @param {object} client      - pg transaction client
 * @param {number} zoneId
 * @param {number} rows
 * @param {number} cols
 * @returns {Promise<void>}
 */
async function bulkCreateInTx(client, zoneId, rows, cols) {
  const values = [];
  const params = [];

  for (let r = 0; r < rows; r++) {
    const label = rowLabel(r);
    for (let c = 1; c <= cols; c++) {
      const base = params.length;
      params.push(zoneId, label, c);
      values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
    }
  }

  if (!values.length) return;

  await client.query(
    `INSERT INTO seats (zone_id, row_label, col_number) VALUES ${values.join(', ')}`,
    params
  );
}

/**
 * Return all seats for an event, grouped by zone.
 * Each zone object contains a `seats` array.
 *
 * @param {number} eventId
 * @returns {Promise<Array<{ id, name, color, price, rows, cols, seats: Array }>>}
 */
async function findByEventId(eventId) {
  const { rows } = await pool.query(
    `SELECT
       sz.id        AS zone_id,
       sz.name      AS zone_name,
       sz.color     AS zone_color,
       sz.price     AS zone_price,
       sz.rows      AS zone_rows,
       sz.cols      AS zone_cols,
       s.id         AS seat_id,
       s.row_label,
       s.col_number,
       s.status
     FROM seat_zones sz
     LEFT JOIN seats s ON s.zone_id = sz.id
     WHERE sz.event_id = $1
     ORDER BY sz.id, s.row_label, s.col_number`,
    [eventId]
  );

  // Group into zones
  const zoneMap = new Map();
  for (const row of rows) {
    if (!zoneMap.has(row.zone_id)) {
      zoneMap.set(row.zone_id, {
        id:    row.zone_id,
        name:  row.zone_name,
        color: row.zone_color,
        price: row.zone_price,
        rows:  row.zone_rows,
        cols:  row.zone_cols,
        seats: [],
      });
    }
    if (row.seat_id) {
      zoneMap.get(row.zone_id).seats.push({
        id:         row.seat_id,
        row_label:  row.row_label,
        col_number: row.col_number,
        status:     row.status,
      });
    }
  }

  return [...zoneMap.values()];
}

module.exports = { bulkCreateInTx, findByEventId, rowLabel };
