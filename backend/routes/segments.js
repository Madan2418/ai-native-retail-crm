const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Build SQL WHERE clause from filter_rules JSON
 * Supports: monetary, recency_days, frequency, city, tier, segment_label
 */
function buildFilterSQL(filterRules) {
  const { operator = 'AND', conditions = [] } = filterRules;
  const clauses = [];
  const params = [];
  let paramIndex = 1;

  const RFM_FIELDS = ['monetary', 'recency_days', 'frequency', 'r_score', 'f_score', 'm_score', 'rfm_score', 'segment_label'];
  const CUSTOMER_FIELDS = ['city', 'tier', 'name'];

  for (const cond of conditions) {
    const { field, op, value } = cond;

    const table = RFM_FIELDS.includes(field) ? 'r' : 'c';
    const col = `${table}.${field}`;

    if (op === 'gte') {
      clauses.push(`${col} >= $${paramIndex++}`);
      params.push(value);
    } else if (op === 'lte') {
      clauses.push(`${col} <= $${paramIndex++}`);
      params.push(value);
    } else if (op === 'gt') {
      clauses.push(`${col} > $${paramIndex++}`);
      params.push(value);
    } else if (op === 'lt') {
      clauses.push(`${col} < $${paramIndex++}`);
      params.push(value);
    } else if (op === 'eq') {
      clauses.push(`${col} = $${paramIndex++}`);
      params.push(value);
    } else if (op === 'in') {
      const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
      clauses.push(`${col} IN (${placeholders})`);
      params.push(...value);
    } else if (op === 'contains') {
      clauses.push(`${col} ILIKE $${paramIndex++}`);
      params.push(`%${value}%`);
    }
  }

  const where = clauses.length
    ? `WHERE ${clauses.join(` ${operator} `)}`
    : '';

  return { where, params };
}

/**
 * POST /api/segments
 * Create a segment with filter rules + compute customer count
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, filter_rules } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const rules = filter_rules || { operator: 'AND', conditions: [] };

    // Compute matching customer count
    const { where, params } = buildFilterSQL(rules);
    const countRes = await db.query(`
      SELECT COUNT(DISTINCT c.id)::INTEGER as count
      FROM customers c
      LEFT JOIN customer_rfm r ON r.customer_id = c.id
      ${where}
    `, params);

    const customer_count = countRes.rows[0].count;

    const result = await db.query(
      `INSERT INTO segments (name, description, filter_rules, customer_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, JSON.stringify(rules), customer_count]
    );

    const segment = result.rows[0];

    // Populate segment_customers table
    const customersRes = await db.query(`
      SELECT DISTINCT c.id
      FROM customers c
      LEFT JOIN customer_rfm r ON r.customer_id = c.id
      ${where}
    `, params);

    if (customersRes.rows.length > 0) {
      const insertVals = customersRes.rows
        .map(row => `('${segment.id}', '${row.id}')`)
        .join(', ');
      await db.query(`
        INSERT INTO segment_customers (segment_id, customer_id)
        VALUES ${insertVals}
        ON CONFLICT DO NOTHING
      `);
    }

    res.status(201).json({ ...segment, customer_count });
  } catch (err) {
    console.error('POST /segments error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/segments
 * List all segments
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, COUNT(sc.customer_id)::INTEGER as actual_count
      FROM segments s
      LEFT JOIN segment_customers sc ON sc.segment_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /segments error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/segments/:id
 * Get segment with customer list
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [segRes, customersRes] = await Promise.all([
      db.query('SELECT * FROM segments WHERE id = $1', [id]),
      db.query(`
        SELECT c.*, r.rfm_score, r.segment_label, r.monetary
        FROM segment_customers sc
        JOIN customers c ON c.id = sc.customer_id
        LEFT JOIN customer_rfm r ON r.customer_id = c.id
        WHERE sc.segment_id = $1
        LIMIT 100
      `, [id]),
    ]);

    if (!segRes.rows.length) return res.status(404).json({ error: 'Segment not found' });

    res.json({ segment: segRes.rows[0], customers: customersRes.rows });
  } catch (err) {
    console.error('GET /segments/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/segments/:id/preview
 * Live customer count for a filter_rules object (without saving)
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const segRes = await db.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (!segRes.rows.length) return res.status(404).json({ error: 'Segment not found' });

    const rules = segRes.rows[0].filter_rules;
    const { where, params } = buildFilterSQL(rules);

    const countRes = await db.query(`
      SELECT COUNT(DISTINCT c.id)::INTEGER as count
      FROM customers c
      LEFT JOIN customer_rfm r ON r.customer_id = c.id
      ${where}
    `, params);

    res.json({ count: countRes.rows[0].count });
  } catch (err) {
    console.error('GET /segments/:id/preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/segments/preview
 * Preview customer count for ad-hoc filter rules
 */
router.post('/preview', async (req, res) => {
  try {
    const { filter_rules } = req.body;
    const rules = filter_rules || { operator: 'AND', conditions: [] };
    const { where, params } = buildFilterSQL(rules);

    const countRes = await db.query(`
      SELECT COUNT(DISTINCT c.id)::INTEGER as count
      FROM customers c
      LEFT JOIN customer_rfm r ON r.customer_id = c.id
      ${where}
    `, params);

    res.json({ count: countRes.rows[0].count });
  } catch (err) {
    console.error('POST /segments/preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/segments/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM segments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.buildFilterSQL = buildFilterSQL;
