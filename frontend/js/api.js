/**
 * TicketRush — API fetch wrapper
 *
 * All HTTP calls in the app go through this module.
 * - Attaches JWT Bearer token from localStorage automatically
 * - On 401: clears auth state and redirects to login (unless already there)
 * - Throws Error with the server's error message on non-success responses
 *
 * Usage:
 *   import { api } from './api.js';
 *   const events = await api.get('/api/events');
 *   const result = await api.post('/api/bookings/lock', { eventId, seatIds });
 */

const BASE_URL = 'http://localhost:3000';

const TOKEN_KEY = 'tr_token';

/** Pages that should NOT trigger a 401 redirect loop */
const AUTH_PAGES = ['/login.html', '/register.html'];

function isAuthPage() {
  return AUTH_PAGES.some(p => window.location.pathname.endsWith(p));
}

/**
 * Core fetch wrapper.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} path - API path, e.g. '/api/events'
 * @param {object|null} body - Request body (auto JSON-serialised)
 * @returns {Promise<*>} Resolves with `data` from `{ success: true, data }`
 * @throws {Error} With server error message or network error
 */
async function request(method, path, body = null) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init = { method, headers };
  if (body !== null) {
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (networkErr) {
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
  }

  if (res.status === 401 && !isAuthPage()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('tr_user');
    const redirect = encodeURIComponent(window.location.href);
    window.location.replace(`login.html?redirect=${redirect}`);
    // Throw to abort any pending .then() chains
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Lỗi máy chủ (${res.status})`);
  }

  if (!json.success) {
    const err = new Error(json.error || 'Yêu cầu thất bại');
    err.status = res.status;
    throw err;
  }

  return json.data;
}

/**
 * Named API methods — mirrors REST verbs.
 * @namespace api
 */
export const api = {
  /** @param {string} path */
  get: (path) => request('GET', path),

  /** @param {string} path @param {object} body */
  post: (path, body) => request('POST', path, body),

  /** @param {string} path @param {object} body */
  put: (path, body) => request('PUT', path, body),

  /** @param {string} path @param {object} [body] */
  delete: (path, body = null) => request('DELETE', path, body),

  /** @param {string} path @param {object} body */
  patch: (path, body) => request('PATCH', path, body),
};
