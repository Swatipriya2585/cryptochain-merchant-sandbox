'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
  assertSepoliaNetwork,
  assertSepoliaChainId,
  assertSepoliaRpcUrl,
  assertSandboxSqlitePath,
  assertNoProductionDataSources,
  assertSandboxReceiveAddress,
} = require('./guards');

const ROOT = path.join(__dirname, '..', '..');

const REMOTE_DB_KEYS = ['DATABASE_URL', 'MONGODB_URI', 'MONGO_URI'];

function rejectRemoteDbKeys(source, label) {
  if (!source) return;
  for (const key of REMOTE_DB_KEYS) {
    if (source[key]) {
      throw new Error(
        `Refusing to start: ${key} is set in ${label}. This backend opens only a local sandbox SQLite file.`
      );
    }
  }
}

function loadEnvFile() {
  const sandboxEnv = path.join(ROOT, '.env.sandbox');
  const exampleEnv = path.join(ROOT, '.env.sandbox.example');

  if (fs.existsSync(sandboxEnv)) {
    const loaded = dotenv.config({ path: sandboxEnv, override: true });
    rejectRemoteDbKeys(loaded.parsed, '.env.sandbox');
    return sandboxEnv;
  }

  if (fs.existsSync(exampleEnv)) {
    const loaded = dotenv.config({ path: exampleEnv, override: false });
    rejectRemoteDbKeys(loaded.parsed, '.env.sandbox.example');
    return exampleEnv;
  }

  return null;
}

function loadSandboxConfig(overrides = {}) {
  if (!overrides.skipDotenv) {
    loadEnvFile();
  }

  const env = overrides.isolated ? { ...overrides.env } : { ...process.env, ...overrides.env };

  if (!overrides.isolated) {
    for (const key of REMOTE_DB_KEYS) {
      delete env[key];
    }
  }

  assertNoProductionDataSources(env);

  const network = env.NETWORK || SEPOLIA_NETWORK;
  const chainId = Number(env.SEPOLIA_CHAIN_ID || SEPOLIA_CHAIN_ID);
  const rpcUrl = env.SEPOLIA_RPC_URL;
  const sqlitePath = env.SANDBOX_SQLITE_PATH || path.join(ROOT, 'db', 'data', 'sandbox.sqlite');
  const receiveAddress = env.SANDBOX_SEPOLIA_RECEIVE_ADDRESS;

  assertSepoliaNetwork(network);
  assertSepoliaChainId(chainId);
  assertSepoliaRpcUrl(rpcUrl);
  assertSandboxSqlitePath(sqlitePath);
  assertSandboxReceiveAddress(receiveAddress, { allowPlaceholder: true });

  const requiredConfirmations = Math.max(1, Number(env.SEPOLIA_REQUIRED_CONFIRMATIONS || 2));
  const port = Number(env.PORT || 4100);
  const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'sandbox',
    port,
    network: SEPOLIA_NETWORK,
    chainId: SEPOLIA_CHAIN_ID,
    rpcUrl,
    sqlitePath,
    receiveAddress,
    apiKey: env.SANDBOX_API_KEY || 'sk_sandbox_replace_me',
    webhookSecret: env.SANDBOX_WEBHOOK_SECRET || 'whsec_sandbox_replace_me',
    requiredConfirmations,
    allowedOrigins,
  });
}

module.exports = {
  loadSandboxConfig,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
};
