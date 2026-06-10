const express = require('express');
const router = express.Router();
const db = require('../db');
const rfmService = require('../services/rfm');

/**
 * POST /api/orders
 * Ingest single or bulk orders, triggers RFM recalculation
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const orders = Array.isArray(body) ? body : [body];

    const results = [];
    const customerIdsToUpdate = new Set();

    for (const o of orders) {
      const { customer_id, amount, product_category, product_name, ordered_at } = o;
      if (!customer_id || !amount) {
        return res.status(400).json({ error: 'customer_id and amount are required' });
      }

      const result = await db.query(
        `INSERT INTO orders (customer_id, amount, product_category, product_name, ordered_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [customer_id, amount, product_category || null, product_name || null, ordered_at || new Date().toISOString()]
      );
      results.push(result.rows[0]);
      customerIdsToUpdate.add(customer_id);
    }

    // Async RFM update (don't block response)
    Promise.all(
      Array.from(customerIdsToUpdate).map(id =>
        rfmService.computeAndStoreRFMForCustomer(id).catch(console.error)
      )
    );

    res.status(201).json(Array.isArray(body) ? results : results[0]);
  } catch (err) {
    console.error('POST /orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders
 * List orders with optional customer filter
 */
router.get('/', async (req, res) => {
  try {
    const { customer_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = customer_id ? 'WHERE o.customer_id = $3' : '';
    const params = customer_id
      ? [parseInt(limit), offset, customer_id]
      : [parseInt(limit), offset];

    const result = await db.query(`
      SELECT
        o.*,
        c.name as customer_name,
        c.email as customer_email
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ${conditions}
      ORDER BY o.ordered_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('GET /orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
