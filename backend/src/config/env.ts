import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { parseEther } from "ethers";
import { z } from "zod";
import { assertProductionRpcUrl, isMainnetRpcUrl } from "../blockchain/rpc-guards";

/** Published sandbox throwaway — never allowed as a production signer. */
const SANDBOX_THROWAWAY_SIGNER_KEY =
  "0xe2e495a30f85661a44f619e3bd6e4a91b407435e18d4caa6d1d1ec7315f23640";

export const SEPOLIA_CHAIN_ID = 11155111;
export const MAINNET_CHAIN_ID = 1;

function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    if (
      fs.existsSync(path.join(dir, ".env.sandbox")) ||
      fs.existsSync(path.join(dir, ".env.production.example"))
    ) {
      return dir;
    }
    dir = path.resolve(dir, "..");
  }
  return path.resolve(__dirname, "../../..");
}

function loadEnvFile(): void {
  const sandboxPath = path.join(findRepoRoot(), ".env.sandbox");
  if (!fs.existsSync(sandboxPath) || process.env.NODE_ENV === "production") {
    return;
  }

  // Vitest sets NODE_ENV=test; still load sandbox secrets and pin mode to sandbox.
  // GitHub Actions sets CI=true and injects DATABASE_URL for the service container
  // (port 5432). Do not let .env.sandbox (host port 5433) override those values.
  const runningTests = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const overrideFromFile = runningTests && process.env.CI !== "true";
  dotenv.config({ path: sandboxPath, override: overrideFromFile });
  if (runningTests) {
    process.env.NODE_ENV = "sandbox";
  }
}

const corsOriginSchema = z
  .string()
  .min(1, "is missing")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .refine((origins) => origins.length > 0, "must include at least one origin");

const boolEnv = (defaultValue: boolean) =>
  z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return defaultValue;
      }
      return value === "true" || value === "1";
    });

const optionalHttpsUrl = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length === 0 ? undefined : trimmed;
  })
  .refine(
    (value) => value === undefined || /^https:\/\//i.test(value),
    "must be an https URL (Slack or Discord incoming webhook)",
  );

function positiveEthAmount(message: string) {
  return z
    .string()
    .min(1, "is missing")
    .refine((value) => {
      try {
        return parseEther(value.trim()) > 0n;
      } catch {
        return false;
      }
    }, message)
    .transform((value) => value.trim());
}

const watcherFields = (confirmationsDefault: number) => ({
  REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(confirmationsDefault),
  PAYMENT_TOLERANCE_PERCENT: z.coerce.number().min(0).default(1),
  WATCHER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
});

const sandboxSchema = z.object({
  NODE_ENV: z.literal("sandbox"),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1, "is missing"),
  SEPOLIA_RPC_URL: z
    .string()
    .min(1, "is missing")
    .refine((url) => !isMainnetRpcUrl(url), "must be a Sepolia RPC URL, not mainnet"),
  SEPOLIA_PRIVATE_KEY: z.string().min(1, "is missing"),
  STRIPE_TEST_SECRET_KEY: z
    .string()
    .min(1, "is missing")
    .refine((key) => !key.startsWith("sk_live_"), "must be a Stripe test key (sk_test_), not live"),
  STRIPE_TEST_WEBHOOK_SECRET: z.string().min(1, "is missing"),
  CORS_ORIGIN: corsOriginSchema,
  MAX_TRANSACTION_AMOUNT: positiveEthAmount(
    "must be a positive ETH amount (server-side cap)",
  ).default("1"),
  PAYMENTS_ENABLED: boolEnv(true),
  ALERT_WEBHOOK_URL: optionalHttpsUrl,
  ...watcherFields(3),
});

const productionSchema = z.object({
  NODE_ENV: z.literal("production"),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1, "is missing"),
  MAINNET_RPC_URL: z.string().min(1, "is missing"),
  MAINNET_PRIVATE_KEY: z.string().min(1, "is missing"),
  STRIPE_LIVE_SECRET_KEY: z
    .string()
    .min(1, "is missing")
    .refine((key) => key.startsWith("sk_live_"), "must be a Stripe live key (sk_live_)"),
  STRIPE_LIVE_WEBHOOK_SECRET: z.string().min(1, "is missing"),
  CORS_ORIGIN: corsOriginSchema,
  MAX_TRANSACTION_AMOUNT: positiveEthAmount(
    "must be a positive ETH amount — required in production so a bug cannot drain uncapped funds",
  ),
  PAYMENTS_ENABLED: boolEnv(false),
  ALERT_WEBHOOK_URL: optionalHttpsUrl,
  ...watcherFields(12),
});

function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path[0]?.toString() ?? "unknown";
    if (issue.code === "invalid_type" && "received" in issue && issue.received === "undefined") {
      return `  - ${name} is missing`;
    }
    if (issue.code === "invalid_literal" || issue.code === "invalid_enum_value") {
      return `  - ${name}: ${issue.message}`;
    }
    return `  - ${name}: ${issue.message}`;
  });
  const unique = [...new Set(lines)];
  return `Invalid environment configuration. Fix the following:\n${unique.join("\n")}`;
}

