import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from "./signature";

/** Immediate, +30s, +5min — three attempts total. */
export const WEBHOOK_RETRY_DELAYS_MS = [0, 30_000, 5 * 60_000] as const;

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ status: number; ok: boolean }>;

export type DispatcherDeps = {
  fetch?: FetchLike;
  wait?: (ms: number) => Promise<void>;
  now?: () => Date;
};

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function safeUpdateWebhookEvent(
  eventId: string,
  data: {
    attempts?: { increment: number };
    deliveredSuccessfully?: boolean;
    lastAttemptAt?: Date | null;
    lastHttpStatus?: number | null;
    lastError?: string | null;
    nextAttemptAt?: Date | null;
  },
): Promise<void> {
  await prisma.webhookEvent.updateMany({ where: { id: eventId }, data });
}

function buildOutboundEvent(event: {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}) {
  return {
    id: event.id,
    object: "event" as const,
    type: event.eventType,
    created: Math.floor(event.createdAt.getTime() / 1000),
    livemode: false,
    data: {
      object: event.payload,
    },
  };
}

async function attemptDelivery(
  eventId: string,
  deps: DispatcherDeps = {},
): Promise<"delivered" | "retry" | "fatal"> {
  const now = deps.now ?? (() => new Date());
  const fetchImpl: FetchLike =
    deps.fetch ??
    (async (url, init) => {
      const response = await fetch(url, init);
      return { status: response.status, ok: response.ok };
    });

  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    include: {
      paymentIntent: {
        include: { merchant: true },
      },
    },
  });

  if (!event) {
    logger.warn({ eventId }, "webhook event missing; skipping delivery");
    return "fatal";
  }

  const merchant = event.paymentIntent.merchant;
  const timestamp = Math.floor(now().getTime() / 1000);
  const rawBody = JSON.stringify(buildOutboundEvent(event));

  if (!merchant.webhookUrl) {
    await safeUpdateWebhookEvent(eventId, {
      attempts: { increment: 1 },
      deliveredSuccessfully: false,
      lastAttemptAt: now(),
      lastHttpStatus: null,
      lastError: "merchant webhookUrl is not set",
      nextAttemptAt: null,
    });
    return "fatal";
  }

  const signature = signWebhookPayload(merchant.webhookSecret, rawBody, timestamp);

  try {
    const response = await fetchImpl(merchant.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signature,
        "stripe-signature": signature,
        "cryptochain-event-id": event.id,
      },
      body: rawBody,
    });

    const success = response.ok || (response.status >= 200 && response.status < 300);
    await safeUpdateWebhookEvent(eventId, {
      attempts: { increment: 1 },
      deliveredSuccessfully: success,
      lastAttemptAt: now(),
      lastHttpStatus: response.status,
      lastError: success ? null : `endpoint returned HTTP ${response.status}`,
      nextAttemptAt: null,
    });
    return success ? "delivered" : "retry";
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook POST failed";
    await safeUpdateWebhookEvent(eventId, {
      attempts: { increment: 1 },
      deliveredSuccessfully: false,
      lastAttemptAt: now(),
      lastHttpStatus: null,
      lastError: message,
      nextAttemptAt: null,
    });
    return "retry";
  }
}

export async function deliverWebhookEvent(
  eventId: string,
  deps: DispatcherDeps = {},
): Promise<boolean> {
  const wait = deps.wait ?? defaultWait;

  for (let index = 0; index < WEBHOOK_RETRY_DELAYS_MS.length; index += 1) {
    const delay = WEBHOOK_RETRY_DELAYS_MS[index] ?? 0;
    if (delay > 0) {
      const nextAt = new Date((deps.now?.().getTime() ?? Date.now()) + delay);
      await safeUpdateWebhookEvent(eventId, { nextAttemptAt: nextAt });
      await wait(delay);
    }

    const result = await attemptDelivery(eventId, deps);
    if (result === "delivered") {
      logger.info({ eventId }, "webhook delivered");
      return true;
    }
    if (result === "fatal") {
      return false;
    }

    const nextDelay = WEBHOOK_RETRY_DELAYS_MS[index + 1];
    if (nextDelay) {
      logger.warn({ eventId, nextDelayMs: nextDelay }, "webhook delivery will retry");
    }
  }

  logger.warn({ eventId }, "webhook delivery exhausted retries");
  return false;
}

export async function replayWebhookEvent(
  eventId: string,
  deps: DispatcherDeps = {},
): Promise<boolean> {
  const result = await attemptDelivery(eventId, deps);
  return result === "delivered";
}

export function enqueueWebhookDelivery(eventId: string, deps: DispatcherDeps = {}): void {
  void deliverWebhookEvent(eventId, deps).catch((error) => {
    logger.error({ err: error, eventId }, "webhook delivery crashed");
  });
}
