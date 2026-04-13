const { Router } = require('express');

const router = Router();

// GET /api/queue/position?eventId=
router.get('/position', (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' });
});

module.exports = router;
