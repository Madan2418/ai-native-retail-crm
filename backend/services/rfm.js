/**
 * RFM Segmentation Engine
 * Scores all customers 1-5 on Recency, Frequency, Monetary
 * and assigns a human-readable segment label.
 */
const db = require('../db');

/**
 * Score a single recency value (days since last order)
 */
function scoreRecency(days) {
  if (days <= 7)  return 5;
  if (days <= 30) return 4;
  if (days <= 60) return 3;
  if (days <= 90) return 2;
  return 1;
}

/**
 * Score frequency (number of orders)
 */
function scoreFrequency(count) {
  if (count >= 10) return 5;
  if (count >= 6)  return 4;
  if (count >= 3)  return 3;
  if (count === 2) return 2;
  return 1;
}

/**
 * Score monetary value (total spend in ₹)
 */
function scoreMonetary(amount) {
  if (amount >= 20000) return 5;
  if (amount >= 10000) return 4;
  if (amount >= 5000)  return 3;
  if (amount >= 2000)  return 2;
  return 1;
}

/**
 * Assign a human-readable segment label based on R/F/M scores
 */
function getSegmentLabel(r, f, m) {
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (f >= 4 && m >= 3)           return 'Loyal';
  if (r >= 4 && f <= 3)           return 'Potential Loyalists';
  if (r >= 2 && r <= 3 && f >= 3 && m >= 3) return 'At Risk';
  if (r <= 2 && f >= 4 && m >= 4) return 'Cannot Lose';
  if (r <= 2 && f <= 2)           return 'Hibernating';
  return 'Lost';
}

/**
 * Compute composite RFM score (1-5 weighted average)
 */
function compositeScore(r, f, m) {
  return Math.round((r * 0.4 + f * 0.3 + m * 0.3));
}

/**
 * Compute and store RFM for ALL customers
 */
async function computeAndStoreAllRFM() {
  const result = await db.query(`
    SELECT
      c.id,
      COALESCE(
        EXTRACT(DAY FROM (now() - MAX(o.ordered_at)))::INTEGER,
        999
      ) AS recency_days,
      COUNT(o.id)::INTEGER AS frequency,
      COALESCE(SUM(o.amount), 0)::NUMERIC AS monetary
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
  `);

  const updates = result.rows.map((row) => {
    const r = scoreRecency(row.recency_days);
    const f = scoreFrequency(row.frequency);
    const m = scoreMonetary(Number(row.monetary));
    const rfm = compositeScore(r, f, m);
    const label = getSegmentLabel(r, f, m);

    return db.query(`
      INSERT INTO customer_rfm
        (customer_id, recency_days, frequency, monetary, r_score, f_score, m_score, rfm_score, segment_label, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (customer_id) DO UPDATE SET
        recency_days  = EXCLUDED.recency_days,
        frequency     = EXCLUDED.frequency,
        monetary      = EXCLUDED.monetary,
        r_score       = EXCLUDED.r_score,
        f_score       = EXCLUDED.f_score,
        m_score       = EXCLUDED.m_score,
        rfm_score     = EXCLUDED.rfm_score,
        segment_label = EXCLUDED.segment_label,
        updated_at    = now()
    `, [
      row.id,
      row.recency_days,
      row.frequency,
      row.monetary,
      r, f, m, rfm, label
    ]);
  });

  await Promise.all(updates);
  return result.rows.length;
}

/**
 * Compute and store RFM for a single customer
 */
async function computeAndStoreRFMForCustomer(customerId) {
  const result = await db.query(`
    SELECT
      COALESCE(
        EXTRACT(DAY FROM (now() - MAX(ordered_at)))::INTEGER,
        999
      ) AS recency_days,
      COUNT(id)::INTEGER AS frequency,
      COALESCE(SUM(amount), 0)::NUMERIC AS monetary
    FROM orders
    WHERE customer_id = $1
  `, [customerId]);

  const row = result.rows[0];
  const r = scoreRecency(row.recency_days);
  const f = scoreFrequency(row.frequency);
  const m = scoreMonetary(Number(row.monetary));
  const rfm = compositeScore(r, f, m);
  const label = getSegmentLabel(r, f, m);

  await db.query(`
    INSERT INTO customer_rfm
      (customer_id, recency_days, frequency, monetary, r_score, f_score, m_score, rfm_score, segment_label, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
    ON CONFLICT (customer_id) DO UPDATE SET
      recency_days  = EXCLUDED.recency_days,
      frequency     = EXCLUDED.frequency,
      monetary      = EXCLUDED.monetary,
      r_score       = EXCLUDED.r_score,
      f_score       = EXCLUDED.f_score,
      m_score       = EXCLUDED.m_score,
      rfm_score     = EXCLUDED.rfm_score,
      segment_label = EXCLUDED.segment_label,
      updated_at    = now()
  `, [customerId, row.recency_days, row.frequency, row.monetary, r, f, m, rfm, label]);

  return { r, f, m, rfm, label };
}

/**
 * Get RFM distribution summary (for dashboard)
 */
async function getRFMSummary() {
  const result = await db.query(`
    SELECT
      segment_label,
      COUNT(*)::INTEGER as count,
      ROUND(AVG(monetary), 2) as avg_monetary,
      ROUND(AVG(recency_days), 0) as avg_recency_days,
      ROUND(AVG(frequency), 1) as avg_frequency
    FROM customer_rfm
    GROUP BY segment_label
    ORDER BY count DESC
  `);
  return result.rows;
}

module.exports = {
  computeAndStoreAllRFM,
  computeAndStoreRFMForCustomer,
  getRFMSummary,
  scoreRecency,
  scoreFrequency,
  scoreMonetary,
  getSegmentLabel,
};
