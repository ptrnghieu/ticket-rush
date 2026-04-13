const { Router } = require('express');
const bookingController = require('../controllers/booking.controller');
const { verifyToken }   = require('../middleware/auth.middleware');

const router = Router();

// All booking routes require authentication
router.use(verifyToken);

// POST /api/bookings/lock  — { eventId, seatIds[] }
router.post('/lock', bookingController.lock);

// GET /api/bookings/my  — must be before /:id to avoid shadowing
router.get('/my', bookingController.myBookings);

// POST /api/bookings/:id/confirm
router.post('/:id/confirm', bookingController.confirm);

module.exports = router;
