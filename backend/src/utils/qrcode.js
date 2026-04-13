const crypto = require('crypto');

/**
 * Generate a cryptographically unique QR token for a ticket.
 * The token is stored in the `tickets.qr_code` column.
 * The frontend renders the actual QR image from this string using qrcode.js.
 *
 * @returns {string} UUID v4
 */
function generateQRToken() {
  return crypto.randomUUID();
}

module.exports = { generateQRToken };
