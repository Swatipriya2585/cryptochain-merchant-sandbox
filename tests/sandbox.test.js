const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const request = require('supertest');

process.env.SANDBOX_API_KEY = 'sk_test_sandbox_cryptochain_2026';
process.env.SANDBOX_ADMIN_KEY = 'sandbox_admin_test_key';
process.env.CONFIRM_DELAY_MS = '40';
process.env.FAIL_RATE = '0';
process.env.PORT = '0';

const app = require('../sandbox');
const mockDb = require('../sandbox/data/mockDb');

const API_KEY = process.env.SANDBOX_API_KEY;
const ADMIN_KEY = process.env.SANDBOX_ADMIN_KEY;

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
  const login = await request(app)
    .post('/sandbox/merchant/login')
    .send({
      email: 'merchant@sandbox.test',
      password: 'sandbox123',
    })
    .expect(200);

  assert.equal(login.body.success, true);
  assert.equal(login.body.data.merchantId, 'mch_sandbox_001');
  assert.equal(login.body.data.email, 'merchant@sandbox.test');
  assert.equal(login.body.data.password, 'sandbox123');
  assert.equal(login.body.data.name, 'Sandbox Merchant');
  assert.equal(login.body.data.businessName, 'Sandbox Test Store');
  assert.equal(login.body.data.sandboxMode, true);
  assert.equal(login.body.data.walletAddress, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  assert.equal(
    login.body.data.wallets.ethereum.privateKey,
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  );
  assert.match(login.body.data.wallets.ethereum.publicKey, /^0x04/);
  assert.ok(login.body.data.wallets.solana.address);
  assert.ok(login.body.data.wallets.solana.privateKey);
  assert.ok(login.body.data.wallets.bitcoin.address);
  assert.ok(login.body.data.wallets.bitcoin.privateKey);
  assert.ok(login.body.data.apiKey);
  assert.match(login.body.data.warning, /Sandbox demo keys only/i);

  const profile = await request(app)
    .get('/sandbox/merchant/profile')
    .set('Authorization', `Bearer ${login.body.data.apiKey}`)
    .expect(200);

  assert.equal(profile.body.data.merchantId, 'mch_sandbox_001');
  assert.equal(profile.body.data.name, 'Sandbox Merchant');
  assert.equal(profile.body.data.businessName, 'Sandbox Test Store');
  assert.equal(profile.body.data.sandboxMode, true);
  assert.equal(profile.body.data.walletAddress, login.body.data.walletAddress);
  assert.equal(typeof profile.body.data.balance, 'number');
  assert.equal(typeof profile.body.data.txCount, 'number');
  assert.equal(profile.body.data.wallets.ethereum.privateKey, undefined);

  const credentials = await request(app)
    .get('/sandbox/merchant/credentials')
    .set('Authorization', `Bearer ${login.body.data.apiKey}`)
    .expect(200);
  assert.equal(credentials.body.data.password, 'sandbox123');
  assert.equal(
    credentials.body.data.wallets.ethereum.privateKey,
    login.body.data.wallets.ethereum.privateKey
  );
});

test('merchant login accepts any non-empty sandbox credentials', async () => {
  const login = await request(app)
    .post('/sandbox/merchant/login')
    .send({
      email: 'anyone@example.com',
      password: 'anything',
    })
    .expect(200);

  assert.equal(login.body.success, true);
  assert.equal(login.body.data.sandboxMode, true);
  assert.ok(login.body.data.merchantId);
  assert.ok(login.body.data.apiKey);
  assert.ok(login.body.data.name);
  assert.ok(login.body.data.businessName);
});

test('merchant login rejects the wrong password for an existing merchant', async () => {
  const res = await request(app)
    .post('/sandbox/merchant/login')
    .send({ email: 'merchant@sandbox.test', password: 'nope' })
    .expect(401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Invalid credentials');
});

test('new merchant login issues unique wallet keys', async () => {
  const login = await request(app)
    .post('/sandbox/merchant/login')
    .send({
      email: 'new-merchant@example.com',
      password: 'demo-pass-1',
      businessName: 'New Demo Store',
    })
    .expect(200);

  assert.equal(login.body.data.created, true);
  assert.equal(login.body.data.email, 'new-merchant@example.com');
  assert.equal(login.body.data.password, 'demo-pass-1');
  assert.equal(login.body.data.businessName, 'New Demo Store');
  assert.match(login.body.data.merchantId, /^mch_/);
  assert.notEqual(login.body.data.merchantId, 'mch_sandbox_001');
  assert.notEqual(
    login.body.data.wallets.ethereum.address,
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  );
  assert.match(login.body.data.wallets.ethereum.address, /^0x[0-9a-fA-F]{40}$/);
  assert.match(login.body.data.wallets.ethereum.privateKey, /^0x[0-9a-f]{64}$/);

  const again = await request(app)
    .post('/sandbox/merchant/login')
    .send({ email: 'new-merchant@example.com', password: 'demo-pass-1' })
    .expect(200);
  assert.equal(again.body.data.created, false);
  assert.equal(again.body.data.wallets.ethereum.address, login.body.data.wallets.ethereum.address);
  assert.equal(again.body.data.wallets.solana.privateKey, login.body.data.wallets.solana.privateKey);
});

test('demo payment is sent to the logged-in merchant wallet', async () => {
  const login = await request(app)
    .post('/sandbox/merchant/login')
    .send({ email: 'payer@example.com', password: 'wallet-demo' })
    .expect(200);

  const eth = await request(app)
    .post('/sandbox/pay')
    .set('Authorization', `Bearer ${login.body.data.apiKey}`)
    .send({
      amount: 1.25,
      currency: 'ETH',
      merchantId: login.body.data.merchantId,
      orderId: 'ord_wallet_eth',
    })
    .expect(201);
  assert.equal(eth.body.data.to, login.body.data.wallets.ethereum.address);

  const sol = await request(app)
    .post('/sandbox/pay')
    .set('Authorization', `Bearer ${login.body.data.apiKey}`)
    .send({
      amount: 2,
      currency: 'USDC',
      merchantId: login.body.data.merchantId,
      orderId: 'ord_wallet_sol',
    })
    .expect(201);
  assert.equal(sol.body.data.to, login.body.data.wallets.solana.address);
});

test('merchant login rejects empty credentials', async () => {
  const res = await request(app).post('/sandbox/merchant/login').send({ email: '', password: '' }).expect(400);
  assert.equal(res.body.success, false);
});

test('merchant profile requires a Bearer session', async () => {
  const res = await request(app).get('/sandbox/merchant/profile').expect(401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Unauthorized');
});

test('webhook simulate posts payment.status_update to the callback URL', async () => {
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
      })
    ).expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.deliveredAt);
    assert.equal(receiver.received.length, 1);
    const hook = receiver.received[0];
    assert.equal(hook.body.event, 'payment.status_update');
    assert.equal(hook.body.txId, created.body.data.txId);
    assert.equal(hook.body.txHash, created.body.data.txHash);
    assert.equal(hook.body.status, created.body.data.status);
    assert.equal(hook.body.amount, 9);
    assert.equal(hook.body.currency, 'USDC');
    assert.ok(hook.body.timestamp);
  } finally {
    await receiver.close();
  }
});

