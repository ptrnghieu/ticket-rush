const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');

const SALT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GENDERS = ['male', 'female', 'other'];

/**
 * Sign a JWT for the given user payload.
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string}
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Register a new customer.
 * Throws Error with a descriptive message on any validation or conflict.
 *
 * @param {{ name: string, email: string, password: string, dob?: string, gender?: string }} params
 * @returns {Promise<{ token: string, user: object }>}
 */
async function register({ name, email, password, dob, gender }) {
  // ── Validation ────────────────────────────────────────────────────────────
  if (!name || !name.trim()) throw new Error('Name is required');
  if (!email || !EMAIL_RE.test(email)) throw new Error('Invalid email address');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
  if (dob) {
    const d = new Date(dob);
    if (isNaN(d.getTime())) throw new Error('Invalid date of birth');
    if (d > new Date()) throw new Error('Date of birth cannot be in the future');
  }
  if (gender && !VALID_GENDERS.includes(gender.toLowerCase())) {
    throw new Error(`Gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  // ── Uniqueness check ──────────────────────────────────────────────────────
  const existing = await userModel.findByEmail(email.toLowerCase());
  if (existing) throw Object.assign(new Error('Email is already registered'), { status: 409 });

  // ── Persist ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userModel.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash,
    dob: dob || null,
    gender: gender ? gender.toLowerCase() : null,
  });

  return { token: signToken(user), user };
}

/**
 * Authenticate a user and return a JWT.
 * Throws Error on bad credentials.
 *
 * @param {{ email: string, password: string }} params
 * @returns {Promise<{ token: string, user: object }>}
 */
async function login({ email, password }) {
  if (!email || !password) throw new Error('Email and password are required');

  const row = await userModel.findByEmail(email.toLowerCase());
  if (!row) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  // Return safe user (no password_hash)
  const { password_hash, ...user } = row;
  return { token: signToken(user), user };
}

/**
 * Fetch the authenticated user's profile.
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function getMe(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

module.exports = { register, login, getMe };
