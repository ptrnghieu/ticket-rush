const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes    = require('./routes/auth.routes');
const eventRoutes   = require('./routes/event.routes');
const bookingRoutes = require('./routes/booking.routes');
const ticketRoutes  = require('./routes/ticket.routes');
const queueRoutes   = require('./routes/queue.routes');
const adminRoutes   = require('./routes/admin.routes');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tickets',  ticketRoutes);
app.use('/api/queue',    queueRoutes);
app.use('/api/admin',    adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
