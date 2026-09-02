'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { deliverOrderStatus, EVENT_NAME } = require('../src/webhooks/order-status');

describe('order-status webhooks', () => {
  it('POSTs a signed sepolia payload to the merchant callback', async () => {
    const calls = [];
    const result = await deliverOrderStatus({
      order: {
        id: 'ord_sep_1',
        merchantOrderId: 'store-1',
        status: 'confirmed',
        amountEth: '0.01',
        amountWei: '10000000000000000',
        currency: 'ETH',
        receiveAddress: '0x000000000000000000000000000000000000dEaD',
        payerAddress: '0x1111111111111111111111111111111111111111',
        txHash: '0x' + 'ab'.repeat(32),
        confirmations: 3,
        requiredConfirmations: 2,
        callbackUrl: 'http://127.0.0.1:9/hooks',
      },
      webhookSecret: 'whsec_test',
      async fetchImpl(url, options) {
        calls.push({ url, options });
        return { status: 204 };
      },
    });

    assert.equal(result.delivered, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers['X-CryptoChain-Network'], 'sepolia');
    assert.equal(calls[0].options.headers['X-CryptoChain-Chain-Id'], '11155111');
    assert.equal(calls[0].options.headers['X-CryptoChain-Event'], EVENT_NAME);
    const payload = JSON.parse(calls[0].options.body);
    assert.equal(payload.network, 'sepolia');
    assert.equal(payload.chainId, 11155111);
    assert.match(calls[0].options.headers['X-CryptoChain-Signature-256'], /^sha256=[0-9a-f]{64}$/);
  });

  it('skips delivery when no callback URL is present', async () => {
    const result = await deliverOrderStatus({
      order: { callbackUrl: null, status: 'pending' },
      webhookSecret: 'whsec_test',
      async fetchImpl() {
        throw new Error('should not fetch');
      },
    });
    assert.equal(result.skipped, true);
  });
});
