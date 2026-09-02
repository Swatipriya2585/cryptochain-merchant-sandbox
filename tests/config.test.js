'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertSepoliaNetwork,
  assertSepoliaChainId,
  assertSepoliaRpcUrl,
  assertSandboxSqlitePath,
  assertNoProductionDataSources,
} = require('../src/config/guards');
const { loadSandboxConfig } = require('../src/config');

const VALID_ENV = {
  NETWORK: 'sepolia',
  SEPOLIA_CHAIN_ID: '11155111',
  SEPOLIA_RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  SANDBOX_SQLITE_PATH: './db/data/sandbox.sqlite',
  SANDBOX_SEPOLIA_RECEIVE_ADDRESS: '0x000000000000000000000000000000000000dEaD',
};

describe('sandbox config guards', () => {
  it('accepts sepolia network and chain id', () => {
    assert.doesNotThrow(() => assertSepoliaNetwork('sepolia'));
    assert.doesNotThrow(() => assertSepoliaChainId(11155111));
  });

  it('rejects mainnet and other networks', () => {
    assert.throws(() => assertSepoliaNetwork('mainnet'), /testnet-only/);
    assert.throws(() => assertSepoliaChainId(1), /Mainnet/);
  });

  it('rejects mainnet RPC URLs', () => {
    assert.throws(
      () => assertSepoliaRpcUrl('https://mainnet.infura.io/v3/abc'),
      /mainnet/
    );
    assert.throws(
      () => assertSepoliaRpcUrl('https://eth-mainnet.g.alchemy.com/v2/abc'),
      /mainnet/
    );
    assert.throws(
      () => assertSepoliaRpcUrl('https://ethereum.publicnode.com'),
      /must include "sepolia"/
    );
  });

  it('accepts public sepolia RPC URLs', () => {
    assert.doesNotThrow(() => assertSepoliaRpcUrl('https://rpc.sepolia.org'));
    assert.doesNotThrow(() => assertSepoliaRpcUrl('https://ethereum-sepolia-rpc.publicnode.com'));
    assert.doesNotThrow(() => assertSepoliaRpcUrl('https://1rpc.io/sepolia'));
  });

  it('requires sqlite paths to be sandbox-scoped files', () => {
    assert.doesNotThrow(() => assertSandboxSqlitePath('./db/data/sandbox.sqlite'));
    assert.doesNotThrow(() => assertSandboxSqlitePath(':memory:'));
    assert.throws(() => assertSandboxSqlitePath('./db/prod.sqlite'), /sandbox/);
    assert.throws(() => assertSandboxSqlitePath('postgres://user:pass@db.example/prod'), /sandbox/);
    assert.throws(
      () => assertSandboxSqlitePath('mongodb+srv://cluster.mongodb.net/sandbox'),
      /remote database URI/
    );
  });

  it('rejects production database URIs on the sandbox env object', () => {
    assert.throws(
      () => assertNoProductionDataSources({ ...VALID_ENV, DATABASE_URL: 'postgres://prod' }),
      /DATABASE_URL/
    );
    assert.throws(
      () => assertNoProductionDataSources({ ...VALID_ENV, MONGODB_URI: 'mongodb://prod' }),
      /MONGODB_URI/
    );
    assert.throws(
      () =>
        assertNoProductionDataSources({
          ...VALID_ENV,
          SEPOLIA_RPC_URL: 'https://eth-mainnet.example.com',
        }),
      /mainnet RPC/
    );
  });

  it('loads isolated sandbox config without using DATABASE_URL', () => {
    const config = loadSandboxConfig({ skipDotenv: true, isolated: true, env: VALID_ENV });
    assert.equal(config.network, 'sepolia');
    assert.equal(config.chainId, 11155111);
    assert.match(config.sqlitePath, /sandbox/);
    assert.equal(config.rpcUrl.includes('sepolia'), true);
    assert.equal(Object.hasOwn(config, 'databaseUrl'), false);
  });
});
