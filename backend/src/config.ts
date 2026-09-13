import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function repoRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

function loadEnv(): void {
  const sandboxPath = path.join(repoRoot(), ".env.sandbox");
  if (fs.existsSync(sandboxPath)) {
    dotenv.config({ path: sandboxPath });
  }
}

loadEnv();

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  sepoliaRpcUrl: string;
  sepoliaPrivateKey: string;
  stripeTestSecretKey: string;
  stripeTestWebhookSecret: string;
};

export function getConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? "sandbox",
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: process.env.DATABASE_URL ?? "",
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL ?? "",
    sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY ?? "",
    stripeTestSecretKey: process.env.STRIPE_TEST_SECRET_KEY ?? "",
    stripeTestWebhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET ?? "",
  };
}
