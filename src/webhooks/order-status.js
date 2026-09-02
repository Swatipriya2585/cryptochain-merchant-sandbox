'use strict';

const crypto = require('crypto');

const EVENT_NAME = 'order.status_update';

function buildOrderStatusPayload(order, { previousStatus } = {}) {
  return {
    event: EVENT_NAME,
    network: 'sepolia',
    chainId: 11155111,
    orderId: order.id,
    merchantOrderId: order.merchantOrderId,
    status: order.status,
    previousStatus: previousStatus || null,
    amountEth: order.amountEth,
    amountWei: order.amountWei,
    currency: order.currency,
    receiveAddress: order.receiveAddress,
    payerAddress: order.payerAddress || null,
    txHash: order.txHash || null,
    confirmations: order.confirmations,
    requiredConfirmations: order.requiredConfirmations,
    timestamp: new Date().toISOString(),
  };
}

function signPayload(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliverOrderStatus({ order, previousStatus, callbackUrl, webhookSecret, fetchImpl, timeoutMs = 8000 }) {
  const target = callbackUrl || order.callbackUrl;
  if (!target) {
    return { delivered: false, skipped: true, reason: 'No callbackUrl on order' };
  }

  const payload = buildOrderStatusPayload(order, { previousStatus });
  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhookSecret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = fetchImpl || fetch;

  try {
    const response = await doFetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoChain-Sandbox-Sepolia/1.0',
        'X-CryptoChain-Event': EVENT_NAME,
        'X-CryptoChain-Network': 'sepolia',
        'X-CryptoChain-Chain-Id': '11155111',
        'X-CryptoChain-Signature': signature,
        'X-CryptoChain-Signature-256': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    return {
      delivered: true,
      skipped: false,
      statusCode: response.status,
      payload,
      deliveredAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Webhook delivery timed out' : error.message;
    return {
      delivered: false,
      skipped: false,
      statusCode: null,
      error: message,
      payload,
      deliveredAt: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  EVENT_NAME,
  buildOrderStatusPayload,
  signPayload,
  deliverOrderStatus,
};
