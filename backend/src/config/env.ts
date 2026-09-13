import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { isMainnetRpcUrl } from "../blockchain/rpc-guards";

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
  const runningTests = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  dotenv.config({ path: sandboxPath, override: runningTests });
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

const watcherDefaults = {
  REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(3),
  PAYMENT_TOLERANCE_PERCENT: z.coerce.number().min(0).default(1),
  WATCHER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
};

const sandboxSchema = z.object({
  NODE_ENV: z.literal("sandbox"),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1, "is missing"),
  SEPOLIA_RPC_URL: z
    .string()
    .min(1, "is missing")
    .refine((url) => !isMainnetRpcUrl(url), "must be a Sepolia RPC URL, not mainnet"),
  SEPOLIA_PRIVATE_KEY: z.string().min(1, "is missing"),
  STRIPE_TEST_SECRET_KEY: z.string().min(1, "is missing"),
  STRIPE_TEST_WEBHOOK_SECRET: z.string().min(1, "is missing"),
  CORS_ORIGIN: corsOriginSchema,
  ...watcherDefaults,
});

const productionSchema = z.object({
  NODE_ENV: z.literal("production"),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1, "is missing"),
  MAINNET_RPC_URL: z.string().min(1, "is missing"),
  SEPOLIA_PRIVATE_KEY: z.string().min(1, "is missing"),
  STRIPE_LIVE_SECRET_KEY: z.string().min(1, "is missing"),
  STRIPE_TEST_WEBHOOK_SECRET: z.string().min(1, "is missing"),
  CORS_ORIGIN: corsOriginSchema,
  ...watcherDefaults,
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

type WatcherConfig = {
  REQUIRED_CONFIRMATIONS: number;
  PAYMENT_TOLERANCE_PERCENT: number;
  WATCHER_POLL_INTERVAL_MS: number;
};

export type SandboxConfig = WatcherConfig & {
  NODE_ENV: "sandbox";
  PORT: number;
  DATABASE_URL: string;
  SEPOLIA_RPC_URL: string;
  SEPOLIA_PRIVATE_KEY: string;
  STRIPE_TEST_SECRET_KEY: string;
  STRIPE_TEST_WEBHOOK_SECRET: string;
  CORS_ORIGIN: string[];
  mode: "sandbox";
  chain: "Sepolia";
};

export type ProductionConfig = WatcherConfig & {
  NODE_ENV: "production";
  PORT: number;
  DATABASE_URL: string;
  MAINNET_RPC_URL: string;
  SEPOLIA_PRIVATE_KEY: string;
  STRIPE_LIVE_SECRET_KEY: string;
  STRIPE_TEST_WEBHOOK_SECRET: string;
  CORS_ORIGIN: string[];
  mode: "production";
  chain: "Mainnet";
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
    };
  }

  const parsed = productionSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }
  return {
    ...parsed.data,
    mode: "production",
    chain: "Mainnet",
  };
}

loadEnvFile();
export const config = loadConfig();
