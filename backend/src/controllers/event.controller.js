const eventService = require('../services/event.service');
const { success, error } = require('../utils/response');

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * GET /api/events
 * Query params: status, search
 */
async function listEvents(req, res) {
  try {
    const { status, search } = req.query;
    const events = await eventService.listEvents({ status, search });
    res.json(success(events));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * GET /api/events/:id
 */
async function getEvent(req, res) {
  try {
    const result = await eventService.getEvent(Number(req.params.id));
    res.json(success(result));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * GET /api/events/:id/seats
 */
async function getSeatMap(req, res) {
  try {
    const seatMap = await eventService.getSeatMap(Number(req.params.id));
    res.json(success(seatMap));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/events
 * Returns all events (including drafts).
 */
async function adminListEvents(req, res) {
  try {
    const { status, search } = req.query;
    const events = await eventService.listEvents({ status, search, includeAll: true });
    res.json(success(events));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * POST /api/admin/events
 * Body: { title, description?, bannerUrl?, venue, eventDate, status?, zones[] }
 */
async function createEvent(req, res) {
  try {
    const { title, description, bannerUrl, venue, eventDate, status, zones } = req.body;
    const result = await eventService.createEvent({
      title, description, bannerUrl, venue, eventDate, status, zones,
    });
    res.status(201).json(success(result));
  } catch (err) {
    res.status(err.status || 400).json(error(err.message));
  }
}

/**
 * PUT /api/admin/events/:id
 * Body: { title?, description?, bannerUrl?, venue?, eventDate?, status? }
 */
async function updateEvent(req, res) {
  try {
    const { title, description, bannerUrl, venue, eventDate, status } = req.body;
    const event = await eventService.updateEvent(Number(req.params.id), {
      title, description, bannerUrl, venue, eventDate, status,
    });
    res.json(success(event));
  } catch (err) {
    res.status(err.status || 400).json(error(err.message));
  }
}

/**
 * DELETE /api/admin/events/:id
 */
async function deleteEvent(req, res) {
  try {
    await eventService.deleteEvent(Number(req.params.id));
    res.json(success({ message: 'Event deleted' }));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

module.exports = {
  listEvents,
  getEvent,
  getSeatMap,
  adminListEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
