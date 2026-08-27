const express = require('express');
const mockDb = require('../data/mockDb');
const { requireAuth } = require('../middleware/auth');
const { success, failure } = require('../utils/response');

const router = express.Router();

function loginPayload(merchant, session) {
  return {
    merchantId: merchant.id,
    apiKey: session.apiKey,
    name: merchant.name,
    businessName: merchant.businessName,
    sandboxMode: true,
  };
}

function profilePayload(merchant) {
  const txCount = mockDb
    .getAllTransactions()
    .filter((tx) => tx.merchantId === merchant.id).length;

  return {
    merchantId: merchant.id,
    name: merchant.name,
    businessName: merchant.businessName,
    balance: merchant.balance,
    txCount,
    sandboxMode: true,
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json(
      failure('Missing required fields: email, password', 'Login request is invalid')
    );
  }

  const merchant = mockDb.upsertSandboxMerchant({
    email: String(email).trim(),
    password: String(password),
  });
  const session = mockDb.createMerchantSession(merchant.id);

  return res.status(200).json(success(loginPayload(merchant, session), 'Login successful'));
});

router.get('/profile', requireAuth, (req, res) => {
  const merchant = mockDb.getMerchant(req.merchant.merchantId || req.merchant.id);
  if (!merchant) {
    return res.status(401).json(
      failure('Unauthorized', 'Invalid or missing merchant API key. Pass Authorization: Bearer <apiKey>.')
    );
  }

  return res.status(200).json(success(profilePayload(merchant), 'Merchant profile retrieved'));
});

module.exports = router;
