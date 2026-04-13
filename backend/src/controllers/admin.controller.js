const adminService = require('../services/admin.service');
const { success, error } = require('../utils/response');

/**
 * GET /api/admin/dashboard/:eventId
 */
async function dashboard(req, res) {
  try {
    const data = await adminService.getDashboard(Number(req.params.eventId));
    res.json(success(data));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

/**
 * GET /api/admin/analytics
 */
async function analytics(req, res) {
  try {
    const data = await adminService.getAnalytics();
    res.json(success(data));
  } catch (err) {
    res.status(err.status || 500).json(error(err.message));
  }
}

module.exports = { dashboard, analytics };
