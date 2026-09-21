import { createHash, randomBytes } from "node:crypto";
import { config } from "../config/env";

export type ApiKeyPrefix = "sandbox_" | "live_";

export function apiKeyPrefix(): ApiKeyPrefix {
  return config.NODE_ENV === "production" ? "live_" : "sandbox_";
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateMerchantApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${apiKeyPrefix()}${randomBytes(24).toString("hex")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function apiKeyLooksValid(value: string): boolean {
  return value.startsWith("sandbox_") || value.startsWith("live_");
}
