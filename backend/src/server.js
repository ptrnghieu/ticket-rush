require('dotenv').config();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const app = require('./app');
const pool = require('./config/db');
const { connectRedis } = require('./config/redis');
const seatEvents           = require('./socket/seatEvents');
const releaseExpiredSeatsJob = require('./jobs/releaseExpiredSeats.job');

const PORT = parseInt(process.env.PORT) || 3000;

const httpServer = http.createServer(app);

// ── Socket.io setup ───────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Attach io instance to app so routes/services can emit events
app.set('io', io);

// Initialise the seat-events singleton so services can broadcast without req
seatEvents.init(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`);
  });

  socket.on('leave:event', (eventId) => {
    socket.leave(`event:${eventId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Verify PostgreSQL connection
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');

    // Connect Redis
    await connectRedis();

    httpServer.listen(PORT, () => {
      console.log(`TicketRush backend running on http://localhost:${PORT}`);
    });

    // Start background jobs after the server is listening
    releaseExpiredSeatsJob.start();
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
