const pool = require('../config/db');
const eventModel = require('../models/event.model');
const seatModel  = require('../models/seat.model');

const VALID_STATUSES = ['draft', 'on_sale', 'ended'];

// ── Validation helpers ────────────────────────────────────────────────────────

function validateZone(zone, index) {
  const label = `zones[${index}]`;
  if (!zone.name || !zone.name.trim())          throw new Error(`${label}.name is required`);
  if (!Number.isInteger(zone.rows) || zone.rows < 1)  throw new Error(`${label}.rows must be a positive integer`);
  if (!Number.isInteger(zone.cols) || zone.cols < 1)  throw new Error(`${label}.cols must be a positive integer`);
  if (typeof zone.price !== 'number' || zone.price < 0) throw new Error(`${label}.price must be a non-negative number`);
}

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * List all visible events (drafts excluded for public; all for admin).
 * @param {{ status?: string, search?: string, includeAll?: boolean }} opts
 */
async function listEvents(opts = {}) {
  return eventModel.listAll(opts);
}

/**
 * Get a single event with its zones and seat counts.
 * @param {number} id
 */
async function getEvent(id) {
  const result = await eventModel.findWithZones(id);
  if (!result) throw Object.assign(new Error('Event not found'), { status: 404 });
  return result;
}

/**
 * Get the full seat map for an event, grouped by zone.
 * @param {number} eventId
 */
async function getSeatMap(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
  const zones = await seatModel.findByEventId(eventId);
  return { eventId: event.id, eventTitle: event.title, zones };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * Create an event with zones and auto-generate all seat records.
 * Everything runs in a single transaction — if any zone or seat insert
 * fails the entire event creation is rolled back.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   bannerUrl?: string,
 *   venue: string,
 *   eventDate: string,
 *   status?: string,
 *   zones: Array<{ name, color?, rows, cols, price }>
 * }} fields
 * @returns {Promise<{ event: object, zones: object[] }>}
 */
async function createEvent({ title, description, bannerUrl, venue, eventDate, status, zones }) {
  // ── Validate ────────────────────────────────────────────────────────────────
  if (!title || !title.trim())   throw new Error('title is required');
  if (!venue || !venue.trim())   throw new Error('venue is required');
  if (!eventDate)                throw new Error('eventDate is required');
  if (isNaN(new Date(eventDate).getTime())) throw new Error('eventDate is not a valid ISO date');
  if (status && !VALID_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error('At least one zone is required');
  }
  zones.forEach(validateZone);

  // ── Transaction: event → zones → seats ─────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const event = await eventModel.createInTx(client, {
      title: title.trim(),
      description,
      bannerUrl,
      venue: venue.trim(),
      eventDate,
      status,
    });

    const createdZones = [];
    for (const z of zones) {
      const zone = await eventModel.createZoneInTx(client, event.id, z);
      await seatModel.bulkCreateInTx(client, zone.id, z.rows, z.cols);
      createdZones.push({ ...zone, seatCount: z.rows * z.cols });
    }

    await client.query('COMMIT');
    return { event, zones: createdZones };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update top-level event fields (zones and seats are not touched).
 * @param {number} id
 * @param {{ title?, description?, bannerUrl?, venue?, eventDate?, status? }} fields
 */
async function updateEvent(id, fields) {
  if (fields.status && !VALID_STATUSES.includes(fields.status)) {
    throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (fields.eventDate && isNaN(new Date(fields.eventDate).getTime())) {
    throw new Error('eventDate is not a valid ISO date');
  }

  const event = await eventModel.update(id, fields);
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
  return event;
}

/**
 * Delete an event. Blocks if active bookings exist.
 * @param {number} id
 */
async function deleteEvent(id) {
  const event = await eventModel.findById(id);
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  const booked = await eventModel.hasBookings(id);
  if (booked) {
    throw Object.assign(
      new Error('Cannot delete an event that has bookings'),
      { status: 409 }
    );
  }

  await eventModel.remove(id);
}

module.exports = { listEvents, getEvent, getSeatMap, createEvent, updateEvent, deleteEvent };
