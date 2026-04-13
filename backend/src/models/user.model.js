const pool = require('../config/db');

/**
 * Strip password_hash before returning user to callers.
 * @param {object} row
 * @returns {object}
 */
function sanitize(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}

/**
 * Find a user by email (includes password_hash for auth comparison).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

/**
 * Find a user by id — password_hash excluded.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return sanitize(rows[0]);
}

/**
 * Insert a new customer user.
 * @param {{ name: string, email: string, passwordHash: string, dob: string|null, gender: string|null }} params
 * @returns {Promise<object>} Created user (no password_hash)
 */
async function create({ name, email, passwordHash, dob, gender }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, dob, gender)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email, passwordHash, dob || null, gender || null]
  );
  return sanitize(rows[0]);
}

module.exports = { findByEmail, findById, create };