test('webhook simulate returns success false when callbackUrl is unreachable', async () => {
  const created = await auth(
    request(app).post('/sandbox/pay').send({
      amount: 3,
      currency: 'USDC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_unreachable',
    })
  ).expect(201);

  const res = await auth(
    request(app).post('/sandbox/webhook/simulate').send({
      txId: created.body.data.txId,
      callbackUrl: 'http://127.0.0.1:1/webhook',
    })
  ).expect(502);

  assert.equal(res.body.success, false);
  assert.ok(res.body.error);
});

test('state machine auto-delivers webhooks when callbackUrl is stored', async () => {
  const receiver = await startReceiver();
  try {
    const created = await auth(
      request(app).post('/sandbox/pay').send({
        amount: 5,
        currency: 'ETH',
        merchantId: 'mch_sandbox_001',
        orderId: 'ord_auto_hook',
        callbackUrl: receiver.url,
      })
    ).expect(201);
    assert.equal(created.body.data.callbackUrl, receiver.url);

    await sleep(50);
    await auth(request(app).get(`/sandbox/status/${created.body.data.txId}`)).expect(200);
    await sleep(40);

    assert.ok(receiver.received.length >= 1);
    const hook = receiver.received[0];
    assert.equal(hook.body.event, 'payment.status_update');
    assert.equal(hook.body.txId, created.body.data.txId);
    assert.ok(['confirming', 'confirmed'].includes(hook.body.status));
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
  assert.equal(Array.isArray(res.body), true);
  assert.ok(res.body.length >= 2);
  assert.ok(res.body.every((tx) => tx.txId && tx.status && tx.orderId));
});

test('dashboard requires the sandbox admin key', async () => {
  const denied = await request(app).get('/sandbox/dashboard').expect(401);
  assert.match(denied.text, /Unauthorized/i);

  const wrong = await request(app).get('/sandbox/dashboard').query({ key: 'nope' }).expect(401);
  assert.match(wrong.text, /Unauthorized/i);

  const ok = await request(app).get('/sandbox/dashboard').query({ key: ADMIN_KEY }).expect(200);
  assert.match(ok.headers['content-type'], /html/);
  assert.match(ok.text, /Sandbox Dashboard/);
  assert.match(ok.text, /Reset All/);
  assert.match(ok.text, /count-pending/);
});

test('admin key lists transactions and resets mockDb', async () => {
  await auth(
    request(app).post('/sandbox/pay').send({
      amount: 9,
      currency: 'USDC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_reset_1',
    })
  ).expect(201);

  const listed = await request(app).get('/sandbox/transactions').query({ key: ADMIN_KEY }).expect(200);
  assert.equal(Array.isArray(listed.body), true);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0].orderId, 'ord_reset_1');

  const denied = await request(app).delete('/sandbox/reset').expect(401);
  assert.equal(denied.body.success, false);

  const reset = await request(app).delete('/sandbox/reset').query({ key: ADMIN_KEY }).expect(200);
  assert.deepEqual(reset.body, { cleared: true });

  const emptied = await request(app).get('/sandbox/transactions').query({ key: ADMIN_KEY }).expect(200);
  assert.deepEqual(emptied.body, []);

  await auth(
    request(app).post('/sandbox/pay').send({
      amount: 3,
      currency: 'USDC',
      merchantId: 'mch_sandbox_001',
      orderId: 'ord_after_reset',
    })
  ).expect(201);
});

test('public sandbox product page is connected for merchant testing', async () => {
  const res = await request(app).get('/sandbox').expect(200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /Sandbox Console/);
  assert.match(res.text, /Create Payment/);
  assert.match(res.text, /mch_sandbox_001/);
  assert.match(res.text, /merchant@sandbox.test/);
  assert.match(res.text, /\/sandbox\/pay/);
  assert.match(res.text, /Login \/ create demo merchant/);
  assert.match(res.text, /Credentials/);
  assert.match(res.text, /private key/i);
});

test('sandbox console redirect does not require an API key', async () => {
  const res = await request(app).get('/sandbox/console').expect(302);
  assert.equal(res.headers.location, '/sandbox#console');
});

