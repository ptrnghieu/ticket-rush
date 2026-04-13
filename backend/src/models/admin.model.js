const pool = require('../config/db');

/**
 * Per-zone seat counts and revenue for one event.
 * Returns overall totals as a separate summary row.
 *
 * @param {number} eventId
 * @returns {Promise<{ event: object, zones: object[], summary: object }>}
 */
async function getDashboardData(eventId) {
  const [eventRes, zonesRes, revenueRes] = await Promise.all([
    // Event header
    pool.query('SELECT * FROM events WHERE id = $1', [eventId]),

    // Per-zone seat status breakdown
    pool.query(
      `SELECT
         sz.id,
         sz.name,
         sz.color,
         sz.price,
         sz.rows,
         sz.cols,
         COUNT(s.id)                                                  AS total_seats,
         COUNT(s.id) FILTER (WHERE s.status = 'available')           AS available,
         COUNT(s.id) FILTER (WHERE s.status = 'locked')              AS locked,
         COUNT(s.id) FILTER (WHERE s.status = 'sold')                AS sold,
         COALESCE(
           SUM(sz.price) FILTER (WHERE s.status = 'sold'), 0
         )                                                            AS zone_revenue
       FROM seat_zones sz
       LEFT JOIN seats s ON s.zone_id = sz.id
       WHERE sz.event_id = $1
       GROUP BY sz.id
       ORDER BY sz.id`,
      [eventId]
    ),

    // Confirmed revenue grouped by hour (for the line chart)
    pool.query(
      `SELECT
         date_trunc('hour', b.created_at)  AS hour,
         COUNT(DISTINCT b.id)              AS bookings,
         SUM(b.total_price)                AS revenue
       FROM bookings b
       WHERE b.event_id = $1
         AND b.status   = 'confirmed'
       GROUP BY date_trunc('hour', b.created_at)
       ORDER BY hour`,
      [eventId]
    ),
  ]);

  return {
    event:   eventRes.rows[0] || null,
    zones:   zonesRes.rows,
    revenue: revenueRes.rows,
  };
}

/**
 * Audience analytics across all events:
 *  - Age distribution (decade buckets: 10s, 20s, 30s, …)
 *  - Gender breakdown
 *  - Top 10 events by tickets sold
 *
 * @returns {Promise<{ ageDistribution: object[], genderBreakdown: object[], topEvents: object[] }>}
 */
async function getAnalyticsData() {
  const [ageRes, genderRes, topRes] = await Promise.all([
    // Age buckets — only users who have a confirmed booking and a known dob
    pool.query(
      `SELECT
         (FLOOR(
           EXTRACT(YEAR FROM AGE(NOW(), u.dob)) / 10
         ) * 10)::integer            AS age_group,
         COUNT(DISTINCT u.id)        AS count
       FROM users u
       JOIN bookings b ON b.user_id = u.id
       WHERE u.dob IS NOT NULL
         AND b.status = 'confirmed'
       GROUP BY age_group
       ORDER BY age_group`
    ),

    // Gender breakdown (customers with at least one confirmed booking)
    pool.query(
      `SELECT
         COALESCE(u.gender, 'unknown') AS gender,
         COUNT(DISTINCT u.id)          AS count
       FROM users u
       JOIN bookings b ON b.user_id = u.id
       WHERE b.status = 'confirmed'
       GROUP BY COALESCE(u.gender, 'unknown')
       ORDER BY count DESC`
    ),

    // Top 10 events by tickets sold.
    // Revenue uses a correlated subquery to avoid join-inflation when one
    // booking has multiple tickets (JOIN tickets × booking rows multiplies
    // total_price by the ticket count).
    pool.query(
      `SELECT
         e.id,
         e.title,
         e.event_date,
         e.status,
         COUNT(DISTINCT b.id)   AS booking_count,
         COUNT(t.id)            AS tickets_sold,
         COALESCE(
           (SELECT SUM(b2.total_price)
            FROM   bookings b2
            WHERE  b2.event_id = e.id
              AND  b2.status   = 'confirmed'),
           0
         )                      AS total_revenue
       FROM events e
       LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
       LEFT JOIN tickets  t ON t.booking_id = b.id
       GROUP BY e.id
       ORDER BY tickets_sold DESC
       LIMIT 10`
    ),
  ]);

  return {
    ageDistribution:  ageRes.rows,
    genderBreakdown:  genderRes.rows,
    topEvents:        topRes.rows,
  };
}

module.exports = { getDashboardData, getAnalyticsData };
