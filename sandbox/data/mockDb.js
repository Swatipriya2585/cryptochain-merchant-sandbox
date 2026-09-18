const {
  generateTxId,
  generateTxHash,
  generateSessionToken,
  generateApiKey,
  getNetwork,
  getRequiredConfirmations,
  confirmationsForStatus,
  getConfirmDelayMs,
  getFailRate,
} = require('../utils/crypto');
const {
  createDemoWallets,
  generateMerchantWallets,
  primaryWalletAddress,
  SANDBOX_KEY_WARNING,
} = require('../utils/wallets');

const DEMO_WALLETS = createDemoWallets();

const DEFAULT_MERCHANT = {
  id: 'mch_sandbox_001',
  merchantId: 'mch_sandbox_001',
  name: 'Sandbox Merchant',
  businessName: 'Sandbox Test Store',
  description: 'Sandbox merchant used to simulate CryptoChain payment flows',
  logo: null,
  website: 'https://cryptochain.io',
  email: 'merchant@sandbox.test',
  password: 'sandbox123',
  balance: 12500.75,
  sandboxMode: true,
  wallets: DEMO_WALLETS,
  walletAddress: DEMO_WALLETS.ethereum.address,
  walletAddresses: {
    ethereum: DEMO_WALLETS.ethereum.address,
    solana: DEMO_WALLETS.solana.address,
    bitcoin: DEMO_WALLETS.bitcoin.address,
  },
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

const TERMINAL_STATUSES = new Set(['confirmed', 'failed']);
const ALLOWED_TRANSITIONS = {
  pending: new Set(['confirming', 'failed']),
  confirming: new Set(['confirmed', 'failed']),
  confirmed: new Set(),
  failed: new Set(),
};

const STATE_MACHINE_INTERVAL_MS = 2000;

const store = {
  transactions: new Map(),
  merchants: new Map(),
  sessions: new Map(),
  merchantSessions: new Map(),
};

const statusListeners = [];
let stateMachineTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function seed() {
  store.merchants.set(DEFAULT_MERCHANT.id, {
    ...DEFAULT_MERCHANT,
    analytics: { ...DEFAULT_MERCHANT.analytics, revenueByCryptocurrency: {} },
  });

  const staticKey = process.env.SANDBOX_API_KEY || 'sk_test_sandbox_cryptochain_2026';
  store.merchantSessions.set(staticKey, {
    apiKey: staticKey,
    merchantId: DEFAULT_MERCHANT.id,
    createdAt: nowIso(),
  });
}

seed();

function clonePublic(tx) {
  if (!tx) return null;
  const { _willFail, ...rest } = tx;
  return JSON.parse(JSON.stringify(rest));
}

function saveTransaction(tx) {
  store.transactions.set(tx.txId, tx);
  store.transactions.set(tx.txHash, tx);
}

function uniqueTransactions() {
  const seen = new Set();
  const result = [];
  for (const tx of store.transactions.values()) {
    if (seen.has(tx.txId)) continue;
    seen.add(tx.txId);
    result.push(tx);
  }
  return result;
}

function patchForStatus(tx, newStatus) {
  const required = tx.requiredConfirmations;
  const patch = {
    status: newStatus,
    confirmations: confirmationsForStatus(newStatus, required),
  };

  if (newStatus === 'confirming') {
    patch.blockNumber = tx.blockNumber || Math.floor(Date.now() / 1000);
  }

  if (newStatus === 'confirmed') {
    patch.confirmedAt = nowIso();
    patch.blockNumber = tx.blockNumber || Math.floor(Date.now() / 1000);
    patch.confirmations = required;
  }

  if (newStatus === 'failed') {
    patch.failedAt = nowIso();
  }

  return patch;
}

function dueStatus(tx, now = Date.now()) {
  if (TERMINAL_STATUSES.has(tx.status)) return tx.status;

  const delay = getConfirmDelayMs();
  const elapsed = now - new Date(tx.createdAt).getTime();

  if (elapsed >= delay * 2) {
    return tx._willFail ? 'failed' : 'confirmed';
  }
  if (elapsed >= delay) {
    return 'confirming';
  }
  return 'pending';
}

function advanceToDueStatus(txId) {
  const tx = store.transactions.get(txId);
  if (!tx) return null;
  if (TERMINAL_STATUSES.has(tx.status)) return clonePublic(tx);

  const target = dueStatus(tx);
  if (target === tx.status) return clonePublic(tx);

  if (tx.status === 'pending' && target !== 'pending') {
    updateTransactionStatus(tx.txId, 'confirming');
  }

  const current = store.transactions.get(txId);
  if (current && (target === 'confirmed' || target === 'failed') && current.status === 'confirming') {
    return updateTransactionStatus(current.txId, target);
  }

  return clonePublic(store.transactions.get(txId));
}

function applyDueTransitions(txId) {
  return advanceToDueStatus(txId);
}

function notifyStatusChange(tx, previousStatus) {
  if (previousStatus === tx.status) return;
  for (const listener of statusListeners) {
    try {
      listener(clonePublic(tx), previousStatus);
    } catch (error) {
      console.error('Transaction status listener failed:', error.message);
    }
  }
}

function tickStateMachine() {
  for (const tx of uniqueTransactions()) {
    if (TERMINAL_STATUSES.has(tx.status)) continue;
    advanceToDueStatus(tx.txId);
  }
}

function startStateMachine() {
  if (stateMachineTimer) return;
  stateMachineTimer = setInterval(tickStateMachine, STATE_MACHINE_INTERVAL_MS);
  if (typeof stateMachineTimer.unref === 'function') {
    stateMachineTimer.unref();
  }
}

function stopStateMachine() {
  if (!stateMachineTimer) return;
  clearInterval(stateMachineTimer);
  stateMachineTimer = null;
}

function onStatusChange(listener) {
  statusListeners.push(listener);
  return () => {
    const index = statusListeners.indexOf(listener);
    if (index >= 0) statusListeners.splice(index, 1);
  };
}

function publicWallets(wallets) {
  if (!wallets) return null;
  const out = {};
  for (const [chain, wallet] of Object.entries(wallets)) {
    out[chain] = {
      network: wallet.network,
      chain: wallet.chain,
      address: wallet.address,
      publicKey: wallet.publicKey,
    };
  }
  return out;
}

function credentialsView(merchant, session) {
  if (!merchant) return null;
  return {
    merchantId: merchant.id,
    email: merchant.email,
    password: merchant.password,
    apiKey: session && session.apiKey,
    name: merchant.name,
    businessName: merchant.businessName,
    sandboxMode: true,
    walletAddress: merchant.walletAddress,
    walletAddresses: merchant.walletAddresses,
    wallets: merchant.wallets,
    acceptedCryptocurrencies: merchant.acceptedCryptocurrencies,
    warning: SANDBOX_KEY_WARNING,
  };
}

function publicMerchant(merchant) {
  if (!merchant) return null;
  const { password, wallets, ...safe } = merchant;
  return {
    ...safe,
    wallets: publicWallets(wallets),
    merchantId: merchant.merchantId || merchant.id,
    transactions: getAllTransactions()
      .filter((tx) => tx.merchantId === merchant.id)
      .slice(0, 10),
  };
}

function toAuthMerchant(merchant) {
  if (!merchant) return null;
  const { password, wallets, ...safe } = merchant;
  return {
    ...safe,
    wallets: publicWallets(wallets),
    merchantId: merchant.merchantId || merchant.id,
  };
}

function attachWallets(base, wallets) {
  return {
    ...base,
    wallets,
    walletAddress: wallets.ethereum.address,
    walletAddresses: {
      ethereum: wallets.ethereum.address,
      solana: wallets.solana.address,
      bitcoin: wallets.bitcoin.address,
    },
  };
}

function createMerchant({ email, password, name, businessName } = {}) {
  const id = `mch_${generateSessionToken().slice(4, 16)}`;
  const displayName = name || String(email).split('@')[0] || 'Sandbox Merchant';
  const merchant = attachWallets(
    {
      id,
      merchantId: id,
      name: displayName,
      businessName: businessName || `${displayName} Store`,
      description: 'Sandbox merchant created at login',
      logo: null,
      website: null,
      email: String(email).trim().toLowerCase(),
      password: String(password || ''),
      balance: 10000,
      sandboxMode: true,
      acceptedCryptocurrencies: [...DEFAULT_MERCHANT.acceptedCryptocurrencies],
      settings: JSON.parse(JSON.stringify(DEFAULT_MERCHANT.settings)),
      analytics: {
        totalTransactions: 0,
        totalVolume: 0,
        averageTransactionValue: 0,
        mostPopularCryptocurrency: 'SOL',
        conversionRate: 1,
        customerCount: 1,
        revenueByCryptocurrency: {},
      },
      createdAt: nowIso(),
    },
    generateMerchantWallets()
  );
  store.merchants.set(merchant.id, merchant);
  return merchant;
}

function upsertSandboxMerchant({ email, password, name, businessName } = {}) {
  const existing = getMerchantByEmail(email);
  if (existing) return existing;
  return createMerchant({ email, password, name, businessName });
}

function loginSandboxMerchant({ email, password, name, businessName } = {}) {
  const existing = getMerchantByEmail(email);
  if (existing) {
    if (existing.password !== String(password)) {
      return { error: 'invalid_credentials', merchant: null, created: false };
    }
    return { merchant: existing, created: false };
  }
  return {
    merchant: createMerchant({ email, password, name, businessName }),
    created: true,
  };
}

function updateMerchantSettings(merchantId, patch = {}) {
  const merchant = store.merchants.get(merchantId);
  if (!merchant) return null;
  if (patch.webhookUrl !== undefined) {
    merchant.settings.webhookUrl = patch.webhookUrl ? String(patch.webhookUrl) : null;
  }
  if (patch.name) merchant.name = String(patch.name);
  if (patch.businessName) merchant.businessName = String(patch.businessName);
  return merchant;
}

function createMerchantSession(merchantId, apiKey) {
  const key = apiKey || generateApiKey();
  const session = {
    apiKey: key,
    merchantId,
    createdAt: nowIso(),
  };
  store.merchantSessions.set(key, session);
  store.sessions.set(key, { token: key, merchantId, createdAt: session.createdAt });
  return session;
}

function getMerchantSession(apiKey) {
  if (!apiKey) return null;
  return store.merchantSessions.get(apiKey) || store.sessions.get(apiKey) || null;
}

function createTransaction(data = {}) {
  const merchant = store.merchants.get(data.merchantId) || store.merchants.get(DEFAULT_MERCHANT.id);
  const createdAt = data.createdAt || nowIso();
  const currency = String(data.currency || 'USDC').toUpperCase();
  const network = getNetwork(currency);
  const requiredConfirmations = getRequiredConfirmations(currency);
  const txId = data.txId || generateTxId();
  const txHash = data.txHash || generateTxHash(network);
  const willFail = typeof data.fail === 'boolean' ? data.fail : Math.random() < getFailRate();

  const tx = {
    txId,
    txHash,
    orderId: String(data.orderId),
    merchantId: merchant.id,
    amount: Number(data.amount),
    currency,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    id: txId,
    signature: txHash,
    cryptocurrency: currency,
    from: data.from || 'sandbox:payer',
    to: primaryWalletAddress(merchant.wallets, currency),
    fee: 0,
    confirmations: 0,
    requiredConfirmations,
    blockNumber: null,
    network,
    callbackUrl: data.callbackUrl || data.webhookUrl || merchant.settings.webhookUrl || null,
    metadata: {
      merchantId: merchant.id,
      orderId: String(data.orderId),
      description: data.description || 'sandbox payment',
      category: 'merchant_payment',
    },
    confirmedAt: null,
    failedAt: null,
    timestamp: createdAt,
    _willFail: willFail,
  };

  saveTransaction(tx);
  updateAnalytics(merchant.id, tx);
  return clonePublic(tx);
}

function createPayment(data) {
  return createTransaction(data);
}

function getTransaction(txId) {
  const tx = store.transactions.get(txId);
  if (!tx) return null;
  return applyDueTransitions(tx.txId);
}

function updateTransactionStatus(txId, newStatus, { force = false } = {}) {
  const existing = store.transactions.get(txId);
  if (!existing) return null;

  if (!['pending', 'confirming', 'confirmed', 'failed'].includes(newStatus)) {
    return clonePublic(existing);
  }

  if (existing.status === newStatus) {
    return clonePublic(existing);
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status] || new Set();
  if (!force && !allowed.has(newStatus)) {
    return clonePublic(existing);
  }

  const previousStatus = existing.status;
  const updated = {
    ...existing,
    ...patchForStatus(existing, newStatus),
    updatedAt: nowIso(),
    timestamp: nowIso(),
  };
  saveTransaction(updated);
  notifyStatusChange(updated, previousStatus);
  return clonePublic(updated);
}

function updateTransaction(txId, patch) {
  const existing = store.transactions.get(txId);
  if (!existing) return null;

  if (patch.status && patch.status !== existing.status) {
    const moved = updateTransactionStatus(existing.txId, patch.status);
    const leftover = { ...patch };
    delete leftover.status;
    if (!moved || Object.keys(leftover).length === 0) return moved;
    return updateTransaction(existing.txId, leftover);
  }

  const updated = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
    timestamp: nowIso(),
  };
  saveTransaction(updated);
  return clonePublic(updated);
}

