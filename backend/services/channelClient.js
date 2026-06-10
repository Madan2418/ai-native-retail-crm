/**
 * Channel Client — calls the stubbed Channel Service
 */
require('dotenv').config();
const axios = require('axios');

const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000';

/**
 * Send a communication to the Channel Service
 */
async function sendMessage({ communicationId, recipient, message, channel, metadata }) {
  try {
    const response = await axios.post(
      `${CHANNEL_SERVICE_URL}/send`,
      {
        communicationId,
        recipient,
        message,
        channel,
        metadata,
        callbackUrl: process.env.CRM_RECEIPTS_URL || 'http://localhost:3000/api/receipts',
      },
      { timeout: 10000 }
    );
    return response.data;
  } catch (err) {
    console.error(`Channel Service error for ${communicationId}:`, err.message);
    throw err;
  }
}

module.exports = { sendMessage };
