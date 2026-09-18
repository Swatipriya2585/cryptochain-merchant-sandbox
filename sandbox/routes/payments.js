const express = require('express');
const mockDb = require('../data/mockDb');
const { success, failure, paymentEnvelope } = require('../utils/response');
const router = express.Router();

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

  const tx = mockDb.createTransaction({
    amount: numericAmount,
    currency: String(currency).toUpperCase(),
    merchantId,
    orderId: String(orderId),
    callbackUrl: callbackUrl || webhookUrl,
    description,
    from,
  });

  return res.status(201).json(success(paymentEnvelope(tx), 'Payment created'));
});

router.get('/status/:txId', (req, res) => {
  const { txId } = req.params;
  const tx = mockDb.getTransaction(txId);

  if (!tx) {
    return res.status(404).json(
      failure('Transaction not found', `No transaction exists for txId ${txId}`)
    );
  }

  return res.status(200).json(success(paymentEnvelope(tx), 'Transaction fetched successfully'));
});

router.get('/transactions', (req, res) => {
  const merchantId = req.query.merchantId;
  const transactions = mockDb
    .getAllTransactions()
    .filter((tx) => !merchantId || tx.merchantId === merchantId)
    .map(paymentEnvelope);

  return res.status(200).json(transactions);
});

module.exports = router;
