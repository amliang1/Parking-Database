const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/reports/statistics
// @desc    Get daily statistics
// @access  Private
router.get('/statistics', auth, async (req, res) => {
  try {
    // Placeholder statistics for now
    res.json({
      totalVehicles: 150,
      totalViolations: 12,
      occupancyRate: 75.5,
      revenueToday: 2500
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
