import { afterEach, describe, expect, it } from "vitest";
import {
  createMockSepoliaProvider,
  isMockChainProviderEnabled,
  resetProviderCacheForTests,
} from "../src/blockchain/provider";
import { runSepoliaSmoke } from "../src/blockchain/sepolia-smoke";

describe("MOCK_CHAIN_PROVIDER", () => {
  afterEach(() => {
    resetProviderCacheForTests();
  });

  it("treats MOCK_CHAIN_PROVIDER=true as an in-process mock", () => {
    expect(isMockChainProviderEnabled({ MOCK_CHAIN_PROVIDER: "true" })).toBe(true);
    expect(isMockChainProviderEnabled({ MOCK_CHAIN_PROVIDER: "false" })).toBe(false);
    expect(isMockChainProviderEnabled({})).toBe(false);
  });

  it("returns Sepolia chain id and a block number without a network call", async () => {
    const provider = createMockSepoliaProvider();
    const network = await provider.getNetwork();
    expect(network.chainId).toBe(11155111n);
    await expect(provider.getBlockNumber()).resolves.toBe(9_000_000);
    await expect(provider.send("eth_getLogs", [])).resolves.toEqual([]);
    await expect(provider.send("eth_sendRawTransaction", ["0x"])).rejects.toThrow(
      /MOCK_CHAIN_PROVIDER blocked JSON-RPC method eth_sendRawTransaction/,
    );
  });

  it("refuses the real Sepolia smoke while the mock flag is on", async () => {
    await expect(
      runSepoliaSmoke({
        MOCK_CHAIN_PROVIDER: "true",
        SEPOLIA_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
      }),
    ).rejects.toThrow(/MOCK_CHAIN_PROVIDER=true/);
  });
});
