import { describe, expect, it } from "vitest";
import { assertProductionRpcUrl, assertSandboxRpcUrl } from "../src/blockchain/rpc-guards";
import { loadConfig } from "../src/config/env";
import { assertAmountWithinCap, assertPaymentsAllowed } from "../src/config/limits";
import { HttpError } from "../src/http/envelope";

const sandboxBase = {
  NODE_ENV: "sandbox" as const,
  PORT: "4000",
  DATABASE_URL: "postgresql://cryptochain:cryptochain@localhost:5433/cryptochain_sandbox",
  SEPOLIA_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  SEPOLIA_PRIVATE_KEY: "0x".padEnd(66, "a"),
  STRIPE_TEST_SECRET_KEY: "sk_test_x",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_x",
  CORS_ORIGIN: "http://localhost:8080",
};

const productionBase = {
  NODE_ENV: "production" as const,
  PORT: "4000",
  DATABASE_URL: "postgresql://cryptochain:cryptochain@prod.example:5432/cryptochain",
  MAINNET_RPC_URL: "https://eth-mainnet.g.alchemy.com/v2/demo",
  MAINNET_PRIVATE_KEY: `0x${"ab".repeat(32)}`,
  STRIPE_LIVE_SECRET_KEY: "sk_live_x",
  STRIPE_LIVE_WEBHOOK_SECRET: "whsec_live_x",
  CORS_ORIGIN: "https://merchant.example",
  MAX_TRANSACTION_AMOUNT: "0.05",
};

describe("loadConfig", () => {
  it("fails fast with a list of missing variables", () => {
    expect(() => loadConfig({ NODE_ENV: "sandbox" })).toThrow(
      /Invalid environment configuration[\s\S]*DATABASE_URL is missing/,
    );
  });

  it("defaults sandbox confirmations to 3 and a 1 ETH cap", () => {
    const cfg = loadConfig(sandboxBase);
    expect(cfg.NODE_ENV).toBe("sandbox");
    expect(cfg.REQUIRED_CONFIRMATIONS).toBe(3);
    expect(cfg.MAX_TRANSACTION_AMOUNT).toBe("1");
    expect(cfg.PAYMENTS_ENABLED).toBe(true);
    expect(cfg.network).toBe("sepolia");
    expect(cfg.chainId).toBe(11155111);
  });

  it("defaults production confirmations to 12, cap required, payments off", () => {
    const cfg = loadConfig(productionBase);
    expect(cfg.NODE_ENV).toBe("production");
    expect(cfg.REQUIRED_CONFIRMATIONS).toBe(12);
    expect(cfg.MAX_TRANSACTION_AMOUNT).toBe("0.05");
    expect(cfg.PAYMENTS_ENABLED).toBe(false);
    expect(cfg.network).toBe("mainnet");
    expect(cfg.chainId).toBe(1);
  });

  it("refuses Sepolia RPC and test Stripe names in production", () => {
    expect(() =>
      loadConfig({
        ...productionBase,
        MAINNET_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
      }),
    ).toThrow(/TESTNET RPC URL WHILE NODE_ENV=production/);

    expect(() =>
      loadConfig({
        ...productionBase,
        STRIPE_TEST_SECRET_KEY: "sk_test_leaked",
      }),
    ).toThrow(/STRIPE_TEST_SECRET_KEY must not be set in production/);
  });

  it("refuses the published sandbox throwaway key as MAINNET_PRIVATE_KEY", () => {
    expect(() =>
      loadConfig({
        ...productionBase,
        MAINNET_PRIVATE_KEY: "0xe2e495a30f85661a44f619e3bd6e4a91b407435e18d4caa6d1d1ec7315f23640",
      }),
    ).toThrow(/SANDBOX THROWAWAY KEY IN PRODUCTION/);
  });

  it("requires MAX_TRANSACTION_AMOUNT in production", () => {
    expect(() => loadConfig({ ...productionBase, MAX_TRANSACTION_AMOUNT: "" })).toThrow(
      /MAX_TRANSACTION_AMOUNT/,
    );
  });
});

describe("RPC guards", () => {
  it("throws a loud error when a mainnet RPC is used in sandbox", () => {
    expect(() =>
      assertSandboxRpcUrl("https://eth-mainnet.g.alchemy.com/v2/demo", "sandbox"),
    ).toThrow(/REFUSING TO LOAD A MAINNET RPC URL WHILE NODE_ENV=sandbox/);
  });

  it("rejects a mainnet SEPOLIA_RPC_URL at config load", () => {
    expect(() =>
      loadConfig({
        ...sandboxBase,
        SEPOLIA_RPC_URL: "https://mainnet.infura.io/v3/demo",
      }),
    ).toThrow(/must be a Sepolia RPC URL, not mainnet/);
  });

  it("rejects a testnet MAINNET_RPC_URL", () => {
    expect(() => assertProductionRpcUrl("https://sepolia.infura.io/v3/demo", "production")).toThrow(
      /TESTNET RPC URL WHILE NODE_ENV=production/,
    );
  });
});

describe("server-side amount cap", () => {
  it("allows amounts at or under the cap", () => {
    const cfg = loadConfig(productionBase);
    expect(assertAmountWithinCap("0.05", cfg).toString()).toBe("50000000000000000");
    expect(assertAmountWithinCap("0.01", cfg) < assertAmountWithinCap("0.05", cfg)).toBe(true);
  });

  it("rejects amounts above MAX_TRANSACTION_AMOUNT", () => {
    const cfg = loadConfig(productionBase);
    try {
      assertAmountWithinCap("0.06", cfg);
      throw new Error("expected HttpError");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toMatch(/MAX_TRANSACTION_AMOUNT \(0\.05 ETH\)/);
    }
  });

  it("blocks new intents when PAYMENTS_ENABLED is false", () => {
    const cfg = loadConfig(productionBase);
    expect(() => assertPaymentsAllowed(cfg)).toThrow(HttpError);
  });
});
