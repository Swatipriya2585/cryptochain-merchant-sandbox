'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { openSandboxDb } = require('../db/sandbox');
const { buildOrderStatusPayload, signPayload } = require('../src/webhooks/order-status');

const RECEIVE = '0x000000000000000000000000000000000000dEaD';
const PAYER = '0x1111111111111111111111111111111111111111';
const TX_HASH = '0x' + 'ab'.repeat(32);

function createFakeChain(options = {}) {
  const txs = options.txs || new Map();
  return {
    async assertConnectedToSepolia() {
      return { chainId: 11155111, name: 'sepolia' };
    },
    async getBlockNumber() {
      return 42;
    },
    async verifyIncomingPayment({ txHash, to, minAmountWei }) {
      const tx = txs.get(txHash.toLowerCase());
      if (!tx) {
        const error = new Error('Transaction not found on Sepolia.');
        error.code = 'TX_NOT_FOUND';
        throw error;
      }
      if (tx.to.toLowerCase() !== to.toLowerCase()) {
        const error = new Error('recipient mismatch');
        error.code = 'RECIPIENT_MISMATCH';
        throw error;
      }
      if (BigInt(tx.valueWei) < BigInt(minAmountWei)) {
        const error = new Error('insufficient');
        error.code = 'INSUFFICIENT_VALUE';
        throw error;
      }
      return {
        network: 'sepolia',
        chainId: 11155111,
        txHash,
        from: tx.from,
        to: tx.to,
        valueWei: tx.valueWei,
        valueEth: tx.valueEth,
        blockNumber: tx.blockNumber,
        status: 1,
        confirmations: tx.confirmations,
      };
    },
  };
}

describe('sandbox payment API', () => {
  let db;
  let app;
  let config;

  before(() => {
    db = openSandboxDb(':memory:');
    config = {
      network: 'sepolia',
      chainId: 11155111,
      receiveAddress: RECEIVE,
      requiredConfirmations: 2,
      webhookSecret: 'whsec_test',
      allowedOrigins: [],
      apiKey: 'sk_sandbox_test',
    };
    const chain = createFakeChain({
      txs: new Map([
        [
          TX_HASH,
          {
            from: PAYER,
            to: RECEIVE,
            valueWei: '10000000000000000',
            valueEth: '0.01',
            blockNumber: 40,
            confirmations: 3,
          },
        ],
      ]),
    });
    app = createApp({ db, chain, config });
  });

  after(() => {
    db.close();
  });

  it('advertises testnet-only status on GET /', async () => {
    const res = await request(app).get('/').expect(200);
    assert.equal(res.body.network, 'sepolia');
    assert.equal(res.body.chainId, 11155111);
    assert.match(res.body.warning, /TESTNET ONLY/);
    assert.equal(res.headers['x-cryptochain-network'], 'sepolia');
  });

  it('reports sepolia health without a production database', async () => {
    const res = await request(app).get('/health').expect(200);
    assert.equal(res.body.data.network, 'sepolia');
    assert.equal(res.body.data.database, 'sqlite-sandbox');
    assert.equal(res.body.data.sandboxMode, true);
  });

  it('creates a sandbox order and observes a Sepolia tx hash', async () => {
    const created = await request(app)
      .post('/payments')
      .send({ orderId: 'store-1', amountEth: '0.01', callbackUrl: null })
      .expect(201);

    assert.equal(created.body.data.network, 'sepolia');
    assert.equal(created.body.data.chainId, 11155111);
    assert.equal(created.body.data.status, 'awaiting_payment');
    assert.ok(created.body.data.faucets.length > 0);

    const observed = await request(app)
      .post(`/payments/${created.body.data.id}/observe`)
      .send({ txHash: TX_HASH })
      .expect(200);

    assert.equal(observed.body.data.status, 'confirmed');
    assert.equal(observed.body.data.txHash, TX_HASH);
    assert.equal(observed.body.data.payerAddress, PAYER);
    assert.equal(observed.body.chain.chainId, 11155111);
  });

  it('returns the same order when orderId is reused', async () => {
    const first = await request(app)
      .post('/payments')
      .send({ orderId: 'store-dup', amountEth: '0.02' })
      .expect(201);
    const second = await request(app)
      .post('/payments')
      .send({ orderId: 'store-dup', amountEth: '0.02' })
      .expect(200);
    assert.equal(first.body.data.id, second.body.data.id);
  });

  it('builds a sepolia-only webhook payload', () => {
    const payload = buildOrderStatusPayload({
      id: 'ord_sep_test',
      merchantOrderId: 'store-1',
      status: 'confirmed',
      amountEth: '0.01',
      amountWei: '10000000000000000',
      currency: 'ETH',
      receiveAddress: RECEIVE,
      payerAddress: PAYER,
      txHash: TX_HASH,
      confirmations: 3,
      requiredConfirmations: 2,
    });
    assert.equal(payload.event, 'order.status_update');
    assert.equal(payload.network, 'sepolia');
    assert.equal(payload.chainId, 11155111);
    const signature = signPayload(JSON.stringify(payload), 'whsec_test');
    assert.equal(signature.length, 64);
  });
});
