const express = require('express');
const mockDb = require('../data/mockDb');
const { success, failure } = require('../utils/response');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json(
      failure('Missing required fields: email, password', 'Login request is invalid')
    );
  }

  const merchant = mockDb.getMerchantByEmail(String(email).trim().toLowerCase()) || mockDb.getMerchantByEmail(email);
  if (!merchant || merchant.password !== password) {
    return res.status(401).json(failure('Invalid credentials', 'Email or password is incorrect'));
  }

  const session = mockDb.createSession(merchant.id);

  return res.status(200).json(
    success(
      {
        token: session.token,
        merchant: mockDb.publicMerchant(merchant),
      },
      'Login successful'
    )
  );
});

router.get('/profile', (req, res) => {
  const auth = req.headers.authorization || '';
  let merchant = null;

  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).startsWith('sbx_')) {
    const session = mockDb.getSession(auth.slice(7).trim());
    if (session) {
      merchant = mockDb.getMerchant(session.merchantId);
    }
  }

  if (!merchant) {
    const merchantId = req.query.merchantId || req.headers['x-merchant-id'] || mockDb.DEFAULT_MERCHANT.id;
    merchant = mockDb.getMerchant(merchantId);
  }

  if (!merchant) {
    return res.status(404).json(failure('Merchant not found', 'No merchant profile is available'));
  }

  return res.status(200).json(success(mockDb.publicMerchant(merchant), 'Merchant profile retrieved'));
});

module.exports = router;
