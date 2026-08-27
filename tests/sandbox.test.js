const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const request = require('supertest');

process.env.SANDBOX_API_KEY = 'sk_test_sandbox_cryptochain_2026';
process.env.CONFIRM_DELAY_MS = '40';
process.env.FAIL_RATE = '0';
process.env.PORT = '0';

const app = require('../sandbox');
const mockDb = require('../sandbox/data/mockDb');

const API_KEY = process.env.SANDBOX_API_KEY;

function auth(req) {
  return req.set('x-api-key', API_KEY);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startReceiver() {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      received.push({
        headers: req.headers,
        body: raw ? JSON.parse(raw) : null,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        received,
        url: `http://127.0.0.1:${port}/webhook`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

before(() => {
  process.env.SANDBOX_API_KEY = API_KEY;
  process.env.CONFIRM_DELAY_MS = '40';
  process.env.FAIL_RATE = '0';
});

beforeEach(() => {
  mockDb.reset();
});

test('health check does not require an API key', async () => {
  const res = await request(app).get('/sandbox/health').expect(200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
  assert.ok(res.body.timestamp);
});

test('rejects sandbox routes without an API key', async () => {
  const res = await request(app)
    .post('/sandbox/pay')
    .send({ amount: 1, currency: 'USDC', merchantId: 'mch_sandbox_001', orderId: 'x' })
    .expect(401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Unauthorized');
});

test('creates a payment with a fake txHash and pending status', async () => {
  const res = await auth(
    request(app).post('/sandbox/pay').send({
      amount: 25.5,
      currency: 'USDC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_1001',
    })
  ).expect(201);

  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Payment created');
  assert.equal(res.body.data.status, 'pending');
  assert.equal(res.body.data.amount, 25.5);
  assert.equal(res.body.data.currency, 'USDC');
  assert.equal(res.body.data.cryptocurrency, 'USDC');
  assert.equal(res.body.data.merchantId, 'mch_sandbox_001');
  assert.equal(res.body.data.orderId, 'ord_1001');
  assert.equal(res.body.data.confirmations, 0);
  assert.ok(res.body.data.txHash);
  assert.ok(res.body.data.txId);
  assert.equal(res.body.data.txHash, res.body.data.signature);
  assert.ok(res.body.data.metadata.merchantId);
  assert.ok(res.body.timestamp);
});

test('validates payment payload fields', async () => {
  const res = await auth(request(app).post('/sandbox/pay').send({ amount: 1 })).expect(400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Missing required fields/);
});

test('returns the existing payment for a repeated orderId', async () => {
  const payload = {
    amount: 10,
    currency: 'SOL',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_dup',
  };
  const first = await auth(request(app).post('/sandbox/pay').send(payload)).expect(201);
  const second = await auth(request(app).post('/sandbox/pay').send(payload)).expect(200);
  assert.equal(second.body.data.txId, first.body.data.txId);
  assert.equal(second.body.message, 'Existing payment returned for orderId');
});

test('status polling progresses pending → confirming → confirmed', async () => {
  const created = await auth(
    request(app).post('/sandbox/pay').send({
      amount: 1,
      currency: 'ETH',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_status',
    })
  ).expect(201);

  const txId = created.body.data.txId;
  assert.equal(created.body.data.status, 'pending');

  await sleep(50);
  const confirming = await auth(request(app).get(`/sandbox/status/${txId}`)).expect(200);
  assert.equal(confirming.body.data.status, 'confirming');
  assert.ok(confirming.body.data.confirmations >= 1);

  await sleep(50);
  const confirmed = await auth(request(app).get(`/sandbox/status/${txId}`)).expect(200);
  assert.equal(confirmed.body.data.status, 'confirmed');
  assert.equal(confirmed.body.data.confirmations, confirmed.body.data.requiredConfirmations);
  assert.ok(confirmed.body.data.confirmedAt);
});

test('status can be fetched by txHash', async () => {
  const created = await auth(
    request(app).post('/sandbox/pay').send({
      amount: 2,
      currency: 'BTC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_hash',
    })
  ).expect(201);

  const res = await auth(request(app).get(`/sandbox/status/${created.body.data.txHash}`)).expect(200);
  assert.equal(res.body.data.txId, created.body.data.txId);
});

test('merchant login and profile', async () => {
  const login = await auth(
    request(app).post('/sandbox/merchant/login').send({
      email: 'merchant@cryptochain.io',
      password: 'sandbox123',
    })
  ).expect(200);

  assert.equal(login.body.success, true);
  assert.ok(login.body.data.token.startsWith('sbx_'));
  assert.equal(login.body.data.merchant.id, 'mch_sandbox_001');
  assert.equal(login.body.data.merchant.email, 'merchant@cryptochain.io');
  assert.equal(login.body.data.merchant.password, undefined);

  const profile = await request(app)
    .get('/sandbox/merchant/profile')
    .set('Authorization', `Bearer ${login.body.data.token}`)
    .expect(200);

  assert.equal(profile.body.data.id, 'mch_sandbox_001');
  assert.ok(Array.isArray(profile.body.data.acceptedCryptocurrencies));
  assert.ok(profile.body.data.settings);
  assert.ok(profile.body.data.analytics);
});

test('merchant login rejects bad credentials', async () => {
  const res = await auth(
    request(app).post('/sandbox/merchant/login').send({
      email: 'merchant@cryptochain.io',
      password: 'wrong',
    })
  ).expect(401);
  assert.equal(res.body.success, false);
});

test('webhook simulate posts signed status to the merchant callback URL', async () => {
  const receiver = await startReceiver();
  try {
    const created = await auth(
      request(app).post('/sandbox/pay').send({
        amount: 9,
        currency: 'USDC',
        merchantId: 'mch_sandbox_001',
        orderId: 'ord_hook',
      })
    ).expect(201);

    const res = await auth(
      request(app).post('/sandbox/webhook/simulate').send({
        txId: created.body.data.txId,
        callbackUrl: receiver.url,
        status: 'confirmed',
      })
    ).expect(200);

    assert.equal(res.body.data.delivered, true);
    assert.equal(receiver.received.length, 1);
    const hook = receiver.received[0];
    assert.equal(hook.body.success, true);
    assert.equal(hook.body.event, 'payment.confirmed');
    assert.equal(hook.body.type, 'transaction_update');
    assert.equal(hook.body.data.txId, created.body.data.txId);
    assert.equal(hook.body.data.status, 'confirmed');
    assert.ok(hook.headers['x-cryptochain-signature']);
    assert.match(hook.headers['x-cryptochain-signature-256'], /^sha256=/);
  } finally {
    await receiver.close();
  }
});

test('lists all transactions for the dashboard', async () => {
  await auth(
    request(app).post('/sandbox/pay').send({
      amount: 1,
      currency: 'USDC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_list_1',
    })
  ).expect(201);
  await auth(
    request(app).post('/sandbox/pay').send({
      amount: 2,
      currency: 'SOL',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_list_2',
    })
  ).expect(201);

  const res = await auth(request(app).get('/sandbox/transactions')).expect(200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.length >= 2);
  assert.ok(res.body.data.every((tx) => tx.txId && tx.status && tx.orderId));
});
