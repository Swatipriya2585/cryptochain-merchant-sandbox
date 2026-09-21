import { describe, expect, it } from "vitest";
import { assertSandboxRpcUrl } from "../src/blockchain/rpc-guards";
import { loadConfig } from "../src/config/env";

describe("sandbox RPC guards", () => {
  it("throws a loud error when a mainnet RPC is used in sandbox", () => {
    expect(() =>
      assertSandboxRpcUrl("https://eth-mainnet.g.alchemy.com/v2/demo", "sandbox"),
    ).toThrow(/REFUSING TO LOAD A MAINNET RPC URL WHILE NODE_ENV=sandbox/);
  });

  it("rejects a mainnet SEPOLIA_RPC_URL at config load", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "sandbox",
        PORT: "4000",
        DATABASE_URL: "postgresql://cryptochain:cryptochain@localhost:5433/cryptochain_sandbox",
        SEPOLIA_RPC_URL: "https://mainnet.infura.io/v3/demo",
        SEPOLIA_PRIVATE_KEY: "0x".padEnd(66, "a"),
        STRIPE_TEST_SECRET_KEY: "sk_test_x",
        STRIPE_TEST_WEBHOOK_SECRET: "whsec_x",
        CORS_ORIGIN: "http://localhost:8080",
      }),
    ).toThrow(/must be a Sepolia RPC URL, not mainnet/);
  });
});
