/**
 * TicketRush — Auth helpers
 *
 * Manages JWT token + user profile in localStorage.
 * Provides login, register, logout, guards, and nav rendering.
 *
 * Usage:
 *   import { login, logout, isAdmin, renderNavAuth } from './auth.js';
 */

import { api } from './api.js';

const TOKEN_KEY = 'tr_token';
const USER_KEY  = 'tr_user';

// ── Storage helpers ────────────────────────────────────────────

/** @returns {string|null} */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** @returns {{ id, name, email, role, dob, gender }|null} */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

/** @returns {boolean} */
export function isLoggedIn() {
  return Boolean(getToken());
}

/** @returns {boolean} */
export function isAdmin() {
  return getUser()?.role === 'admin';
}

/**
 * Persist auth credentials returned from login/register API.
 * @param {string} token
 * @param {object} user
 */
export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Remove auth credentials from storage. */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── API calls ──────────────────────────────────────────────────

/**
 * Authenticate with email/password, persist credentials.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} user object
 */
export async function login(email, password) {
  const data = await api.post('/api/auth/login', { email, password });
  setAuth(data.token, data.user);
  return data.user;
}

/**
 * Register a new customer account, persist credentials.
 * @param {{ name, email, password, dob?, gender? }} fields
 * @returns {Promise<object>} user object
 */
export async function register({ name, email, password, dob, gender }) {
  const data = await api.post('/api/auth/register', { name, email, password, dob, gender });
  setAuth(data.token, data.user);
  return data.user;
}

/**
 * Log out: clear stored credentials and go to homepage.
 */
export function logout() {
  clearAuth();
  window.location.replace(getPageRoot() + 'index.html');
}

// ── Route guards ───────────────────────────────────────────────

/**
 * Redirect to login if not authenticated.
 * Call at the top of page scripts that require a logged-in user.
 * @returns {boolean} true if authenticated
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    const redirect = encodeURIComponent(window.location.href);
    window.location.replace(`${getPageRoot()}login.html?redirect=${redirect}`);
    return false;
  }
  return true;
}

/**
 * Redirect to homepage if not an admin.
 * Implicitly calls requireAuth first.
 * @returns {boolean} true if admin
 */
export function requireAdmin() {
  if (!requireAuth()) return false;
  if (!isAdmin()) {
    window.location.replace(getPageRoot() + 'index.html');
    return false;
  }
  return true;
}

// ── Nav rendering ──────────────────────────────────────────────

/**
 * Inject auth-dependent controls into the nav.
 * Call on every page after DOM is ready.
 *
 * @param {HTMLElement} container - the `#nav-auth` element
 */
export function renderNavAuth(container) {
  if (!container) return;

  if (isLoggedIn()) {
    const user = getUser();
    const root = getPageRoot();
    container.innerHTML = `
      ${isAdmin()
        ? `<a href="${root}admin/dashboard.html" class="nav-link">Dashboard</a>`
        : `<a href="${root}my-tickets.html" class="nav-link">Vé của tôi</a>`
      }
      <div class="nav-divider"></div>
      <span class="nav-user">${escapeHtml(user?.name ?? 'Tài khoản')}</span>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Đăng xuất</button>
    `;
    container.querySelector('#logout-btn').addEventListener('click', logout);
  } else {
    const root = getPageRoot();
    container.innerHTML = `
      <a href="${root}login.html" class="btn btn-ghost btn-sm">Đăng nhập</a>
      <a href="${root}register.html" class="btn btn-primary btn-sm">Đăng ký</a>
    `;
  }
}

// ── Utilities ──────────────────────────────────────────────────

/**
 * Return relative path prefix to the frontend root.
 * Pages inside admin/ need '../', top-level pages need './'.
 * @returns {string}
 */
function getPageRoot() {
  return window.location.pathname.includes('/admin/') ? '../' : './';
}

/**
 * Safely escape HTML to prevent XSS when inserting user data into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
