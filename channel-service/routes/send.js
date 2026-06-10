const express = require('express');
const router = express.Router();
const { simulateOutcomes } = require('../services/simulator');
const { scheduleCallbacks } = require('../services/callbackQueue');

/**
 * POST /send
 * Accept a communication from CRM and schedule async callbacks
 * 
 * Body: {
 *   communicationId, recipient, message, channel, metadata, callbackUrl
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { communicationId, recipient, message, channel, metadata, callbackUrl } = req.body;

    if (!communicationId || !channel) {
      return res.status(400).json({ error: 'communicationId and channel are required' });
    }

    const validChannels = ['whatsapp', 'sms', 'email', 'rcs'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `Invalid channel. Use: ${validChannels.join(', ')}` });
    }

    // Simulate outcomes
    const events = simulateOutcomes(channel);

    console.log(`\n📨 Received [${channel}] → ${recipient?.name || recipient?.id}`);
    console.log(`   ID: ${communicationId}`);
    console.log(`   Simulated path: ${events.map(e => e.event).join(' → ')}`);

    // Acknowledge receipt immediately
    res.status(202).json({
      accepted: true,
      communicationId,
      channel,
      simulatedEvents: events.map(e => e.event),
    });

    // Schedule async callbacks (non-blocking)
    scheduleCallbacks(communicationId, events, metadata);

  } catch (err) {
    console.error('POST /send error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
