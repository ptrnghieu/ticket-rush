const { Router } = require('express');
const eventController = require('../controllers/event.controller');

const router = Router();

// GET /api/events
router.get('/', eventController.listEvents);

// GET /api/events/:id
router.get('/:id', eventController.getEvent);

// GET /api/events/:id/seats
router.get('/:id/seats', eventController.getSeatMap);

module.exports = router;
