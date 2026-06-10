/**
 * BullMQ Queue Setup
 * Two queues: campaign-send-queue and receipt-process-queue
 */
require('dotenv').config();
const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const channelClient = require('./channelClient');
const db = require('../db');

// Redis connection
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  console.error('Redis error:', err.message);
});

// ============================================================
// QUEUES
// ============================================================
const campaignSendQueue = new Queue('campaign-send-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

const receiptProcessQueue = new Queue('receipt-process-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// ============================================================
// WORKERS
// ============================================================

/**
 * Campaign Send Worker — calls Channel Service for each recipient
 */
const campaignSendWorker = new Worker(
  'campaign-send-queue',
  async (job) => {
    const { communicationId, recipient, message, channel, metadata } = job.data;

    // Mark as sent in DB
    await db.query(
      `UPDATE communications SET status = 'sent', sent_at = now() WHERE id = $1`,
      [communicationId]
    );

    // Call Channel Service
    await channelClient.sendMessage({
      communicationId,
      recipient,
      message,
      channel,
      metadata,
    });

    console.log(`📤 Sent ${channel} to ${recipient.name} [${communicationId}]`);
  },
  {
    connection,
    concurrency: 10,
  }
);

/**
 * Receipt Process Worker — idempotently updates communication state
 */
const receiptProcessWorker = new Worker(
  'receipt-process-queue',
  async (job) => {
    const { communicationId, event, timestamp, eventId } = job.data;

    // Idempotency check via Redis
    const key = `receipt:processed:${eventId}`;
    const already = await connection.get(key);
    if (already) {
      console.log(`⏭️  Skipping duplicate receipt: ${eventId}`);
      return;
    }

    // Map event to column
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

    // Mark idempotency key (24h TTL)
    await connection.set(key, '1', 'EX', 86400);

    console.log(`📥 Receipt: ${event} for ${communicationId}`);
  },
  {
    connection,
    concurrency: 20,
  }
);

// Worker error handlers
campaignSendWorker.on('failed', (job, err) => {
  console.error(`❌ Campaign send job ${job?.id} failed:`, err.message);
});

receiptProcessWorker.on('failed', (job, err) => {
  console.error(`❌ Receipt process job ${job?.id} failed:`, err.message);
});

// ============================================================
// EXPORTS
// ============================================================

/**
 * Enqueue a single communication to be sent
 */
async function enqueueCommunication(data) {
  await campaignSendQueue.add(`send-${data.communicationId}`, data, {
    delay: Math.floor(Math.random() * 500), // slight stagger
  });
}

/**
 * Enqueue a receipt callback for processing
 */
async function enqueueReceipt(data) {
  await receiptProcessQueue.add(`receipt-${data.eventId}`, data);
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const [sendCounts, receiptCounts] = await Promise.all([
    campaignSendQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    receiptProcessQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
  ]);

  return {
    campaignSendQueue: sendCounts,
    receiptProcessQueue: receiptCounts,
  };
}

module.exports = {
  campaignSendQueue,
  receiptProcessQueue,
  enqueueCommunication,
  enqueueReceipt,
  getQueueStats,
  connection,
};
