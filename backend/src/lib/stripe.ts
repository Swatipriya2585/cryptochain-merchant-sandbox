import Stripe from "stripe";
import { config } from "../config/env";

/**
 * Sandbox Stripe client — test-mode secret only.
 * Live keys and Connect transfers belong on the other side of CUTOVER_CHECKLIST.md.
 */
export function getStripeTestSecretKey(): string {
  if (config.NODE_ENV !== "sandbox") {
    throw new Error("Stripe test-mode client is only available when NODE_ENV=sandbox.");
  }
  const key = config.STRIPE_TEST_SECRET_KEY;
  if (key.startsWith("sk_live_")) {
    throw new Error(
      "REFUSING TO INIT STRIPE: sandbox received a live secret key (sk_live_…). Use sk_test_… only.",
    );
  }
  return key;
}

export function getStripeLiveSecretKey(): string {
  if (config.NODE_ENV !== "production") {
    throw new Error("Stripe live client is only available when NODE_ENV=production.");
  }
  const key = config.STRIPE_LIVE_SECRET_KEY;
  if (!key.startsWith("sk_live_")) {
    throw new Error(
      "REFUSING TO INIT STRIPE: production received a non-live secret key. Use sk_live_… only.",
    );
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  if (config.NODE_ENV === "sandbox") {
    return config.STRIPE_TEST_WEBHOOK_SECRET;
  }
  return config.STRIPE_LIVE_WEBHOOK_SECRET;
}

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    const secret =
      config.NODE_ENV === "sandbox" ? getStripeTestSecretKey() : getStripeLiveSecretKey();
    client = new Stripe(secret);
  }
  return client;
}
