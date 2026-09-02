'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SepoliaTestnetClient } = require('../src/chain/testnet-client');

describe('SepoliaTestnetClient', () => {
  it('refuses to construct against a mainnet RPC URL', () => {
    assert.throws(
      () => new SepoliaTestnetClient('https://mainnet.infura.io/v3/abc'),
      /mainnet/
    );
  });

  it('refuses to operate if the provider reports a non-Sepolia chainId', async () => {
    const client = new SepoliaTestnetClient('https://rpc.sepolia.org', {
      provider: {
        async getNetwork() {
          return { chainId: 1n, name: 'mainnet' };
        },
      },
    });

    await assert.rejects(() => client.assertConnectedToSepolia(), /Mainnet is forbidden/);
  });

  it('verifies incoming Sepolia payments against receive address and amount', async () => {
    const to = '0x000000000000000000000000000000000000dEaD';
    const from = '0x1111111111111111111111111111111111111111';
    const txHash = '0x' + 'ab'.repeat(32);
    const client = new SepoliaTestnetClient('https://ethereum-sepolia-rpc.publicnode.com', {
      provider: {
        async getNetwork() {
          return { chainId: 11155111n, name: 'sepolia' };
        },
        async getBlockNumber() {
          return 100;
        },
        async getTransaction(hash) {
          assert.equal(hash, txHash);
          return {
            hash,
            chainId: 11155111,
            from,
            to,
            value: 10n ** 16n,
            blockNumber: 98,
          };
        },
        async getTransactionReceipt() {
          return { status: 1 };
        },
      },
    });

    const result = await client.verifyIncomingPayment({
      txHash,
      to,
      minAmountWei: (10n ** 16n).toString(),
    });

    assert.equal(result.network, 'sepolia');
    assert.equal(result.chainId, 11155111);
    assert.equal(result.confirmations, 3);
    assert.equal(result.from, from);
  });

  it('rejects a payment whose chainId is mainnet', async () => {
    const to = '0x000000000000000000000000000000000000dEaD';
    const client = new SepoliaTestnetClient('https://rpc.sepolia.org', {
      provider: {
        async getNetwork() {
          return { chainId: 11155111n, name: 'sepolia' };
        },
        async getTransaction() {
          return {
            chainId: 1,
            to,
            value: 1n,
            from: '0x1111111111111111111111111111111111111111',
            blockNumber: 1,
          };
        },
        async getTransactionReceipt() {
          return { status: 1 };
        },
        async getBlockNumber() {
          return 1;
        },
      },
    });

    await assert.rejects(
      () =>
        client.verifyIncomingPayment({
          txHash: '0x' + 'cd'.repeat(32),
          to,
          minAmountWei: '1',
        }),
      /not Sepolia/
    );
  });
});
