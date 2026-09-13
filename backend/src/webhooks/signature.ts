import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "cryptochain-signature";

/**
 * Stripe-compatible signature: HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
 * Header value: `t=<unix>,v1=<hex>`.
 */
export function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export function parseSignatureHeader(header: string): { timestamp: number; v1: string } | null {
  const parts = Object.fromEntries(
    header.split(",").map((part) => part.trim().split("=", 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(timestamp) || !v1) {
    return null;
  }
  return { timestamp, v1 };
}

export function verifyWebhookSignature(secret: string, rawBody: string, header: string): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return false;
  }
  const expected = signWebhookPayload(secret, rawBody, parsed.timestamp);
  const expectedV1 = parseSignatureHeader(expected)?.v1;
  if (!expectedV1) {
    return false;
  }
  const a = Buffer.from(parsed.v1, "hex");
  const b = Buffer.from(expectedV1, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
