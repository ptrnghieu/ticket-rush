/**
 * TicketRush — Seat Map Module
 *
 * Renders a zone-based seat grid from API data, handles seat selection
 * (max 4 seats), and exposes `updateSeatStatus()` for live WebSocket updates.
 *
 * Expected data shape from GET /api/events/:id/seats:
 *   { zones: [{ id, name, price, color, seats: [{ id, row_label, col_label, status }] }] }
 *
 * Usage:
 *   import { initSeatMap, updateSeatStatus, getSelectedSeats, clearSelection } from './seat-map.js';
 *
 *   initSeatMap(containerEl, data, ({ selectedIds, totalPrice, maxReached }) => { ... });
 *   updateSeatStatus(seatId, 'locked');
 */

export const MAX_SEATS = 4;

/** seatId (string) → seat data object */
const seatData = new Map();

/** seatId (string) → HTMLElement */
const seatElements = new Map();

/** seatId (string) → seat data of currently selected seats */
const selected = new Map();

/** @type {((payload: { selectedIds: number[], totalPrice: number, maxReached: boolean }) => void)|null} */
let _onChange = null;

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialise (or re-initialise) the seat map inside `container`.
 * Clears any previous state.
 *
 * @param {HTMLElement} container
 * @param {{ zones: Array<{ id: number, name: string, price: number, color: string,
 *   seats: Array<{ id: number, row_label: string, col_label: string, status: string }> }> }} data
 * @param {(payload: { selectedIds: number[], totalPrice: number, maxReached: boolean }) => void} onChange
 */
export function initSeatMap(container, data, onChange) {
  _onChange = onChange;
  seatData.clear();
  seatElements.clear();
  selected.clear();

  // Build lookup for seat data
  for (const zone of data.zones) {
    for (const seat of zone.seats) {
      seatData.set(String(seat.id), { ...seat, price: Number(zone.price), zoneName: zone.name });
    }
  }

  // Render HTML
  container.innerHTML = buildMapHtml(data);

  // Build element lookup & attach click handlers
  container.querySelectorAll('.seat').forEach(el => {
    seatElements.set(el.dataset.id, el);
    el.addEventListener('click', () => handleClick(el));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(el); }
    });
  });
}

/**
 * Update a single seat's visual state (called from WebSocket events).
 * Does NOT override a locally-selected seat unless it was sold by someone else.
 *
 * @param {number|string} seatId
 * @param {'available'|'locked'|'sold'} status
 */
export function updateSeatStatus(seatId, status) {
  const id = String(seatId);
  const el = seatElements.get(id);
  if (!el) return;

  const isLocallySelected = selected.has(id);

  // If the user has this seat selected but another user just sold it → force-deselect
  if (isLocallySelected && (status === 'sold' || status === 'locked')) {
    selected.delete(id);
    _notifyChange(false);
  } else if (isLocallySelected) {
    // Keep our selection visual — don't override with server's 'available'
    return;
  }

  _applySeatClass(el, status);
  el.dataset.status = status;

  // Update stored data
  const data = seatData.get(id);
  if (data) data.status = status;
}

/** @returns {number[]} Currently selected seat IDs */
export function getSelectedSeats() {
  return Array.from(selected.keys()).map(Number);
}

/** @returns {number} Total price of selected seats */
export function getSelectedTotal() {
  return Array.from(selected.values()).reduce((sum, s) => sum + s.price, 0);
}

/** Reset all selections (e.g. after a failed lock). */
export function clearSelection() {
  for (const id of selected.keys()) {
    const el = seatElements.get(id);
    if (el) _applySeatClass(el, 'available');
  }
  selected.clear();
  _notifyChange(false);
}

// ── Private helpers ────────────────────────────────────────────

