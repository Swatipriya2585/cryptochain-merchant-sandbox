'use strict';

/**
 * Startup guards for cryptochain-backend-sandbox.
 * This process is Sepolia + local sandbox SQLite only.
 */

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_NETWORK = 'sepolia';

const MAINNET_RPC_HINTS = [
  /mainnet/i,
  /eth[-.]mainnet/i,
  /ethereum[-.]mainnet/i,
  /chain[-_]?id=1(?:\D|$)/i,
];

const FORBIDDEN_DB_URIS = [
  /^mongodb(\+srv)?:\/\//i,
  /^postgres(ql)?:\/\//i,
  /^mysql:\/\//i,
  /^redis:\/\//i,
  /^https?:\/\/.*(?:neon\.tech|supabase\.co|planetscale|mongodb\.net|rds\.amazonaws|azure\.com)/i,
];

function hostnameOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function assertSepoliaNetwork(network) {
  const normalized = String(network || '').trim().toLowerCase();
  if (normalized !== SEPOLIA_NETWORK) {
    throw new Error(
      `Refusing to start: NETWORK must be "${SEPOLIA_NETWORK}" (received "${network}"). This backend is testnet-only.`
    );
  }
}

function assertSepoliaChainId(chainId) {
  const numeric = Number(chainId);
  if (numeric !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Refusing to start: SEPOLIA_CHAIN_ID must be ${SEPOLIA_CHAIN_ID} (received "${chainId}"). Mainnet (1) and other chains are forbidden.`
    );
  }
}

function assertSepoliaRpcUrl(rpcUrl) {
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new Error('SEPOLIA_RPC_URL is required and must be a Sepolia HTTP(S) endpoint.');
  }

  const trimmed = rpcUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('SEPOLIA_RPC_URL must be a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SEPOLIA_RPC_URL must use http or https.');
  }

  for (const hint of MAINNET_RPC_HINTS) {
    if (hint.test(trimmed) || hint.test(parsed.hostname)) {
      throw new Error(
        `Refusing to start: SEPOLIA_RPC_URL looks like a mainnet endpoint (${trimmed}). Mainnet RPC is forbidden.`
      );
    }
  }

  const hostAndPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  if (!hostAndPath.includes('sepolia')) {
    throw new Error(
      `Refusing to start: SEPOLIA_RPC_URL must include "sepolia" in the host or path. Got ${parsed.hostname}.`
    );
  }
}

function assertSandboxSqlitePath(sqlitePath) {
  if (!sqlitePath || typeof sqlitePath !== 'string') {
    throw new Error('SANDBOX_SQLITE_PATH is required.');
  }

  if (sqlitePath === ':memory:') {
    return;
  }

  const lower = sqlitePath.toLowerCase();
  if (!lower.includes('sandbox')) {
    throw new Error(
      'SANDBOX_SQLITE_PATH must include "sandbox" so this file cannot be confused with a production database.'
    );
  }

  if (FORBIDDEN_DB_URIS.some((pattern) => pattern.test(sqlitePath))) {
    throw new Error('SANDBOX_SQLITE_PATH must be a local SQLite file, not a remote database URI.');
  }
}

function assertNoProductionDataSources(env) {
  const rpcKeys = Object.keys(env).filter((key) =>
    /RPC|INFURA|ALCHEMY|QUICKNODE|CHAINSTACK|ANKR|BLASTAPI|DRPC/i.test(key)
  );

  for (const key of rpcKeys) {
    const value = env[key];
    if (typeof value !== 'string' || !value) continue;
    const blob = `${hostnameOf(value)} ${value}`;
    if (MAINNET_RPC_HINTS.some((hint) => hint.test(blob))) {
      throw new Error(
        `Refusing to start: ${key} appears to point at a mainnet RPC. This backend is Sepolia-only.`
      );
    }
  }

  const sqlitePath = env.SANDBOX_SQLITE_PATH;
  if (sqlitePath && FORBIDDEN_DB_URIS.some((pattern) => pattern.test(sqlitePath))) {
    throw new Error('SANDBOX_SQLITE_PATH must be a local SQLite file, not a remote database URI.');
  }

  for (const key of ['MONGODB_URI', 'MONGO_URI', 'DATABASE_URL']) {
    if (env[key]) {
      throw new Error(
        `Refusing to start: ${key} is set. This backend opens only a local sandbox SQLite file and will not connect to ${key}.`
      );
    }
  }
}

function assertSandboxReceiveAddress(address, { allowPlaceholder = false } = {}) {
  if (!address) {
    throw new Error('SANDBOX_SEPOLIA_RECEIVE_ADDRESS is required.');
  }
  if (allowPlaceholder && /replace|your|example|dead/i.test(address)) {
    return;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('SANDBOX_SEPOLIA_RECEIVE_ADDRESS must be a 20-byte 0x-prefixed address.');
  }
}

module.exports = {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
  assertSepoliaNetwork,
  assertSepoliaChainId,
  assertSepoliaRpcUrl,
  assertSandboxSqlitePath,
  assertNoProductionDataSources,
  assertSandboxReceiveAddress,
};
