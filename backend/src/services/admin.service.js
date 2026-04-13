const adminModel = require('../models/admin.model');
const eventModel = require('../models/event.model');

/**
 * Build the real-time dashboard payload for one event.
 *
 * @param {number} eventId
 * @returns {Promise<object>}
 */
async function getDashboard(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  const { zones, revenue } = await adminModel.getDashboardData(eventId);

  // Aggregate summary across all zones
  const summary = zones.reduce(
    (acc, z) => {
      acc.totalSeats   += Number(z.total_seats);
      acc.available    += Number(z.available);
      acc.locked       += Number(z.locked);
      acc.sold         += Number(z.sold);
      acc.totalRevenue += Number(z.zone_revenue);
      return acc;
    },
    { totalSeats: 0, available: 0, locked: 0, sold: 0, totalRevenue: 0 }
  );

  summary.fillRate = summary.totalSeats > 0
    ? Math.round((summary.sold / summary.totalSeats) * 100)
    : 0;

  return { event, zones, summary, revenueByHour: revenue };
}

/**
 * Build the audience analytics payload (all events combined).
 *
 * @returns {Promise<object>}
 */
async function getAnalytics() {
  const data = await adminModel.getAnalyticsData();

  // Label age buckets for the frontend (e.g. "20-29")
  const ageDistribution = data.ageDistribution.map((row) => ({
    label: `${row.age_group}–${row.age_group + 9}`,
    ageGroup: row.age_group,
    count: Number(row.count),
  }));

  const genderBreakdown = data.genderBreakdown.map((row) => ({
    gender: row.gender,
    count:  Number(row.count),
  }));

  const topEvents = data.topEvents.map((row) => ({
    id:           Number(row.id),
    title:        row.title,
    eventDate:    row.event_date,
    status:       row.status,
    bookingCount: Number(row.booking_count),
    ticketsSold:  Number(row.tickets_sold),
    totalRevenue: Number(row.total_revenue),
  }));

  return { ageDistribution, genderBreakdown, topEvents };
}

module.exports = { getDashboard, getAnalytics };
