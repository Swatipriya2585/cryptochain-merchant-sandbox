const crypto = require('crypto');

const NETWORKS = {
  SOL: 'solana',
  SOLANA: 'solana',
  USDC: 'solana',
  USDT: 'ethereum',
  ETH: 'ethereum',
  ETHEREUM: 'ethereum',
  BTC: 'bitcoin',
  BITCOIN: 'bitcoin',
};

const REQUIRED_CONFIRMATIONS = {
  solana: 1,
  ethereum: 3,
  bitcoin: 3,
};

function getConfirmDelayMs() {
  const parsed = Number(process.env.CONFIRM_DELAY_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 8000;
}

function getFailRate() {
  const parsed = Number(process.env.FAIL_RATE);
  if (!Number.isFinite(parsed) || parsed < 0) return 0.1;
  return Math.min(1, parsed);
}

function getNetwork(currency) {
  if (!currency) return 'solana';
  return NETWORKS[String(currency).toUpperCase()] || 'solana';
}

function getRequiredConfirmations(currency) {
  return REQUIRED_CONFIRMATIONS[getNetwork(currency)] || 3;
}

function generateTxId() {
  return `tx_${crypto.randomBytes(12).toString('hex')}`;
}

function generateTxHash(network) {
  const hex = crypto.randomBytes(32).toString('hex');
  if (network === 'bitcoin') return hex;
  if (network === 'solana') {
    return crypto.randomBytes(32).toString('base64url').replace(/[^1-9A-HJ-NP-Za-km-z]/g, 'A').slice(0, 88);
  }
  return `0x${hex}`;
}

function generateSessionToken() {
  return `sbx_${crypto.randomBytes(24).toString('hex')}`;
}

function generateApiKey() {
  return `sk_sandbox_${crypto.randomBytes(24).toString('hex')}`;
}

function signWebhookPayload(payload, secret) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function confirmationsForStatus(status, required) {
  if (status === 'confirmed') return required;
  if (status === 'confirming') return Math.max(1, Math.ceil(required / 2));
  return 0;
}

function nextStatus(current) {
  if (current === 'pending') return 'confirming';
  if (current === 'confirming') return 'confirmed';
  return current;
}

module.exports = {
  getConfirmDelayMs,
  getFailRate,
  getNetwork,
  getRequiredConfirmations,
  generateTxId,
  generateTxHash,
  generateSessionToken,
  generateApiKey,
  signWebhookPayload,
  confirmationsForStatus,
  nextStatus,
};
