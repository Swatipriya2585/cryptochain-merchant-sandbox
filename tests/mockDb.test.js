const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.SANDBOX_API_KEY = 'sk_test_sandbox_cryptochain_2026';
process.env.CONFIRM_DELAY_MS = '40';
process.env.FAIL_RATE = '0';

const mockDb = require('../sandbox/data/mockDb');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mockDb.reset();
});

test('createTransaction starts pending with the core store fields', () => {
  const tx = mockDb.createTransaction({
    amount: 12.5,
    currency: 'USDC',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_sm_1',
  });

  assert.equal(tx.status, 'pending');
  assert.equal(tx.amount, 12.5);
  assert.equal(tx.currency, 'USDC');
  assert.equal(tx.merchantId, 'mch_sandbox_001');
  assert.equal(tx.orderId, 'ord_sm_1');
  assert.ok(tx.txId);
  assert.ok(tx.txHash);
  assert.ok(tx.createdAt);
  assert.ok(tx.updatedAt);
  assert.equal(tx._willFail, undefined);
});

test('getTransaction returns the tx or null', () => {
  const created = mockDb.createTransaction({
    amount: 1,
    currency: 'SOL',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_get',
  });
  assert.equal(mockDb.getTransaction(created.txId).txHash, created.txHash);
  assert.equal(mockDb.getTransaction(created.txHash).txId, created.txId);
  assert.equal(mockDb.getTransaction('missing'), null);
});

test('updateTransactionStatus enforces pending → confirming → confirmed', () => {
  const created = mockDb.createTransaction({
    amount: 3,
    currency: 'ETH',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_status_machine',
  });

  const skipped = mockDb.updateTransactionStatus(created.txId, 'confirmed');
  assert.equal(skipped.status, 'pending');

  const confirming = mockDb.updateTransactionStatus(created.txId, 'confirming');
  assert.equal(confirming.status, 'confirming');
  assert.ok(confirming.updatedAt >= created.updatedAt);

  const back = mockDb.updateTransactionStatus(created.txId, 'pending');
  assert.equal(back.status, 'confirming');

  const confirmed = mockDb.updateTransactionStatus(created.txId, 'confirmed');
  assert.equal(confirmed.status, 'confirmed');
  assert.ok(confirmed.confirmedAt);
});

test('getAllTransactions returns every tx for the dashboard', () => {
  mockDb.createTransaction({
    amount: 1,
    currency: 'USDC',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_a',
  });
  mockDb.createTransaction({
    amount: 2,
    currency: 'SOL',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_b',
  });
  const all = mockDb.getAllTransactions();
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((tx) => tx.orderId).sort(), ['ord_a', 'ord_b']);
});

test('marked-fail transactions become failed after 2x CONFIRM_DELAY_MS', async () => {
  const created = mockDb.createTransaction({
    amount: 8,
    currency: 'USDC',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_fail',
    fail: true,
  });
  assert.equal(created.status, 'pending');

  await sleep(50);
  const confirming = mockDb.getTransaction(created.txId);
  assert.equal(confirming.status, 'confirming');

  await sleep(50);
  const failed = mockDb.getTransaction(created.txId);
  assert.equal(failed.status, 'failed');
  assert.ok(failed.failedAt);
});

test('tickStateMachine auto-progresses due transactions in the background', () => {
  const statuses = [];
  const off = mockDb.onStatusChange((tx) => statuses.push(tx.status));
  const created = mockDb.createTransaction({
    amount: 4,
    currency: 'BTC',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_interval',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    fail: false,
  });
  assert.equal(created.status, 'pending');
  mockDb.tickStateMachine();
  off();
  assert.ok(statuses.includes('confirmed'), statuses.join(','));
});

test('createMerchant generates unique demo wallets', () => {
  const merchant = mockDb.createMerchant({
    email: 'wallets@example.com',
    password: 'secret',
  });
  assert.match(merchant.wallets.ethereum.address, /^0x[0-9a-fA-F]{40}$/);
  assert.notEqual(merchant.walletAddress, mockDb.DEFAULT_MERCHANT.walletAddress);
  const tx = mockDb.createTransaction({
    amount: 1,
    currency: 'ETH',
    merchantId: merchant.id,
    orderId: 'ord_wallet_to',
  });
  assert.equal(tx.to, merchant.wallets.ethereum.address);
});

test('createTransaction stores optional callbackUrl', () => {
  const tx = mockDb.createTransaction({
    amount: 1,
    currency: 'USDC',
    merchantId: 'mch_sandbox_001',
    orderId: 'ord_cb',
    callbackUrl: 'https://merchant.example/webhooks/cryptochain',
  });
  assert.equal(tx.callbackUrl, 'https://merchant.example/webhooks/cryptochain');
  assert.equal(tx.status, 'pending');
});
