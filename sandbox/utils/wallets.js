const crypto = require('crypto');
const { keccak256 } = require('js-sha3');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Well-known Hardhat/Anvil account #0 — sandbox demo only, never fund on mainnet. */
const DEMO_ETH_PRIVATE_KEY = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEMO_SOL_SEED = crypto.createHash('sha256').update('cryptochain-sandbox-solana-demo').digest();
const DEMO_BTC_SEED = crypto.createHash('sha256').update('cryptochain-sandbox-bitcoin-demo').digest();

const SANDBOX_KEY_WARNING =
  'Sandbox demo keys only. Never use these on mainnet or with real funds.';

function encodeBase58(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) return '';

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  const size = Math.ceil((bytes.length * 138) / 100) + 1;
  const encoded = Buffer.alloc(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; k >= 0 && (carry !== 0 || j < length); k -= 1, j += 1) {
      carry += encoded[k] * 256;
      encoded[k] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    length = j;
  }

  let start = size - length;
  while (start < size && encoded[start] === 0) start += 1;

  let result = '1'.repeat(zeros);
  for (let i = start; i < size; i += 1) {
    result += BASE58_ALPHABET[encoded[i]];
  }
  return result;
}

function toChecksumAddress(address) {
  const hex = address.replace(/^0x/i, '').toLowerCase();
  const hash = keccak256(hex);
  let out = '0x';
  for (let i = 0; i < hex.length; i += 1) {
    out += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  }
  return out;
}

function ethereumWalletFromPrivateKey(privateKeyHex) {
  const key = Buffer.from(String(privateKeyHex).replace(/^0x/i, ''), 'hex');
  if (key.length !== 32) {
    throw new Error('Ethereum private key must be 32 bytes');
  }

  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(key);
  const publicKey = ecdh.getPublicKey(null, 'uncompressed');
  const hash = Buffer.from(keccak256.arrayBuffer(publicKey.subarray(1)));
  const address = toChecksumAddress(`0x${hash.subarray(-20).toString('hex')}`);

  return {
    network: 'ethereum-sepolia-demo',
    chain: 'ethereum',
    address,
    publicKey: `0x${publicKey.toString('hex')}`,
    privateKey: `0x${key.toString('hex')}`,
  };
}

function generateEthereumWallet() {
  return ethereumWalletFromPrivateKey(crypto.randomBytes(32).toString('hex'));
}

function ed25519FromSeed(seed32) {
  const seed = Buffer.from(seed32);
  if (seed.length !== 32) {
    throw new Error('ed25519 seed must be 32 bytes');
  }

  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const privateKeyObj = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);
  const spki = publicKeyObj.export({ type: 'spki', format: 'der' });
  const publicKeyRaw = spki.subarray(spki.length - 32);
  const secret64 = Buffer.concat([seed, publicKeyRaw]);

  return {
    publicKeyRaw,
    secret64,
    address: encodeBase58(publicKeyRaw),
    publicKey: encodeBase58(publicKeyRaw),
    privateKey: encodeBase58(secret64),
    publicKeyHex: publicKeyRaw.toString('hex'),
    privateKeyHex: seed.toString('hex'),
  };
}

function solanaWalletFromSeed(seed32) {
  const keys = ed25519FromSeed(seed32);
  return {
    network: 'solana-devnet-demo',
    chain: 'solana',
    address: keys.address,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    publicKeyHex: keys.publicKeyHex,
    privateKeyHex: keys.privateKeyHex,
  };
}

function generateSolanaWallet() {
  return solanaWalletFromSeed(crypto.randomBytes(32));
}

function bitcoinWalletFromSeed(seed32) {
  const payload = Buffer.concat([Buffer.from([0x6f]), seed32.subarray(0, 20)]);
  const checksum = crypto.createHash('sha256').update(crypto.createHash('sha256').update(payload).digest()).digest().subarray(0, 4);
  return {
    network: 'bitcoin-testnet-demo',
    chain: 'bitcoin',
    address: encodeBase58(Buffer.concat([payload, checksum])),
    publicKey: seed32.toString('hex'),
    privateKey: `c${encodeBase58(seed32)}`,
  };
}

function generateBitcoinWallet() {
  return bitcoinWalletFromSeed(crypto.randomBytes(32));
}

function createDemoWallets() {
  return {
    ethereum: ethereumWalletFromPrivateKey(DEMO_ETH_PRIVATE_KEY),
    solana: solanaWalletFromSeed(DEMO_SOL_SEED),
    bitcoin: bitcoinWalletFromSeed(DEMO_BTC_SEED),
  };
}

function generateMerchantWallets() {
  return {
    ethereum: generateEthereumWallet(),
    solana: generateSolanaWallet(),
    bitcoin: generateBitcoinWallet(),
  };
}

function primaryWalletAddress(wallets, currency) {
  const code = String(currency || '').toUpperCase();
  if (code === 'SOL' || code === 'SOLANA' || code === 'USDC') return wallets.solana.address;
  if (code === 'BTC' || code === 'BITCOIN') return wallets.bitcoin.address;
  return wallets.ethereum.address;
}

module.exports = {
  SANDBOX_KEY_WARNING,
  DEMO_ETH_PRIVATE_KEY,
  encodeBase58,
  toChecksumAddress,
  ethereumWalletFromPrivateKey,
  generateEthereumWallet,
  generateSolanaWallet,
  generateBitcoinWallet,
  createDemoWallets,
  generateMerchantWallets,
  primaryWalletAddress,
};
