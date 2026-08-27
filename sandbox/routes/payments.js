const express = require('express');
const mockDb = require('../data/mockDb');
const { getConfirmDelayMs } = require('../utils/crypto');
const { success, failure, paymentEnvelope } = require('../utils/response');
const { deliverWebhook } = require('./webhook');

const router = express.Router();

function scheduleConfirmation(tx) {
  const delay = getConfirmDelayMs();
  const txId = tx.txId;

  const confirmingTimer = setTimeout(async () => {
    const current = mockDb.getTransaction(txId);
    if (!current || current.status !== 'pending') return;
    const updated = mockDb.progressTransaction(txId);
    if (updated?.callbackUrl) {
      await deliverWebhook(updated.callbackUrl, updated, 'payment.confirming');
    }
  }, delay);

  const confirmedTimer = setTimeout(async () => {
    const current = mockDb.getTransaction(txId);
    if (!current || current.status === 'confirmed' || current.status === 'failed') return;
    if (current.status === 'pending') {
      mockDb.progressTransaction(txId);
    }
    const updated = mockDb.progressTransaction(txId);
    if (updated?.callbackUrl) {
      await deliverWebhook(updated.callbackUrl, updated, 'payment.confirmed');
    }
  }, delay * 2);

  mockDb.registerTimers(txId, [confirmingTimer, confirmedTimer]);
}

router.post('/pay', (req, res) => {
  const { amount, currency, merchantId, orderId, callbackUrl, webhookUrl, description, from } = req.body || {};

  if (amount === undefined || amount === null || currency === undefined || !merchantId || !orderId) {
    return res.status(400).json(
      failure(
        'Missing required fields: amount, currency, merchantId, orderId',
        'Payment request is invalid'
      )
    );
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json(failure('Invalid amount', 'Amount must be a number greater than 0'));
  }

  const merchant = mockDb.getMerchant(merchantId);
  if (!merchant) {
    return res.status(404).json(
      failure('Merchant not found', `No merchant exists for merchantId ${merchantId}`)
    );
  }

  const existing = mockDb.findByOrderId(merchantId, String(orderId));
  if (existing) {
    return res.status(200).json(
      success(paymentEnvelope(existing), 'Existing payment returned for orderId')
    );
  }

  const tx = mockDb.createPayment({
    amount: numericAmount,
    currency: String(currency).toUpperCase(),
    merchantId,
    orderId: String(orderId),
    callbackUrl: callbackUrl || webhookUrl,
    description,
    from,
  });

  scheduleConfirmation(tx);

  return res.status(201).json(success(paymentEnvelope(tx), 'Payment created'));
});

router.get('/status/:txId', (req, res) => {
  const { txId } = req.params;
  let tx = mockDb.getTransaction(txId);

  if (!tx) {
    return res.status(404).json(
      failure('Transaction not found', `No transaction exists for txId ${txId}`)
    );
  }

  tx = mockDb.syncStatusFromElapsedTime(tx.txId) || tx;

  return res.status(200).json(success(paymentEnvelope(tx), 'Transaction fetched successfully'));
});

module.exports = router;
module.exports.scheduleConfirmation = scheduleConfirmation;
