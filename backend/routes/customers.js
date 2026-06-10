const express = require('express');
const router = express.Router();
const db = require('../db');
const rfmService = require('../services/rfm');

/**
 * POST /api/customers
 * Ingest single customer or bulk array
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const customers = Array.isArray(body) ? body : [body];

    const results = [];
    for (const c of customers) {
      const { name, email, phone, city, tier, tags } = c;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const result = await db.query(
        `INSERT INTO customers (name, email, phone, city, tier, tags)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           name  = EXCLUDED.name,
           phone = EXCLUDED.phone,
           city  = EXCLUDED.city,
           tier  = COALESCE(EXCLUDED.tier, customers.tier),
           tags  = COALESCE(EXCLUDED.tags, customers.tags)
         RETURNING *`,
        [name, email || null, phone || null, city || null, tier || 'bronze', JSON.stringify(tags || [])]
      );
      results.push(result.rows[0]);
    }

    res.status(201).json(Array.isArray(body) ? results : results[0]);
  } catch (err) {
    console.error('POST /customers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers
 * List customers with optional filters + RFM labels
 * Query params: city, tier, segment_label, search, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      city, tier, segment_label, search,
      page = 1, limit = 50,
    } = req.query;

    const conditions = [];
    const params = [];
    let p = 1;

    if (city) {
      conditions.push(`c.city = $${p++}`);
      params.push(city);
    }
    if (tier) {
      conditions.push(`c.tier = $${p++}`);
      params.push(tier);
    }
    if (segment_label) {
      conditions.push(`r.segment_label = $${p++}`);
      params.push(segment_label);
    }
    if (search) {
      conditions.push(`(c.name ILIKE $${p} OR c.email ILIKE $${p})`);
      params.push(`%${search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRes, dataRes] = await Promise.all([
      db.query(`
        SELECT COUNT(*) FROM customers c
        LEFT JOIN customer_rfm r ON r.customer_id = c.id
        ${where}
      `, params),
      db.query(`
        SELECT
          c.*,
          r.recency_days,
          r.frequency,
          r.monetary,
          r.rfm_score,
          r.segment_label,
          r.r_score,
          r.f_score,
          r.m_score,
          r.updated_at as rfm_updated_at
        FROM customers c
        LEFT JOIN customer_rfm r ON r.customer_id = c.id
        ${where}
        ORDER BY c.created_at DESC
        LIMIT $${p} OFFSET $${p + 1}
      `, [...params, parseInt(limit), offset]),
    ]);

    res.json({
      customers: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('GET /customers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers/:id
 * Single customer with order history and RFM
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [customerRes, ordersRes] = await Promise.all([
      db.query(`
        SELECT
          c.*,
          r.recency_days,
          r.frequency,
          r.monetary,
          r.rfm_score,
          r.segment_label,
          r.r_score,
          r.f_score,
          r.m_score
        FROM customers c
        LEFT JOIN customer_rfm r ON r.customer_id = c.id
        WHERE c.id = $1
      `, [id]),
      db.query(`
        SELECT * FROM orders WHERE customer_id = $1
        ORDER BY ordered_at DESC LIMIT 20
      `, [id]),
    ]);

    if (!customerRes.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      customer: customerRes.rows[0],
      orders: ordersRes.rows,
    });
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
