const { Router } = require('express');
const bookingController = require('../controllers/booking.controller');
const { verifyToken }   = require('../middleware/auth.middleware');

const router = Router();

// All ticket routes require authentication
router.use(verifyToken);

// GET /api/tickets/my
router.get('/my', bookingController.myTickets);

module.exports = router;
