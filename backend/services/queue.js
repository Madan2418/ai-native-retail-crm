/**
 * Queue Service — BullMQ with graceful Redis degradation.
 * If Redis is unavailable, jobs are dispatched synchronously (inline).
 */
require('dotenv').config();
const channelClient = require('./channelClient');
const db = require('../db');

let campaignSendQueue = null;
let receiptProcessQueue = null;
let connection = null;
let redisAvailable = false;

// ── Attempt Redis / BullMQ setup ─────────────────────────────
try {
  const { Queue, Worker } = require('bullmq');
  const IORedis = require('ioredis');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl.includes('[YOUR-UPSTASH-HOST]')) {
    throw new Error('REDIS_URL not configured');
  }

  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 500, 2000);
    },
  });

  connection.on('error', (err) => {
    if (redisAvailable) console.warn('[Queue] Redis disconnected:', err.message);
    redisAvailable = false;
  });

  connection.on('connect', () => {
    console.log('[Queue] Redis connected');
    redisAvailable = true;
  });

  campaignSendQueue = new Queue('campaign-send-queue', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  receiptProcessQueue = new Queue('receipt-process-queue', {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  // Campaign Send Worker
  const campaignSendWorker = new Worker(
    'campaign-send-queue',
    async (job) => {
      const { communicationId, recipient, message, channel, metadata } = job.data;
      await db.query(
        `UPDATE communications SET status = 'sent', sent_at = now() WHERE id = $1`,
        [communicationId]
      );
      await channelClient.sendMessage({ communicationId, recipient, message, channel, metadata });
      console.log(`[Queue] Sent ${channel} to ${recipient.name} [${communicationId}]`);
    },
    { connection, concurrency: 10 }
  );

  // Receipt Process Worker
  const receiptProcessWorker = new Worker(
    'receipt-process-queue',
    async (job) => {
      const { communicationId, event, timestamp, eventId } = job.data;
      await processReceipt({ communicationId, event, timestamp, eventId });
    },
    { connection, concurrency: 20 }
  );

  campaignSendWorker.on('failed', (job, err) => {
    console.error(`[Queue] Campaign send job ${job?.id} failed:`, err.message);
  });
  receiptProcessWorker.on('failed', (job, err) => {
    console.error(`[Queue] Receipt job ${job?.id} failed:`, err.message);
  });

  // Attempt connection (non-blocking)
  connection.connect().then(() => { redisAvailable = true; }).catch(() => {
    console.warn('[Queue] Redis not reachable — running in direct-dispatch mode');
  });

} catch (err) {
  console.warn('[Queue] Redis/BullMQ skipped:', err.message, '— running in direct-dispatch mode');
}

// ── Shared receipt processing logic ─────────────────────────
async function processReceipt({ communicationId, event, timestamp, eventId }) {
  // Idempotency via Redis (if available) or skip silently
  if (connection && redisAvailable) {
    const key = `receipt:processed:${eventId}`;
    const already = await connection.get(key).catch(() => null);
    if (already) return;
    await connection.set(key, '1', 'EX', 86400).catch(() => {});
  }

  const columnMap = {
    delivered:  'delivered_at',
    opened:     'opened_at',
    read:       'read_at',
    clicked:    'clicked_at',
    converted:  'converted_at',
  };

  if (event === 'failed') {
    await db.query(
      `UPDATE communications SET status = 'failed' WHERE id = $1`,
      [communicationId]
    );
  } else if (columnMap[event]) {
    const col = columnMap[event];
    await db.query(
      `UPDATE communications SET ${col} = $1, status = $2 WHERE id = $3`,
      [timestamp || new Date().toISOString(), event, communicationId]
    );
  }
  console.log(`[Receipt] ${event} for ${communicationId}`);
}

// ── Shared inline send logic ─────────────────────────────────
async function inlineSend({ communicationId, recipient, message, channel, metadata }) {
  await db.query(
    `UPDATE communications SET status = 'sent', sent_at = now() WHERE id = $1`,
    [communicationId]
  );
  await channelClient.sendMessage({ communicationId, recipient, message, channel, metadata });
  console.log(`[Direct] Sent ${channel} to ${recipient.name} [${communicationId}]`);
}

// ── Public API ───────────────────────────────────────────────

async function enqueueCommunication(data) {
  if (campaignSendQueue && redisAvailable) {
    try {
      await campaignSendQueue.add(`send-${data.communicationId}`, data, {
        delay: Math.floor(Math.random() * 500),
      });
      return;
    } catch (err) {
      console.warn('[Queue] Enqueue failed, falling back to direct:', err.message);
    }
  }
  // Fallback: run inline (fire and forget)
  setImmediate(() => inlineSend(data).catch(console.error));
}

async function enqueueReceipt(data) {
  if (receiptProcessQueue && redisAvailable) {
    try {
      await receiptProcessQueue.add(`receipt-${data.eventId}`, data);
      return;
    } catch (err) {
      console.warn('[Queue] Receipt enqueue failed, processing inline:', err.message);
    }
  }
  setImmediate(() => processReceipt(data).catch(console.error));
}

async function getQueueStats() {
  if (!campaignSendQueue || !redisAvailable) {
    return { mode: 'direct-dispatch', redis: 'unavailable' };
  }
  const [sendCounts, receiptCounts] = await Promise.all([
    campaignSendQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    receiptProcessQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
  ]);
  return { campaignSendQueue: sendCounts, receiptProcessQueue: receiptCounts };
}

module.exports = {
  campaignSendQueue,
  receiptProcessQueue,
  enqueueCommunication,
  enqueueReceipt,
  getQueueStats,
  connection,
};
