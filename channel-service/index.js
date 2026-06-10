require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'xeno-channel-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/send', require('./routes/send'));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n📡 Xeno Channel Service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   CRM Receipts: ${process.env.CRM_RECEIPTS_URL || 'http://localhost:3000/api/receipts'}\n`);
});
