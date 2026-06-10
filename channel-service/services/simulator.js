/**
 * Outcome Simulator — realistic per-channel delivery probabilities
 */

const CHANNEL_RATES = {
  whatsapp: {
    delivered: 0.85,
    opened:    0.65,
    read:      0.55,
    clicked:   0.18,
    converted: 0.04,
  },
  sms: {
    delivered: 0.78,
    opened:    0.45,
    read:      0.40,
    clicked:   0.08,
    converted: 0.02,
  },
  email: {
    delivered: 0.72,
    opened:    0.38,
    read:      0.30,
    clicked:   0.06,
    converted: 0.015,
  },
  rcs: {
    delivered: 0.80,
    opened:    0.55,
    read:      0.48,
    clicked:   0.14,
    converted: 0.03,
  },
};

// Timing ranges in seconds for each event
const EVENT_TIMING = {
  delivered:  { min: 2,    max: 5    },
  failed:     { min: 1,    max: 3    },
  opened:     { min: 10,   max: 60   },
  read:       { min: 15,   max: 90   },
  clicked:    { min: 30,   max: 180  },
  converted:  { min: 3600, max: 86400 }, // 1h–24h (simulation of 1-7 day window compressed)
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simulate the full event lifecycle for a communication
 * Returns an ordered array of { event, delayMs } objects
 */
function simulateOutcomes(channel) {
  const rates = CHANNEL_RATES[channel] || CHANNEL_RATES.sms;
  const events = [];

  // 1. Delivered or Failed
  if (Math.random() < rates.delivered) {
    events.push({
      event: 'delivered',
      delayMs: rand(EVENT_TIMING.delivered.min, EVENT_TIMING.delivered.max) * 1000,
    });

    // 2. Opened (conditional on delivered)
    if (Math.random() < rates.opened) {
      events.push({
        event: 'opened',
        delayMs: rand(EVENT_TIMING.opened.min, EVENT_TIMING.opened.max) * 1000,
      });

      // 3. Read (conditional on opened)
      if (Math.random() < rates.read / rates.opened) {
        events.push({
          event: 'read',
          delayMs: rand(EVENT_TIMING.read.min, EVENT_TIMING.read.max) * 1000,
        });
      }

      // 4. Clicked (conditional on opened)
      if (Math.random() < rates.clicked / rates.opened) {
        events.push({
          event: 'clicked',
          delayMs: rand(EVENT_TIMING.clicked.min, EVENT_TIMING.clicked.max) * 1000,
        });

        // 5. Converted (conditional on clicked)
        if (Math.random() < rates.converted / rates.clicked) {
          events.push({
            event: 'converted',
            delayMs: rand(EVENT_TIMING.converted.min, EVENT_TIMING.converted.max) * 1000,
          });
        }
      }
    }
  } else {
    // Failed
    events.push({
      event: 'failed',
      delayMs: rand(EVENT_TIMING.failed.min, EVENT_TIMING.failed.max) * 1000,
    });
  }

  return events;
}

module.exports = { simulateOutcomes, CHANNEL_RATES };
