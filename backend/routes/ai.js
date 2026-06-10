const express = require('express');
const router = express.Router();
const db = require('../db');
const gemini = require('../services/gemini');
const rfmService = require('../services/rfm');

/**
 * POST /ai/build-campaign
 * Natural language → campaign spec (segment + message + channel)
 */
router.post('/build-campaign', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const result = await gemini.buildCampaignFromNL(prompt);
    res.json(result);
  } catch (err) {
    console.error('POST /ai/build-campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /ai/suggest-segments
 * Proactive audience suggestions based on actual data
 */
router.post('/suggest-segments', async (req, res) => {
  try {
    const [rfmSummary, topCustomers] = await Promise.all([
      rfmService.getRFMSummary(),
      db.query(`
        SELECT
          c.name, c.city, c.tier,
          r.segment_label, r.monetary, r.recency_days, r.frequency
        FROM customers c
        JOIN customer_rfm r ON r.customer_id = c.id
        ORDER BY r.monetary DESC
        LIMIT 30
      `).then(r => r.rows),
    ]);

    const suggestions = await gemini.suggestSegments(rfmSummary, topCustomers);
    res.json(suggestions);
  } catch (err) {
    console.error('POST /ai/suggest-segments error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /ai/personalize
 * Personalize a message template for a specific customer
 */
router.post('/personalize', async (req, res) => {
  try {
    const { template, customer } = req.body;
    if (!template || !customer) {
      return res.status(400).json({ error: 'template and customer are required' });
    }

    const result = await gemini.personalizeMessage(template, customer);
    res.json(result);
  } catch (err) {
    console.error('POST /ai/personalize error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /ai/recommend-channel
 * Recommend the best channel for a customer
 */
router.post('/recommend-channel', async (req, res) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

    const result = await db.query(`
      SELECT c.*, r.monetary, r.recency_days, r.frequency, r.segment_label
      FROM customers c
      LEFT JOIN customer_rfm r ON r.customer_id = c.id
      WHERE c.id = $1
    `, [customer_id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found' });

    const recommendation = await gemini.recommendChannel(result.rows[0]);
    res.json(recommendation);
  } catch (err) {
    console.error('POST /ai/recommend-channel error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /ai/explain-performance
 * Campaign stats → plain English AI insights
 */
router.post('/explain-performance', async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ error: 'campaign_id is required' });

    const statsRes = await db.query(`
      SELECT
        camp.name, camp.channel, camp.created_at,
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN comm.delivered_at IS NOT NULL THEN 1 END)::INTEGER as delivered,
        COUNT(CASE WHEN comm.opened_at IS NOT NULL THEN 1 END)::INTEGER as opened,
        COUNT(CASE WHEN comm.clicked_at IS NOT NULL THEN 1 END)::INTEGER as clicked,
        COUNT(CASE WHEN comm.converted_at IS NOT NULL THEN 1 END)::INTEGER as converted,
        COUNT(CASE WHEN comm.status = 'failed' THEN 1 END)::INTEGER as failed
      FROM campaigns camp
      LEFT JOIN communications comm ON comm.campaign_id = camp.id
      WHERE camp.id = $1
      GROUP BY camp.id
    `, [campaign_id]);

    if (!statsRes.rows.length) return res.status(404).json({ error: 'Campaign not found' });

    const stats = statsRes.rows[0];
    const total = stats.total || 1;
    const enrichedStats = {
      ...stats,
      delivery_rate:   `${(stats.delivered / total * 100).toFixed(1)}%`,
      open_rate:       `${(stats.opened   / total * 100).toFixed(1)}%`,
      click_rate:      `${(stats.clicked  / total * 100).toFixed(1)}%`,
      conversion_rate: `${(stats.converted / total * 100).toFixed(1)}%`,
      failure_rate:    `${(stats.failed   / total * 100).toFixed(1)}%`,
    };

    const insights = await gemini.explainPerformance(enrichedStats);
    res.json({ stats: enrichedStats, insights });
  } catch (err) {
    console.error('POST /ai/explain-performance error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /ai/rfm-insights
 * RFM segment cards with AI-generated descriptions and actions
 */
router.get('/rfm-insights', async (req, res) => {
  try {
    const rfmSummary = await rfmService.getRFMSummary();
    const insights = await gemini.generateRFMInsights(rfmSummary);

    // Merge stats with insights
    const enriched = rfmSummary.map(seg => ({
      ...seg,
      insight: insights.segments?.[seg.segment_label]?.insight || '',
      action:  insights.segments?.[seg.segment_label]?.action  || '',
    }));

    res.json({ segments: enriched, top_priority: insights.top_priority });
  } catch (err) {
    console.error('GET /ai/rfm-insights error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
