'use strict';

const { loadSandboxConfig } = require('./config');
const { createApp } = require('./app');
const { openSandboxDb } = require('../db/sandbox');
const { SepoliaTestnetClient } = require('./chain/testnet-client');

function start() {
  const config = loadSandboxConfig();
  const db = openSandboxDb(config.sqlitePath);
  const chain = new SepoliaTestnetClient(config.rpcUrl);
  const app = createApp({ db, chain, config });

  const server = app.listen(config.port, () => {
    console.log('cryptochain-backend-sandbox (TESTNET ONLY)');
    console.log(`  network:  sepolia (chainId ${config.chainId})`);
    console.log(`  database: sandbox SQLite at ${config.sqlitePath}`);
    console.log(`  listen:   http://localhost:${config.port}`);
    console.log('  mainnet RPC and production databases are disabled in code.');
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server, db, chain, config };
}

if (require.main === module) {
  start();
}

module.exports = { start };
