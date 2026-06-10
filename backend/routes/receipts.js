const express = require('express');
const router = express.Router();
const { enqueueReceipt } = require('../services/queue');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/receipts
 * Idempotent callback endpoint from Channel Service
 * 
 * Body: { communicationId, event, timestamp, eventId, metadata }
 */
router.post('/', async (req, res) => {
  try {
    const { communicationId, event, timestamp, eventId, metadata } = req.body;

    if (!communicationId || !event) {
      return res.status(400).json({ error: 'communicationId and event are required' });
    }

    const validEvents = ['delivered', 'failed', 'opened', 'read', 'clicked', 'converted'];
    if (!validEvents.includes(event)) {
      return res.status(400).json({ error: `Invalid event. Must be one of: ${validEvents.join(', ')}` });
    }

    // Enqueue for async idempotent processing
    await enqueueReceipt({
      communicationId,
      event,
      timestamp: timestamp || new Date().toISOString(),
      eventId: eventId || uuidv4(),
      metadata,
    });

    // Respond immediately (202 Accepted)
    res.status(202).json({ accepted: true });
  } catch (err) {
    console.error('POST /receipts error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
