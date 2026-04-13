/**
 * TicketRush — WebSocket client
 *
 * Thin wrapper around socket.io-client.
 * Connects to the backend, joins an event room, and dispatches seat
 * status updates to a registered handler.
 *
 * Usage:
 *   import { connectToEvent, disconnect, onSeatsUpdated } from './socket-client.js';
 *
 *   onSeatsUpdated((seatIds, status) => { ... });
 *   connectToEvent(eventId);
 *   // later…
 *   disconnect();
 */

// socket.io 4.x ESM build from CDN — works with any socket.io 4.x server
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

const SOCKET_URL = 'http://localhost:3000';

/** @type {import('socket.io-client').Socket|null} */
let socket = null;

/** @type {((seatIds: number[], status: string) => void)|null} */
let _onSeatsUpdated = null;

/** @type {(() => void)|null} */
let _onConnect = null;

/** @type {(() => void)|null} */
let _onDisconnect = null;

/**
 * Connect to the socket.io server and join the specified event room.
 * Safe to call multiple times — disconnects previous socket first.
 *
 * @param {number|string} eventId
 */
export function connectToEvent(eventId) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    socket.emit('join:event', String(eventId));
    _onConnect?.();
  });

  socket.on('seats:updated', ({ seatIds, status }) => {
    _onSeatsUpdated?.(seatIds, status);
  });

  socket.on('disconnect', (reason) => {
    _onDisconnect?.(reason);
  });

  socket.on('connect_error', (err) => {
    // Non-fatal — polling will fall back automatically
    console.warn('[socket] connect_error:', err.message);
  });
}

/**
 * Disconnect from the server and clean up.
 */
export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Register a callback to receive seat status updates.
 * @param {(seatIds: number[], status: string) => void} handler
 */
export function onSeatsUpdated(handler) {
  _onSeatsUpdated = handler;
}

/**
 * Register a callback for when the socket connects (or reconnects).
 * @param {() => void} handler
 */
export function onConnect(handler) {
  _onConnect = handler;
}

/**
 * Register a callback for when the socket disconnects.
 * @param {(reason: string) => void} handler
 */
export function onDisconnect(handler) {
  _onDisconnect = handler;
}

/** @returns {boolean} */
export function isConnected() {
  return socket?.connected ?? false;
}
