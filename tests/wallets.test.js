const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ethereumWalletFromPrivateKey,
  generateMerchantWallets,
  createDemoWallets,
  DEMO_ETH_PRIVATE_KEY,
} = require('../sandbox/utils/wallets');

test('demo Ethereum wallet is Hardhat account 0', () => {
  const wallets = createDemoWallets();
  assert.equal(wallets.ethereum.address, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  assert.equal(wallets.ethereum.privateKey, `0x${DEMO_ETH_PRIVATE_KEY}`);
  assert.match(wallets.solana.address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.match(wallets.bitcoin.address, /^[1-9A-HJ-NP-Za-km-z]{26,35}$/);
});

test('generated merchant wallets are unique sandbox keypairs', () => {
  const a = generateMerchantWallets();
  const b = generateMerchantWallets();
  assert.notEqual(a.ethereum.address, b.ethereum.address);
  assert.notEqual(a.solana.privateKey, b.solana.privateKey);
  const roundTrip = ethereumWalletFromPrivateKey(a.ethereum.privateKey);
  assert.equal(roundTrip.address, a.ethereum.address);
});