function getAllTransactions() {
  return uniqueTransactions()
    .map((tx) => applyDueTransitions(tx.txId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function listTransactions({ merchantId } = {}) {
  return getAllTransactions().filter((tx) => !merchantId || tx.merchantId === merchantId);
}

function findByOrderId(merchantId, orderId) {
  return getAllTransactions().find((tx) => tx.merchantId === merchantId && tx.orderId === orderId) || null;
}

function progressTransaction(txId) {
  const tx = store.transactions.get(txId);
  if (!tx || TERMINAL_STATUSES.has(tx.status)) {
    return tx ? clonePublic(tx) : null;
  }
  const next = tx.status === 'pending' ? 'confirming' : tx._willFail ? 'failed' : 'confirmed';
  return updateTransactionStatus(tx.txId, next);
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
  const session = createMerchantSession(merchantId);
  return { token: session.apiKey, merchantId: session.merchantId, createdAt: session.createdAt };
}

function getSession(token) {
  const session = getMerchantSession(token);
  if (!session) return null;
  return {
    token: session.apiKey || session.token,
    merchantId: session.merchantId,
    createdAt: session.createdAt,
  };
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

function reset() {
  store.transactions.clear();
  store.merchants.clear();
  store.sessions.clear();
  store.merchantSessions.clear();
  seed();
}

startStateMachine();

module.exports = {
  DEFAULT_MERCHANT,
  createTransaction,
  createPayment,
  getTransaction,
  updateTransactionStatus,
  getAllTransactions,
  updateTransaction,
  listTransactions,
  findByOrderId,
  progressTransaction,
  startStateMachine,
  stopStateMachine,
  tickStateMachine,
  onStatusChange,
  getMerchant,
  getMerchantByEmail,
  publicMerchant,
  toAuthMerchant,
  createMerchant,
  upsertSandboxMerchant,
  loginSandboxMerchant,
  credentialsView,
  updateMerchantSettings,
  createMerchantSession,
  getMerchantSession,
  createSession,
  getSession,
  reset,
  STATE_MACHINE_INTERVAL_MS,
};
