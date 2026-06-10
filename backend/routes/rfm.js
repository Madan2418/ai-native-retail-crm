const express = require('express');
const router = express.Router();
const rfmService = require('../services/rfm');

/**
 * GET /api/rfm
 * Get RFM summary for all segments
 */
router.get('/', async (req, res) => {
  try {
    const summary = await rfmService.getRFMSummary();
    res.json(summary);
  } catch (err) {
    console.error('GET /rfm error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rfm/recalculate
 * Trigger full RFM recalculation for all customers
 */
router.get('/recalculate', async (req, res) => {
  try {
    const count = await rfmService.computeAndStoreAllRFM();
    res.json({ message: `RFM recalculated for ${count} customers`, count });
  } catch (err) {
    console.error('GET /rfm/recalculate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
