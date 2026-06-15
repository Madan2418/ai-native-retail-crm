const express = require('express');
const router = express.Router();
const db = require('../db');
const { enqueueCommunication } = require('../services/queue');
const gemini = require('../services/gemini');

/**
 * POST /api/campaigns
 * Create and optionally launch a campaign
 */
router.post('/', async (req, res) => {
  try {
    const { name, segment_id, channel, message_template, launch = false, scheduled_at } = req.body;

    if (!name || !segment_id || !channel || !message_template) {
      return res.status(400).json({
        error: 'name, segment_id, channel, and message_template are required',
      });
    }

    // Create campaign
    const campRes = await db.query(
      `INSERT INTO campaigns (name, segment_id, channel, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, segment_id, channel, 'draft', scheduled_at || null]
    );
    const campaign = campRes.rows[0];

    // Create variant A
    const varRes = await db.query(
      `INSERT INTO campaign_variants (campaign_id, variant_label, message_template)
       VALUES ($1, 'A', $2)
       RETURNING *`,
      [campaign.id, message_template]
    );
    const variant = varRes.rows[0];

    if (launch) {
      // Get segment customers
      const customersRes = await db.query(`
        SELECT
          c.id, c.name, c.email, c.phone, c.city, c.tier,
          r.monetary, r.recency_days, r.frequency, r.segment_label,
          (SELECT product_name FROM orders WHERE customer_id = c.id ORDER BY ordered_at DESC LIMIT 1) as last_product
        FROM segment_customers sc
        JOIN customers c ON c.id = sc.customer_id
        LEFT JOIN customer_rfm r ON r.customer_id = c.id
        WHERE sc.segment_id = $1
      `, [segment_id]);

      const customers = customersRes.rows;

      if (!customers.length) {
        return res.status(400).json({ error: 'Segment has no customers' });
      }

      // Mark campaign as running
      await db.query(
        `UPDATE campaigns SET status = 'running' WHERE id = $1`,
        [campaign.id]
      );

      // Create all communication records first (synchronous)
      const commsData = [];
      for (const customer of customers) {
        const commRes = await db.query(
          `INSERT INTO communications
             (campaign_id, variant_id, customer_id, channel, personalized_message, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING id`,
          [campaign.id, variant.id, customer.id, channel, message_template]
        );
        commsData.push({ communicationId: commRes.rows[0].id, customer });
      }

      await db.query(
        `UPDATE campaign_variants SET recipient_count = $1 WHERE id = $2`,
        [commsData.length, variant.id]
      );

      // Launch in batches (non-blocking — API responds immediately)
      const commonArgs = { template: message_template, channel, variantId: variant.id, campaignId: campaign.id };
      setImmediate(() =>
        launchCampaignInBatches(
          commsData.map(d => ({ ...d.customer, _commId: d.communicationId })),
          commonArgs
        ).catch(console.error)
      );

      return res.status(201).json({
        campaign: { ...campaign, status: 'running' },
        variant,
        recipients: commsData.length,
        message: `Campaign launched to ${commsData.length} recipients`,
      });
    }

    res.status(201).json({ campaign, variant });
  } catch (err) {
    console.error('POST /campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Background: personalize message then enqueue for sending
 * Falls back to raw template if Gemini is unavailable/rate-limited
 */
async function enqueuePersonalizeAndSend({ communicationId, customer, template, channel, variantId, campaignId }) {
  try {
    // Try Gemini personalization
    const { message } = await gemini.personalizeMessage(template, {
      name: customer.name,
      city: customer.city,
      last_product: customer.last_product,
      last_order_days_ago: customer.recency_days,
      total_spent: customer.monetary,
      tier: customer.tier,
    });

    await db.query(
      `UPDATE communications SET personalized_message = $1 WHERE id = $2`,
      [message, communicationId]
    );

    await enqueueCommunication({
      communicationId,
      recipient: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
      message,
      channel,
      metadata: { campaignId, variantId },
    });
  } catch (err) {
    // Graceful fallback: use template with basic name substitution
    const fallbackMsg = template.replace(/\{name\}/g, customer.name);
    console.warn(`[Campaign] Gemini unavailable for ${communicationId} — using template fallback`);
    await enqueueCommunication({
      communicationId,
      recipient: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
      message: fallbackMsg,
      channel,
      metadata: { campaignId, variantId },
    });
  }
}

/**
 * Staggered launch: process in batches of 5 with 12s gap
 * Keeps Gemini calls within 5 RPM free-tier limit
 */
async function launchCampaignInBatches(customers, commonArgs) {
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 13000; // 13s → safe margin for 5 RPM

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(customer =>
      enqueuePersonalizeAndSend({
        ...commonArgs,
        communicationId: customer._commId,
        customer,
      })
    ));
    if (i + BATCH_SIZE < customers.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}


/**
 * GET /api/campaigns
 * List all campaigns with basic stats
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        camp.*,
        s.name as segment_name,
        COUNT(DISTINCT comm.id)::INTEGER as total_recipients,
        COUNT(DISTINCT CASE WHEN comm.status = 'sent' THEN comm.id END)::INTEGER as sent,
        COUNT(DISTINCT CASE WHEN comm.delivered_at IS NOT NULL THEN comm.id END)::INTEGER as delivered,
        COUNT(DISTINCT CASE WHEN comm.opened_at IS NOT NULL THEN comm.id END)::INTEGER as opened,
        COUNT(DISTINCT CASE WHEN comm.clicked_at IS NOT NULL THEN comm.id END)::INTEGER as clicked,
        COUNT(DISTINCT CASE WHEN comm.status = 'failed' THEN comm.id END)::INTEGER as failed
      FROM campaigns camp
      LEFT JOIN segments s ON s.id = camp.segment_id
      LEFT JOIN communications comm ON comm.campaign_id = camp.id
      GROUP BY camp.id, s.name
      ORDER BY camp.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/campaigns/:id/stats
 * Full funnel stats for a campaign
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [campRes, statsRes, variantsRes, timelineRes] = await Promise.all([
      db.query(`
        SELECT camp.*, s.name as segment_name, s.filter_rules
        FROM campaigns camp
        LEFT JOIN segments s ON s.id = camp.segment_id
        WHERE camp.id = $1
      `, [id]),

      db.query(`
        SELECT
          COUNT(*)::INTEGER as total,
          COUNT(CASE WHEN status IN ('sent', 'delivered', 'opened', 'read', 'clicked', 'converted') THEN 1 END)::INTEGER as sent,
          COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END)::INTEGER as delivered,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::INTEGER as opened,
          COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::INTEGER as read,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::INTEGER as clicked,
          COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END)::INTEGER as converted,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as failed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending
        FROM communications
        WHERE campaign_id = $1
      `, [id]),

      db.query(`
        SELECT cv.*, COUNT(comm.id)::INTEGER as recipient_count
        FROM campaign_variants cv
        LEFT JOIN communications comm ON comm.variant_id = cv.id
        WHERE cv.campaign_id = $1
        GROUP BY cv.id
      `, [id]),

      // Delivery timeline (last 24h buckets)
      db.query(`
        SELECT
          date_trunc('hour', sent_at) as hour,
          COUNT(*)::INTEGER as sent_count,
          COUNT(delivered_at)::INTEGER as delivered_count
        FROM communications
        WHERE campaign_id = $1 AND sent_at > now() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour
      `, [id]),
    ]);

    if (!campRes.rows.length) return res.status(404).json({ error: 'Campaign not found' });

    const stats = statsRes.rows[0];
    const total = stats.total || 1;

    res.json({
      campaign: campRes.rows[0],
      funnel: {
        ...stats,
        delivery_rate:   (stats.delivered / total * 100).toFixed(1),
        open_rate:       (stats.opened   / total * 100).toFixed(1),
        click_rate:      (stats.clicked  / total * 100).toFixed(1),
        conversion_rate: (stats.converted / total * 100).toFixed(1),
        failure_rate:    (stats.failed   / total * 100).toFixed(1),
      },
      variants: variantsRes.rows,
      timeline: timelineRes.rows,
    });
  } catch (err) {
    console.error('GET /campaigns/:id/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/campaigns/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