function normalizePrivateKey(key: string): string {
  const trimmed = key.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`).toLowerCase();
}

function assertProductionDoesNotLeakSandbox(env: NodeJS.ProcessEnv): void {
  const leaks: string[] = [];
  if (env.SEPOLIA_RPC_URL) {
    leaks.push("SEPOLIA_RPC_URL must not be set in production (use MAINNET_RPC_URL)");
  }
  if (env.STRIPE_TEST_SECRET_KEY) {
    leaks.push("STRIPE_TEST_SECRET_KEY must not be set in production (use STRIPE_LIVE_SECRET_KEY)");
  }
  if (env.STRIPE_TEST_WEBHOOK_SECRET) {
    leaks.push(
      "STRIPE_TEST_WEBHOOK_SECRET must not be set in production (use STRIPE_LIVE_WEBHOOK_SECRET)",
    );
  }
  if (env.SEPOLIA_PRIVATE_KEY && !env.MAINNET_PRIVATE_KEY) {
    leaks.push(
      "SEPOLIA_PRIVATE_KEY is not valid in production. Set MAINNET_PRIVATE_KEY from a secrets manager (do not paste a key into chat).",
    );
  } else if (env.SEPOLIA_PRIVATE_KEY) {
    leaks.push("SEPOLIA_PRIVATE_KEY must not be set in production (use MAINNET_PRIVATE_KEY only)");
  }
  if (leaks.length > 0) {
    throw new Error(
      `Invalid environment configuration. Sandbox values leaked into production:\n${leaks
        .map((line) => `  - ${line}`)
        .join("\n")}`,
    );
  }
}

function assertProductionSignerIsNotThrowaway(key: string): void {
  if (normalizePrivateKey(key) === SANDBOX_THROWAWAY_SIGNER_KEY) {
    throw new Error(
      [
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        "REFUSING TO LOAD THE SANDBOX THROWAWAY KEY IN PRODUCTION.",
        "MAINNET_PRIVATE_KEY matches the published Sepolia test wallet.",
        "Provision a new dedicated mainnet signer in a secrets manager.",
        "Do not paste that key into chat or commit it to git.",
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
      ].join("\n"),
    );
  }
}

type WatcherConfig = {
  REQUIRED_CONFIRMATIONS: number;
  PAYMENT_TOLERANCE_PERCENT: number;
  WATCHER_POLL_INTERVAL_MS: number;
};

type SharedRuntime = WatcherConfig & {
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGIN: string[];
  MAX_TRANSACTION_AMOUNT: string;
  PAYMENTS_ENABLED: boolean;
  ALERT_WEBHOOK_URL?: string;
};

export type SandboxConfig = SharedRuntime & {
  NODE_ENV: "sandbox";
  SEPOLIA_RPC_URL: string;
  SEPOLIA_PRIVATE_KEY: string;
  STRIPE_TEST_SECRET_KEY: string;
  STRIPE_TEST_WEBHOOK_SECRET: string;
  mode: "sandbox";
  chain: "Sepolia";
  network: "sepolia";
  chainId: typeof SEPOLIA_CHAIN_ID;
};

export type ProductionConfig = SharedRuntime & {
  NODE_ENV: "production";
  MAINNET_RPC_URL: string;
  MAINNET_PRIVATE_KEY: string;
  STRIPE_LIVE_SECRET_KEY: string;
  STRIPE_LIVE_WEBHOOK_SECRET: string;
  mode: "production";
  chain: "Mainnet";
  network: "mainnet";
  chainId: typeof MAINNET_CHAIN_ID;
};

export type Config = SandboxConfig | ProductionConfig;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv !== "sandbox" && nodeEnv !== "production") {
    throw new Error(
      `Invalid environment configuration. Fix the following:\n  - NODE_ENV is missing or invalid (must be "sandbox" or "production", received "${nodeEnv ?? ""}")`,
    );
  }

  if (nodeEnv === "sandbox") {
    const parsed = sandboxSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(formatEnvError(parsed.error));
    }
    return {
      ...parsed.data,
      mode: "sandbox",
      chain: "Sepolia",
      network: "sepolia",
      chainId: SEPOLIA_CHAIN_ID,
    };
  }

  assertProductionDoesNotLeakSandbox(env);
  const parsed = productionSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }
  assertProductionRpcUrl(parsed.data.MAINNET_RPC_URL, "production");
  assertProductionSignerIsNotThrowaway(parsed.data.MAINNET_PRIVATE_KEY);
  return {
    ...parsed.data,
    mode: "production",
    chain: "Mainnet",
    network: "mainnet",
    chainId: MAINNET_CHAIN_ID,
  };
}

export function getSignerPrivateKey(cfg: Config = config): string {
  return cfg.NODE_ENV === "sandbox" ? cfg.SEPOLIA_PRIVATE_KEY : cfg.MAINNET_PRIVATE_KEY;
}

export function getRpcUrl(cfg: Config = config): string {
  return cfg.NODE_ENV === "sandbox" ? cfg.SEPOLIA_RPC_URL : cfg.MAINNET_RPC_URL;
}

loadEnvFile();
export const config = loadConfig();
