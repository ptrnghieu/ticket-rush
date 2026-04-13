const seatService    = require('../services/seat.service');
const bookingService = require('../services/booking.service');
const { success, error } = require('../utils/response');

/**
 * POST /api/bookings/lock
 * Body: { eventId, seatIds[] }
 */
async function lock(req, res) {
  try {
    const { eventId, seatIds } = req.body;
    const result = await seatService.lockSeats(req.user.id, Number(eventId), seatIds);
    res.status(201).json(success(result));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * POST /api/bookings/:id/confirm
 */
async function confirm(req, res) {
  try {
    const result = await bookingService.confirmBooking(
      Number(req.params.id),
      req.user.id
    );
    res.json(success(result));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * GET /api/bookings/my
 */
async function myBookings(req, res) {
  try {
    const bookings = await bookingService.listMyBookings(req.user.id);
    res.json(success(bookings));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * GET /api/tickets/my
 */
async function myTickets(req, res) {
  try {
    const tickets = await bookingService.listMyTickets(req.user.id);
    res.json(success(tickets));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

module.exports = { lock, confirm, myBookings, myTickets };
