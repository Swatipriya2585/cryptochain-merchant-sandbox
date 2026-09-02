'use strict';

const { ethers } = require('ethers');
const {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
  assertSepoliaRpcUrl,
} = require('../config/guards');

const SEPOLIA_NETWORKISH = Object.freeze({
  chainId: SEPOLIA_CHAIN_ID,
  name: SEPOLIA_NETWORK,
});

class SepoliaTestnetClient {
  /**
   * JSON-RPC client locked to Ethereum Sepolia (chainId 11155111).
   * Construction fails if the URL looks like mainnet.
   */
  constructor(rpcUrl, { provider } = {}) {
    assertSepoliaRpcUrl(rpcUrl);
    this.rpcUrl = rpcUrl;
    this.provider =
      provider ||
      new ethers.JsonRpcProvider(rpcUrl, SEPOLIA_NETWORKISH, { staticNetwork: true });
  }

  async assertConnectedToSepolia() {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error(
        `Refusing to operate: RPC reported chainId ${chainId}, expected Sepolia ${SEPOLIA_CHAIN_ID}. Mainnet is forbidden.`
      );
    }
    return { chainId, name: SEPOLIA_NETWORK };
  }

  async getBlockNumber() {
    await this.assertConnectedToSepolia();
    return this.provider.getBlockNumber();
  }

  async getBalance(address) {
    await this.assertConnectedToSepolia();
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    const wei = await this.provider.getBalance(address);
    return {
      address: ethers.getAddress(address),
      wei: wei.toString(),
      eth: ethers.formatEther(wei),
      network: SEPOLIA_NETWORK,
      chainId: SEPOLIA_CHAIN_ID,
    };
  }

  async getTransaction(txHash) {
    await this.assertConnectedToSepolia();
    return this.provider.getTransaction(txHash);
  }

  async getTransactionReceipt(txHash) {
    await this.assertConnectedToSepolia();
    return this.provider.getTransactionReceipt(txHash);
  }

  async getConfirmations(txHash) {
    await this.assertConnectedToSepolia();
    const tx = await this.provider.getTransaction(txHash);
    if (!tx || tx.blockNumber == null) return 0;
    const head = await this.provider.getBlockNumber();
    return Math.max(0, head - tx.blockNumber + 1);
  }

  /**
   * Verify an incoming Sepolia ETH transfer against a sandbox order.
   */
  async verifyIncomingPayment({ txHash, to, minAmountWei }) {
    await this.assertConnectedToSepolia();

    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new Error('txHash must be a 32-byte 0x-prefixed hex string.');
    }
    if (!ethers.isAddress(to)) {
      throw new Error(`Invalid receive address: ${to}`);
    }

    const tx = await this.provider.getTransaction(txHash);
    if (!tx) {
      const error = new Error('Transaction not found on Sepolia.');
      error.code = 'TX_NOT_FOUND';
      throw error;
    }

    if (tx.chainId && Number(tx.chainId) !== SEPOLIA_CHAIN_ID) {
      throw new Error(
        `Transaction chainId ${tx.chainId} is not Sepolia (${SEPOLIA_CHAIN_ID}). Mainnet payments are rejected.`
      );
    }

    if (!tx.to || ethers.getAddress(tx.to) !== ethers.getAddress(to)) {
      const error = new Error(
        `Transaction recipient ${tx.to} does not match sandbox receive address ${to}.`
      );
      error.code = 'RECIPIENT_MISMATCH';
      throw error;
    }

    const value = tx.value ?? 0n;
    const required = BigInt(minAmountWei);
    if (value < required) {
      const error = new Error(
        `Transaction value ${value} wei is below the ordered amount ${required} wei.`
      );
      error.code = 'INSUFFICIENT_VALUE';
      throw error;
    }

    const receipt = await this.provider.getTransactionReceipt(txHash);
    const confirmations = await this.getConfirmations(txHash);

    return {
      network: SEPOLIA_NETWORK,
      chainId: SEPOLIA_CHAIN_ID,
      txHash,
      from: tx.from,
      to: ethers.getAddress(tx.to),
      valueWei: value.toString(),
      valueEth: ethers.formatEther(value),
      blockNumber: tx.blockNumber ?? null,
      status: receipt ? Number(receipt.status) : null,
      confirmations,
    };
  }
}

module.exports = {
  SepoliaTestnetClient,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
};
