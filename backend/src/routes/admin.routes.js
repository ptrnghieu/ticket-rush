const { Router } = require('express');
const eventController = require('../controllers/event.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');

const router = Router();

// All admin routes require authentication + admin role
router.use(verifyToken, requireRole('admin'));

// ── Event management ──────────────────────────────────────────────────────────

// GET /api/admin/events  — list all events (including drafts)
router.get('/events', eventController.adminListEvents);

// POST /api/admin/events  — create event + zones + seats
router.post('/events', eventController.createEvent);

// PUT /api/admin/events/:id
router.put('/events/:id', eventController.updateEvent);

// DELETE /api/admin/events/:id
router.delete('/events/:id', eventController.deleteEvent);

// ── Dashboard & Analytics (stubs — implemented later) ─────────────────────────

// GET /api/admin/dashboard/:eventId
router.get('/dashboard/:eventId', (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' });
});

// GET /api/admin/analytics
router.get('/analytics', (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' });
});

module.exports = router;