function handleClick(el) {
  const id = el.dataset.id;
  const status = el.dataset.status;

  if (status === 'locked' || status === 'sold') return;

  if (status === 'selected') {
    // Deselect
    selected.delete(id);
    _applySeatClass(el, 'available');
    el.dataset.status = 'available';
    _notifyChange(false);
  } else {
    // Select — check max
    if (selected.size >= MAX_SEATS) {
      _notifyChange(true);
      return;
    }
    selected.set(id, seatData.get(id));
    _applySeatClass(el, 'selected');
    el.dataset.status = 'selected';
    _notifyChange(false);
  }
}

function _applySeatClass(el, status) {
  el.classList.remove('seat--available', 'seat--locked', 'seat--sold', 'seat--selected');
  el.classList.add(`seat--${status}`);
  const isInteractive = status === 'available' || status === 'selected';
  el.setAttribute('aria-disabled', String(!isInteractive));
  el.setAttribute('tabindex', isInteractive ? '0' : '-1');
  el.setAttribute('aria-label', `Ghế ${el.dataset.label} — ${_statusLabel(status)}`);
}

function _notifyChange(maxReached) {
  if (!_onChange) return;
  const selectedIds = Array.from(selected.keys()).map(Number);
  const totalPrice = Array.from(selected.values()).reduce((sum, s) => sum + s.price, 0);
  _onChange({ selectedIds, totalPrice, maxReached });
}

function _statusLabel(status) {
  return { available: 'trống', locked: 'đang giữ', sold: 'đã bán', selected: 'đã chọn' }[status] ?? status;
}

// ── HTML builders ──────────────────────────────────────────────

function buildMapHtml(data) {
  const stage = `<div class="stage">SÂN KHẤU</div>`;
  const zones = data.zones.map(buildZoneHtml).join('');
  return `<div class="seat-map">${stage}${zones}</div>`;
}

function buildZoneHtml(zone) {
  const price = _fmtVND(zone.price);
  const dot = zone.color
    ? `<span class="zone-color-dot" style="background:${escAttr(zone.color)}"></span>`
    : '';

  // Group seats by row_label, preserving order
  const rowMap = new Map();
  for (const seat of zone.seats) {
    if (!rowMap.has(seat.row_label)) rowMap.set(seat.row_label, []);
    rowMap.get(seat.row_label).push(seat);
  }

  // Sort columns within each row numerically where possible
  const rowsHtml = Array.from(rowMap.entries()).map(([rowLabel, seats]) => {
    seats.sort((a, b) => {
      const na = Number(a.col_number), nb = Number(b.col_number);
      return (isNaN(na) || isNaN(nb)) ? String(a.col_number).localeCompare(String(b.col_number)) : na - nb;
    });
    const seatsHtml = seats.map(buildSeatHtml).join('');
    return `<div class="seat-row">
      <span class="row-label">${escHtml(rowLabel)}</span>
      ${seatsHtml}
    </div>`;
  }).join('');

  const available = zone.seats.filter(s => s.status === 'available').length;

  return `<div class="zone-section">
    <div class="zone-header">
      <div class="zone-label">${dot}<span>${escHtml(zone.name)}</span></div>
      <div class="zone-stats">
        <span class="zone-stat">${available} ghế trống</span>
        <span class="zone-price">Giá: <strong>${price}</strong></span>
      </div>
    </div>
    <div class="seats-grid">${rowsHtml}</div>
  </div>`;
}

function buildSeatHtml(seat) {
  const status = seat.status;
  const label = `${seat.row_label}${seat.col_number}`;
  const isInteractive = status === 'available';
  return `<div
    class="seat seat--${status}"
    data-id="${seat.id}"
    data-status="${status}"
    data-label="${escAttr(label)}"
    role="button"
    tabindex="${isInteractive ? '0' : '-1'}"
    aria-label="Ghế ${escAttr(label)} — ${_statusLabel(status)}"
    ${!isInteractive ? 'aria-disabled="true"' : ''}
  ></div>`;
}

// ── Utilities ──────────────────────────────────────────────────

function _fmtVND(n) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(n);
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
