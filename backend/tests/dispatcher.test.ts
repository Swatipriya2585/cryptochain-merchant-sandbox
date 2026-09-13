import { PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { ensureMerchant } from "../src/services/merchants";
import {
  deliverWebhookEvent,
  WEBHOOK_RETRY_DELAYS_MS,
  type FetchLike,
} from "../src/webhooks/dispatcher";
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from "../src/webhooks/signature";

describe("webhook dispatcher", () => {
  const merchantId = "merchant_dispatcher_test";
  const secret = "whsec_dispatcher_test_secret_value";
  let intentId = "";
  let eventId = "";

  beforeAll(async () => {
    await prisma.webhookEvent.deleteMany({
      where: { paymentIntent: { merchantId } },
    });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });

    await ensureMerchant(merchantId, {
      webhookUrl: "https://merchant.example.test/webhooks",
      webhookSecret: secret,
    });
    const intent = await prisma.paymentIntent.create({
      data: {
        merchantId,
        amountRequestedCrypto: "0.01",
        currencyCrypto: "ETH",
        expectedAddress: "0x00000000000000000000000000000000000000bb",
        reference: `disp_${Date.now()}`,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    intentId = intent.id;
    const event = await prisma.webhookEvent.create({
      data: {
        paymentIntentId: intentId,
        eventType: "payment_intent.succeeded",
        payload: { paymentIntentId: intentId, merchantId },
      },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { paymentIntentId: intentId } });
    await prisma.paymentIntent.deleteMany({ where: { id: intentId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it("POSTs a Stripe-style signed payload and marks the event delivered", async () => {
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
    const fetchMock: FetchLike = async (url, init) => {
      calls.push({ url, body: init.body, headers: init.headers });
      return { status: 200, ok: true };
    };

    const delivered = await deliverWebhookEvent(eventId, {
      fetch: fetchMock,
      wait: async () => {},
    });
    expect(delivered).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://merchant.example.test/webhooks");

    const signature = calls[0]?.headers[WEBHOOK_SIGNATURE_HEADER] ?? "";
    expect(verifyWebhookSignature(secret, calls[0]?.body ?? "", signature)).toBe(true);

    const updated = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(updated.deliveredSuccessfully).toBe(true);
    expect(updated.attempts).toBe(1);
    expect(updated.lastHttpStatus).toBe(200);
  });

  it("retries on non-2xx with the sandbox backoff schedule", async () => {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        deliveredSuccessfully: false,
        attempts: 0,
        lastHttpStatus: null,
        lastError: null,
      },
    });

    const waits: number[] = [];
    let n = 0;
    const fetchMock: FetchLike = async () => {
      n += 1;
      if (n < 3) {
        return { status: 500, ok: false };
      }
      return { status: 200, ok: true };
    };

    const delivered = await deliverWebhookEvent(eventId, {
      fetch: fetchMock,
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    expect(delivered).toBe(true);
    expect(n).toBe(3);
    expect(waits).toEqual([WEBHOOK_RETRY_DELAYS_MS[1], WEBHOOK_RETRY_DELAYS_MS[2]]);

    const updated = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(updated.attempts).toBe(3);
    expect(updated.deliveredSuccessfully).toBe(true);
  });
});
