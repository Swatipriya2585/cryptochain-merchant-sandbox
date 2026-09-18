const express = require('express');
const mockDb = require('../data/mockDb');
const { requireAuth } = require('../middleware/auth');
const { success, failure } = require('../utils/response');

const router = express.Router();

function profilePayload(merchant) {
  const txCount = mockDb
    .getAllTransactions()
    .filter((tx) => tx.merchantId === merchant.id).length;

  return {
    merchantId: merchant.id,
    email: merchant.email,
    name: merchant.name,
    businessName: merchant.businessName,
    balance: merchant.balance,
    txCount,
    sandboxMode: true,
    walletAddress: merchant.walletAddress,
    walletAddresses: merchant.walletAddresses,
    wallets: {
      ethereum: { address: merchant.wallets.ethereum.address, publicKey: merchant.wallets.ethereum.publicKey, network: merchant.wallets.ethereum.network },
      solana: { address: merchant.wallets.solana.address, publicKey: merchant.wallets.solana.publicKey, network: merchant.wallets.solana.network },
      bitcoin: { address: merchant.wallets.bitcoin.address, publicKey: merchant.wallets.bitcoin.publicKey, network: merchant.wallets.bitcoin.network },
    },
    acceptedCryptocurrencies: merchant.acceptedCryptocurrencies,
    settings: merchant.settings,
    analytics: merchant.analytics,
  };
}

router.post('/login', (req, res) => {
  const { email, password, name, businessName } = req.body || {};

  if (!email || !password) {
    return res.status(400).json(
      failure('Missing required fields: email, password', 'Login request is invalid')
    );
  }

  const result = mockDb.loginSandboxMerchant({
    email: String(email).trim(),
    password: String(password),
    name,
    businessName,
  });

  if (result.error === 'invalid_credentials') {
    return res.status(401).json(
      failure('Invalid credentials', 'Email or password is incorrect')
    );
  }

  const session = mockDb.createMerchantSession(result.merchant.id);
  return res.status(200).json(
    success(
      { ...mockDb.credentialsView(result.merchant, session), created: result.created },
      result.created ? 'Demo merchant created' : 'Login successful'
    )
  );
});

router.get('/credentials', requireAuth, (req, res) => {
  const merchant = mockDb.getMerchant(req.merchant.merchantId || req.merchant.id);
  if (!merchant) {
    return res.status(401).json(
      failure('Unauthorized', 'Invalid or missing merchant API key. Pass Authorization: Bearer <apiKey>.')
    );
  }

  return res.status(200).json(
    success(mockDb.credentialsView(merchant, req.merchantSession), 'Merchant credentials retrieved')
  );
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

router.patch('/settings', requireAuth, (req, res) => {
  const merchant = mockDb.getMerchant(req.merchant.merchantId || req.merchant.id);
  if (!merchant) {
    return res.status(401).json(
      failure('Unauthorized', 'Invalid or missing merchant API key. Pass Authorization: Bearer <apiKey>.')
    );
  }

  const updated = mockDb.updateMerchantSettings(merchant.id, {
    webhookUrl: req.body && req.body.webhookUrl,
    name: req.body && req.body.name,
    businessName: req.body && req.body.businessName,
  });

  return res.status(200).json(success(profilePayload(updated), 'Merchant settings updated'));
});

module.exports = router;
