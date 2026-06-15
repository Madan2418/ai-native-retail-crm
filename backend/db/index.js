const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; rejectUnauthorized: false allows self-signed certs
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Test connection on startup (non-blocking)
pool.query('SELECT 1').then(() => {
  console.log('[DB] PostgreSQL connected');
}).catch((err) => {
  console.error('[DB] Connection failed:', err.message);
  console.error('[DB] Check DATABASE_URL in .env — use Supabase Session Pooler URL:');
  console.error('[DB]   postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres');
});

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
