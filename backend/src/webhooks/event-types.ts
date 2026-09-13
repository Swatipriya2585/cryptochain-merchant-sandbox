import { PaymentStatus } from "@prisma/client";

export const WEBHOOK_EVENT_TYPES = [
  "payment_intent.succeeded",
  "payment_intent.underpaid",
  "payment_intent.overpaid",
  "payment_intent.expired",
  "payment_intent.pending",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function eventTypeForStatus(status: PaymentStatus): WebhookEventType {
  switch (status) {
    case PaymentStatus.CONFIRMED:
      return "payment_intent.succeeded";
    case PaymentStatus.UNDERPAID:
      return "payment_intent.underpaid";
    case PaymentStatus.OVERPAID:
      return "payment_intent.overpaid";
    case PaymentStatus.EXPIRED:
      return "payment_intent.expired";
    default:
      return "payment_intent.pending";
  }
}

export function statusForEventType(eventType: string): PaymentStatus | undefined {
  switch (normalizeEventType(eventType)) {
    case "payment_intent.succeeded":
      return PaymentStatus.CONFIRMED;
    case "payment_intent.underpaid":
      return PaymentStatus.UNDERPAID;
    case "payment_intent.overpaid":
      return PaymentStatus.OVERPAID;
    case "payment_intent.expired":
      return PaymentStatus.EXPIRED;
    case "payment_intent.pending":
      return PaymentStatus.PENDING;
    default:
      return undefined;
  }
}

export function normalizeEventType(eventType: string): string {
  const trimmed = eventType.trim().toLowerCase();
  if (trimmed.startsWith("payment_intent.")) {
    if (trimmed === "payment_intent.confirmed") {
      return "payment_intent.succeeded";
    }
    return trimmed;
  }
  if (trimmed === "confirmed" || trimmed === "succeeded") {
    return "payment_intent.succeeded";
  }
  return `payment_intent.${trimmed}`;
}

export function isWebhookEventType(eventType: string): eventType is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(normalizeEventType(eventType));
}
