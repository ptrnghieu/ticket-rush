/**
 * Standardised JSON response helpers.
 * Usage:
 *   res.json(success(data))
 *   res.status(400).json(error('Validation failed'))
 */

/**
 * @param {*} data
 * @returns {{ success: true, data: * }}
 */
function success(data) {
  return { success: true, data };
}

/**
 * @param {string} message
 * @returns {{ success: false, error: string }}
 */
function error(message) {
  return { success: false, error: message };
}

module.exports = { success, error };
