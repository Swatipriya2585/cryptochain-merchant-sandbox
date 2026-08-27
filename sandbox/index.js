const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { requestLogger } = require('./middleware/logger');
const { requireAuth, requireAdminKey, requireAuthOrAdmin } = require('./middleware/auth');
const paymentsRouter = require('./routes/payments');
const webhookRouter = require('./routes/webhook');
const merchantRouter = require('./routes/merchant');
const mockDb = require('./data/mockDb');

const PORT = Number(process.env.PORT) || 4000;
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://cryptochain.in',
  'https://www.cryptochain.in',
  'https://cryptochain.io',
  'https://www.cryptochain.io',
  'https://cryptochainai.io',
  'https://www.cryptochainai.io',
];

function parseAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

function isLocalhostOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

const allowedOrigins = parseAllowedOrigins();

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || isLocalhostOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-sandbox-api-key',
      'x-cryptochain-key',
      'x-sandbox-admin-key',
      'x-merchant-id',
    ],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', service: 'cryptochain-merchant-sandbox' },
    message: 'Sandbox is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/sandbox/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', service: 'cryptochain-merchant-sandbox', sandboxMode: true },
    message: 'Sandbox is running',
    status: 'ok',
    sandboxMode: true,
    timestamp: new Date().toISOString(),
  });
});

const dashboardFile = path.join(__dirname, 'public', 'dashboard.html');
const sandboxPageFile = path.join(__dirname, 'public', 'sandbox.html');
const noStore = { headers: { 'Cache-Control': 'no-store' } };

app.get(['/sandbox', '/sandbox/'], (_req, res) => {
  res.sendFile(sandboxPageFile, noStore);
});

app.get('/sandbox/console', (_req, res) => {
  res.redirect(302, '/sandbox#console');
});

app.get('/sandbox/config.js', (_req, res) => {
  const vite = process.env.VITE_SANDBOX_URL || '';
  const next = process.env.NEXT_PUBLIC_SANDBOX_URL || vite;
  res.type('application/javascript').send(
    `window.VITE_SANDBOX_URL = ${JSON.stringify(vite)};\n` +
      `window.NEXT_PUBLIC_SANDBOX_URL = ${JSON.stringify(next)};\n`
  );
});

app.get('/sandbox/dashboard', requireAdminKey, (_req, res) => {
  res.sendFile(dashboardFile, noStore);
});

app.delete('/sandbox/reset', requireAdminKey, (_req, res) => {
  mockDb.reset();
  res.json({ cleared: true });
});

app.use('/sandbox/merchant', merchantRouter);
app.use('/sandbox', requireAuthOrAdmin);
app.use('/sandbox', paymentsRouter);
app.use('/sandbox', webhookRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `No route for ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, _req, res, _next) => {
  const isCors = /not allowed by CORS/i.test(err.message || '');
  res.status(isCors ? 403 : 500).json({
    success: false,
    error: isCors ? 'CORS blocked' : 'Internal server error',
    message: err.message || 'Unexpected error',
    timestamp: new Date().toISOString(),
  });
});

if (require.main === module) {
  if (!process.env.SANDBOX_API_KEY) {
    process.env.SANDBOX_API_KEY = 'sk_test_sandbox_cryptochain_2026';
    console.warn('SANDBOX_API_KEY was not set; using the documented sandbox demo key');
  }
  if (!process.env.SANDBOX_ADMIN_KEY) {
    process.env.SANDBOX_ADMIN_KEY = 'sandbox_admin_dev_key';
    console.warn('SANDBOX_ADMIN_KEY was not set; using the documented sandbox admin key');
  }

  mockDb.startStateMachine();
  app.listen(PORT, () => {
    console.log(`CryptoChain merchant sandbox listening on http://localhost:${PORT}`);
    console.log(`Health:     GET  http://localhost:${PORT}/health`);
    console.log(`Sandbox:    GET  http://localhost:${PORT}/sandbox`);
    console.log(`Dashboard:  GET  http://localhost:${PORT}/sandbox/dashboard?key=${process.env.SANDBOX_ADMIN_KEY}`);
    console.log(`Pay:        POST http://localhost:${PORT}/sandbox/pay`);
    console.log(`State machine ticks every ${mockDb.STATE_MACHINE_INTERVAL_MS}ms`);
  });
}

module.exports = app;
