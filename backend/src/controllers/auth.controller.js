const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { name, email, password, dob, gender } = req.body;
    const result = await authService.register({ name, email, password, dob, gender });
    res.status(201).json(success(result));
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json(error(err.message));
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(success(result));
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json(error(err.message));
  }
}

/**
 * GET /api/auth/me  (requires auth middleware)
 */
async function me(req, res) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json(success(user));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json(error(err.message));
  }
}

module.exports = { register, login, me };
