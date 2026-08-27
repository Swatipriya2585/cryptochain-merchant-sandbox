const express = require('express');
const mockDb = require('../data/mockDb');
const { signWebhookPayload } = require('../utils/crypto');
const { success, failure, paymentEnvelope } = require('../utils/response');

const router = express.Router();

function buildWebhookPayload(tx, event) {
  const statusEvent =
    event ||
    (tx.status === 'confirmed'
      ? 'payment.confirmed'
      : tx.status === 'confirming'
        ? 'payment.confirming'
        : 'payment.pending');

  return {
    success: true,
    event: statusEvent,
    type: 'transaction_update',
    data: paymentEnvelope(tx),
    message: 'Transaction status update',
    timestamp: new Date().toISOString(),
  };
}

async function deliverWebhook(callbackUrl, tx, event) {
  const payload = buildWebhookPayload(tx, event);
  const body = JSON.stringify(payload);
  const secret = process.env.SANDBOX_API_KEY || 'sandbox';
  const signature = signWebhookPayload(body, secret);

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

    const responseBody = await response.text();
    return {
      delivered: response.ok,
      statusCode: response.status,
      responseBody,
      payload,
    };
  } catch (error) {
    return {
      delivered: false,
      statusCode: null,
      error: error.name === 'AbortError' ? 'Webhook delivery timed out' : error.message,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

router.post('/webhook/simulate', async (req, res) => {
  const { txId, callbackUrl, webhookUrl, status, event } = req.body || {};
  const targetUrl = callbackUrl || webhookUrl;

  if (!txId || !targetUrl) {
    return res.status(400).json(
      failure('Missing required fields: txId, callbackUrl', 'Webhook simulation request is invalid')
    );
  }

  let tx = mockDb.getTransaction(txId);
  if (!tx) {
    return res.status(404).json(
      failure('Transaction not found', `No transaction exists for txId ${txId}`)
    );
  }

  tx = mockDb.syncStatusFromElapsedTime(tx.txId) || tx;

  if (status && ['pending', 'confirming', 'confirmed', 'failed'].includes(status) && status !== tx.status) {
    tx = mockDb.updateTransaction(tx.txId, {
      status,
      confirmations:
        status === 'confirmed' ? tx.requiredConfirmations : status === 'confirming' ? Math.max(1, tx.confirmations) : 0,
      confirmedAt: status === 'confirmed' ? new Date().toISOString() : tx.confirmedAt,
      blockNumber: status === 'pending' ? tx.blockNumber : tx.blockNumber || Math.floor(Date.now() / 1000),
    });
  }

  const delivery = await deliverWebhook(targetUrl, tx, event);

  if (!delivery.delivered) {
    return res.status(502).json(
      failure(delivery.error || `Webhook endpoint returned ${delivery.statusCode}`, 'Failed to deliver webhook', {
        data: {
          callbackUrl: targetUrl,
          txId: tx.txId,
          payload: delivery.payload,
          statusCode: delivery.statusCode,
        },
      })
    );
  }

  return res.status(200).json(
    success(
      {
        callbackUrl: targetUrl,
        txId: tx.txId,
        status: tx.status,
        delivered: true,
        statusCode: delivery.statusCode,
        payload: delivery.payload,
      },
      'Webhook delivered'
    )
  );
});

module.exports = router;
module.exports.deliverWebhook = deliverWebhook;
module.exports.buildWebhookPayload = buildWebhookPayload;
