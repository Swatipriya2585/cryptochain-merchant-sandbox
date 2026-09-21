import { PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { ensureMerchant } from "../src/services/merchants";
import { createFakeWebhookEvent, parseTriggerArgs } from "../src/webhooks/trigger-event";

describe("sandbox:trigger-event", () => {
  const merchantId = "merchant_trigger_test";
  let intentId = "";

  beforeAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.auditLog.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await ensureMerchant(merchantId);
    const intent = await prisma.paymentIntent.create({
      data: {
        merchantId,
        amountRequestedCrypto: "0.03",
        currencyCrypto: "ETH",
        expectedAddress: "0x00000000000000000000000000000000000000dd",
        reference: `trig_${Date.now()}`,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    intentId = intent.id;
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.auditLog.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it("creates a fake succeeded event for a payment intent", async () => {
    const parsed = parseTriggerArgs([
      "--paymentIntentId",
      intentId,
      "--type",
      "payment_intent.succeeded",
    ]);
    const event = await createFakeWebhookEvent({ ...parsed, dispatch: false });
    expect(event.eventType).toBe("payment_intent.succeeded");

    const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    expect(intent.status).toBe(PaymentStatus.CONFIRMED);
  });
});
