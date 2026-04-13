/**
 * Singleton wrapper around Socket.io for seat state broadcasts.
 *
 * Usage:
 *   // server.js — called once at startup after io is created:
 *   seatEvents.init(io);
 *
 *   // anywhere in services:
 *   seatEvents.broadcastSeatUpdate(eventId, seatIds, 'locked');
 */

let _io = null;

/**
 * Attach the Socket.io server instance. Call once from server.js.
 * @param {import('socket.io').Server} io
 */
function init(io) {
  _io = io;
}

/**
 * Broadcast a seat status change to all clients watching the event room.
 *
 * @param {number}   eventId
 * @param {number[]} seatIds
 * @param {'available'|'locked'|'sold'} status
 */
function broadcastSeatUpdate(eventId, seatIds, status) {
  if (!_io) return;
  _io.to(`event:${eventId}`).emit('seats:updated', { eventId, seatIds, status });
}

module.exports = { init, broadcastSeatUpdate };
