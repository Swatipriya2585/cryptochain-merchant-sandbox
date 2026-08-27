const {
  generateTxId,
  generateTxHash,
  generateSessionToken,
  getNetwork,
  getRequiredConfirmations,
  confirmationsForStatus,
  getConfirmDelayMs,
} = require('../utils/crypto');

const DEFAULT_MERCHANT = {
  id: 'mch_sandbox_001',
  name: 'CryptoChain Demo Merchant',
  description: 'Sandbox merchant used to simulate CryptoChain payment flows',
  logo: null,
  website: 'https://cryptochain.io',
  email: 'merchant@cryptochain.io',
  password: 'sandbox123',
  walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  acceptedCryptocurrencies: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC'],
  settings: {
    autoConvert: false,
    conversionCurrency: 'USDC',
    minimumTransactionAmount: 0.001,
    maximumTransactionAmount: 100000,
    webhookUrl: null,
    notificationSettings: {
      email: true,
      push: false,
      sms: false,
      transactionAlerts: true,
      priceAlerts: false,
      recommendationAlerts: false,
    },
  },
  analytics: {
    totalTransactions: 0,
    totalVolume: 0,
    averageTransactionValue: 0,
    mostPopularCryptocurrency: 'SOL',
    conversionRate: 1,
    customerCount: 1,
    revenueByCryptocurrency: {},
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};

const store = {
  transactions: new Map(),
  merchants: new Map(),
  sessions: new Map(),
  timers: new Map(),
};

function seed() {
  store.merchants.set(DEFAULT_MERCHANT.id, { ...DEFAULT_MERCHANT, analytics: { ...DEFAULT_MERCHANT.analytics, revenueByCryptocurrency: {} } });
}

seed();

function nowIso() {
  return new Date().toISOString();
}

function publicMerchant(merchant) {
  if (!merchant) return null;
  const { password, ...safe } = merchant;
  return {
    ...safe,
    transactions: listTransactions({ merchantId: merchant.id }).slice(0, 10),
  };
}

function createPayment({ amount, currency, merchantId, orderId, callbackUrl, description, from }) {
  const merchant = store.merchants.get(merchantId) || store.merchants.get(DEFAULT_MERCHANT.id);
  const createdAt = nowIso();
  const network = getNetwork(currency);
  const requiredConfirmations = getRequiredConfirmations(currency);
  const txId = generateTxId();
  const txHash = generateTxHash(network);

  const tx = {
    id: txId,
    txId,
    txHash,
    signature: txHash,
    status: 'pending',
    amount: Number(amount),
    currency,
    cryptocurrency: currency,
    merchantId: merchant.id,
    orderId,
    from: from || 'sandbox:payer',
    to: merchant.walletAddress,
    fee: 0,
    confirmations: 0,
    requiredConfirmations,
    blockNumber: null,
    network,
    callbackUrl: callbackUrl || merchant.settings.webhookUrl || null,
    metadata: {
      merchantId: merchant.id,
      orderId,
      description: description || 'sandbox payment',
      category: 'merchant_payment',
    },
    createdAt,
    updatedAt: createdAt,
    confirmedAt: null,
    timestamp: createdAt,
  };

  store.transactions.set(txId, tx);
  store.transactions.set(txHash, tx);
  updateAnalytics(merchant.id, tx);
  return clone(tx);
}

function getTransaction(txId) {
  const tx = store.transactions.get(txId);
  return tx ? clone(tx) : null;
}

function updateTransaction(txId, patch) {
  const existing = store.transactions.get(txId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
    timestamp: nowIso(),
  };
  store.transactions.set(existing.txId, updated);
  store.transactions.set(existing.txHash, updated);
  return clone(updated);
}

function listTransactions({ merchantId } = {}) {
  const seen = new Set();
  const result = [];
  for (const tx of store.transactions.values()) {
    if (seen.has(tx.txId)) continue;
    seen.add(tx.txId);
    if (merchantId && tx.merchantId !== merchantId) continue;
    result.push(clone(tx));
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function findByOrderId(merchantId, orderId) {
  return listTransactions({ merchantId }).find((tx) => tx.orderId === orderId) || null;
}

function progressTransaction(txId) {
  const tx = store.transactions.get(txId);
  if (!tx || tx.status === 'confirmed' || tx.status === 'failed') {
    return tx ? clone(tx) : null;
  }

  const next = tx.status === 'pending' ? 'confirming' : 'confirmed';
  const required = tx.requiredConfirmations;
  const patch = {
    status: next,
    confirmations: confirmationsForStatus(next, required),
  };

  if (next === 'confirming') {
    patch.blockNumber = Math.floor(Date.now() / 1000);
  }

  if (next === 'confirmed') {
    patch.confirmedAt = nowIso();
    patch.blockNumber = patch.blockNumber || tx.blockNumber || Math.floor(Date.now() / 1000);
    patch.confirmations = required;
  }

  return updateTransaction(txId, patch);
}

function syncStatusFromElapsedTime(txId) {
  const tx = store.transactions.get(txId);
  if (!tx || tx.status === 'confirmed' || tx.status === 'failed') {
    return tx ? clone(tx) : null;
  }

  const delay = getConfirmDelayMs();
  const elapsed = Date.now() - new Date(tx.createdAt).getTime();

  if (delay === 0 || elapsed >= delay * 2) {
    if (tx.status !== 'confirmed') {
      updateTransaction(txId, {
        status: 'confirmed',
        confirmations: tx.requiredConfirmations,
        blockNumber: tx.blockNumber || Math.floor(Date.now() / 1000),
        confirmedAt: nowIso(),
      });
    }
  } else if (elapsed >= delay && tx.status === 'pending') {
    updateTransaction(txId, {
      status: 'confirming',
      confirmations: confirmationsForStatus('confirming', tx.requiredConfirmations),
      blockNumber: Math.floor(Date.now() / 1000),
    });
  }

  return getTransaction(txId);
}

function registerTimers(txId, timerIds) {
  const existing = store.timers.get(txId) || [];
  store.timers.set(txId, existing.concat(timerIds));
}

function clearTimers(txId) {
  const timers = store.timers.get(txId) || [];
  timers.forEach((id) => clearTimeout(id));
  store.timers.delete(txId);
}

function getMerchant(merchantId) {
  return store.merchants.get(merchantId) || null;
}

function getMerchantByEmail(email) {
  const needle = String(email || '').trim().toLowerCase();
  for (const merchant of store.merchants.values()) {
    if (String(merchant.email).toLowerCase() === needle) return merchant;
  }
  return null;
}

function createSession(merchantId) {
  const token = generateSessionToken();
  const session = {
    token,
    merchantId,
    createdAt: nowIso(),
  };
  store.sessions.set(token, session);
  return session;
}

function getSession(token) {
  return store.sessions.get(token) || null;
}

function updateAnalytics(merchantId, tx) {
  const merchant = store.merchants.get(merchantId);
  if (!merchant) return;
  const analytics = merchant.analytics;
  analytics.totalTransactions += 1;
  analytics.totalVolume += Number(tx.amount) || 0;
  analytics.averageTransactionValue = analytics.totalVolume / analytics.totalTransactions;
  analytics.revenueByCryptocurrency[tx.currency] =
    (analytics.revenueByCryptocurrency[tx.currency] || 0) + Number(tx.amount);
  analytics.mostPopularCryptocurrency = Object.entries(analytics.revenueByCryptocurrency).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function reset() {
  for (const timers of store.timers.values()) {
    timers.forEach((id) => clearTimeout(id));
  }
  store.transactions.clear();
  store.merchants.clear();
  store.sessions.clear();
  store.timers.clear();
  seed();
}

module.exports = {
  DEFAULT_MERCHANT,
  createPayment,
  getTransaction,
  updateTransaction,
  listTransactions,
  findByOrderId,
  progressTransaction,
  syncStatusFromElapsedTime,
  registerTimers,
  clearTimers,
  getMerchant,
  getMerchantByEmail,
  publicMerchant,
  createSession,
  getSession,
  reset,
};
