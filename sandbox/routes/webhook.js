const express = require('express');
const mockDb = require('../data/mockDb');
const { signWebhookPayload } = require('../utils/crypto');

const router = express.Router();

function buildWebhookPayload(tx) {
  return {
    event: 'payment.status_update',
    txId: tx.txId,
    txHash: tx.txHash,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    timestamp: new Date().toISOString(),
  };
}

async function deliverWebhook(callbackUrl, tx) {
  const payload = buildWebhookPayload(tx);
  const body = JSON.stringify(payload);
  const secret = process.env.SANDBOX_API_KEY || 'sandbox';
  const signature = signWebhookPayload(body, secret);
  const deliveredAt = new Date().toISOString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoChain-Sandbox/1.0',
        'X-CryptoChain-Event': payload.event,
        'X-CryptoChain-Signature': signature,
        'X-CryptoChain-Signature-256': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    return {
      delivered: true,
      deliveredAt,
      statusCode: response.status,
      payload,
    };
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Webhook delivery timed out' : error.message;
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'webhook_delivery_failed',
        timestamp: new Date().toISOString(),
        txId: tx.txId,
        callbackUrl,
        error: message,
      })
    );
    return {
      delivered: false,
      deliveredAt: null,
      statusCode: null,
      error: message,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

mockDb.onStatusChange((tx) => {
  if (!tx.callbackUrl) return;
  deliverWebhook(tx.callbackUrl, tx).catch((error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'webhook_delivery_failed',
        timestamp: new Date().toISOString(),
        txId: tx.txId,
        callbackUrl: tx.callbackUrl,
        error: error.message,
      })
    );
  });
});

router.post('/webhook/simulate', async (req, res) => {
  const { txId, callbackUrl } = req.body || {};

  if (!txId || !callbackUrl) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: txId, callbackUrl',
    });
  }

  const tx = mockDb.getTransaction(txId);
  if (!tx) {
    return res.status(404).json({
      success: false,
      error: `Transaction not found: ${txId}`,
    });
  }

  const delivery = await deliverWebhook(callbackUrl, tx);

  if (!delivery.delivered) {
    return res.status(502).json({
      success: false,
      error: delivery.error || 'Callback URL is unreachable',
    });
  }

  return res.status(200).json({
    success: true,
    deliveredAt: delivery.deliveredAt,
  });
});

module.exports = router;
module.exports.deliverWebhook = deliverWebhook;
module.exports.buildWebhookPayload = buildWebhookPayload;
