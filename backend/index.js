require('dotenv').config(); // trigger-restart-backend
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Support Vercel multi-service route prefix stripping dynamically
app.use((req, res, next) => {
  if (req.url.startsWith('/_/backend')) {
    req.url = req.url.slice('/_/backend'.length) || '/';
  }
  next();
});

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'xeno-crm-backend', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/customers', require('./routes/customers'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/segments',  require('./routes/segments'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/receipts',  require('./routes/receipts'));
app.use('/api/rfm',       require('./routes/rfm'));
app.use('/ai',            require('./routes/ai'));

// ── Queue workers (import to start them) ───────────────────
require('./services/queue');

// ── Scheduled RFM job (every 24h) ──────────────────────────
const rfmService = require('./services/rfm');
const RFM_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => {
  console.log('⏰ Scheduled RFM recalculation...');
  rfmService.computeAndStoreAllRFM()
    .then(count => console.log(`✅ RFM updated for ${count} customers`))
    .catch(err => console.error('Scheduled RFM error:', err));
}, RFM_INTERVAL_MS);

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Xeno CRM Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});
