/**
 * Callback Queue — dispatches async callbacks to CRM /receipts
 * with realistic delays and retry logic
 */
require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const CRM_RECEIPTS_URL = process.env.CRM_RECEIPTS_URL || 'http://localhost:3000/api/receipts';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [0, 2000, 8000]; // immediate, +2s, +8s

/**
 * Dispatch a single event callback to CRM with retries
 */
async function dispatchCallback(communicationId, event, metadata = {}) {
  const eventId = uuidv4();
  const payload = {
    communicationId,
    event,
    timestamp: new Date().toISOString(),
    eventId,
    metadata,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
    }

    try {
      await axios.post(CRM_RECEIPTS_URL, payload, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`📡 Callback dispatched: ${event} for ${communicationId} (attempt ${attempt + 1})`);
      return; // success
    } catch (err) {
      const status = err.response?.status;
      console.warn(`⚠️  Callback attempt ${attempt + 1} failed (${status || err.message}) for ${communicationId}`);

      if (attempt === MAX_RETRIES - 1) {
        console.error(`❌ Permanently failed callback: ${event} for ${communicationId}`);
      }
    }
  }
}

/**
 * Schedule all events for a communication with realistic delays
 */
function scheduleCallbacks(communicationId, events, metadata = {}) {
  let cumulativeDelay = 0;

  for (const { event, delayMs } of events) {
    // 5% chance of callback delivery failure (tests retry logic)
    const willFail = Math.random() < 0.05;
    cumulativeDelay += delayMs;

    setTimeout(() => {
      if (willFail) {
        console.log(`🎭 Simulating callback failure for ${event} → ${communicationId}`);
        // Still eventually deliver after a delay
        setTimeout(() => dispatchCallback(communicationId, event, metadata), 3000);
      } else {
        dispatchCallback(communicationId, event, metadata);
      }
    }, cumulativeDelay);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scheduleCallbacks, dispatchCallback };
