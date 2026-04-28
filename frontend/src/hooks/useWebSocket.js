import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

/**
 * Opens a WebSocket to /api/v1/ws/events/{eventId}?token=<jwt>
 * and calls onMessage with each parsed JSON payload.
 * Auto-reconnects on close (max 5 attempts, exponential backoff).
 */
export function useWebSocket(eventId, onMessage) {
  const wsRef = useRef(null);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = 5;

  const connect = useCallback(() => {
    if (!eventId) return;
    const token = localStorage.getItem('tr_token') ?? '';
    const url = `${WS_BASE}/api/v1/ws/events/${eventId}?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        onMessage(msg);
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (attemptsRef.current < MAX_ATTEMPTS) {
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 16000);
        attemptsRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => ws.close();
  }, [eventId, onMessage]);

  useEffect(() => {
    attemptsRef.current = 0;
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);
}
