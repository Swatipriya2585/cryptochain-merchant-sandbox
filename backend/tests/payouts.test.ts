import { PaymentStatus } from "@prisma/client";
import request from "supertest";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { config } from "../src/config/env";
import { prisma } from "../src/lib/prisma";
import { ensureMerchant } from "../src/services/merchants";

describe("Stripe test-mode payouts", () => {
  const merchantId = "merchant_payout_test";
  let confirmedIntentId = "";
  let pendingIntentId = "";
  let payoutId = "";

  beforeAll(async () => {
    await prisma.payout.deleteMany({ where: { merchantId } });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await ensureMerchant(merchantId);

    const confirmed = await prisma.paymentIntent.create({
      data: {
        merchantId,
        amountRequestedCrypto: "0.01",
        currencyCrypto: "ETH",
        expectedAddress: "0x00000000000000000000000000000000000000ee",
        reference: `payout_ok_${Date.now()}`,
        status: PaymentStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    confirmedIntentId = confirmed.id;

    const pending = await prisma.paymentIntent.create({
      data: {
        merchantId,
        amountRequestedCrypto: "0.02",
        currencyCrypto: "ETH",
        expectedAddress: "0x00000000000000000000000000000000000000ef",
        reference: `payout_pending_${Date.now()}`,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    pendingIntentId = pending.id;
  });

  afterAll(async () => {
    await prisma.payout.deleteMany({ where: { merchantId } });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it("refuses payouts unless the payment intent is CONFIRMED", async () => {
    const response = await request(app).post("/api/payouts").send({
      paymentIntentId: pendingIntentId,
      amountFiat: "100.00",
    });
    expect(response.status).toBe(409);
  });

  it("creates a PENDING payout and pays it via simulate-stripe-event", async () => {
    const created = await request(app).post("/api/payouts").send({
      paymentIntentId: confirmedIntentId,
      amountFiat: "1500.00",
      currencyFiat: "INR",
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("PENDING");
    expect(created.body.currencyFiat).toBe("INR");
    expect(created.body.simulated).toBe(true);
    payoutId = created.body.id;

    const simulated = await request(app)
      .post(`/api/payouts/${payoutId}/simulate-stripe-event`)
      .send({ type: "payout.paid" });
    expect(simulated.status).toBe(200);
    expect(simulated.body.status).toBe("PAID");
    expect(simulated.body.stripePayoutId).toMatch(/^po_test_/);
  });

  it("accepts a signed Stripe payout.paid webhook and updates the payout", async () => {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: "PENDING", paidAt: null, lastStripeEventType: null },
    });

    const payload = JSON.stringify({
      id: "evt_test_webhook_payout_paid",
      object: "event",
      type: "payout.paid",
      data: {
        object: {
          id: "po_test_from_webhook",
          object: "payout",
          metadata: { payoutId },
        },
      },
    });

    const secret = config.NODE_ENV === "sandbox" ? config.STRIPE_TEST_WEBHOOK_SECRET : "whsec_test";
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });

    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", header)
      .set("content-type", "application/json")
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.type).toBe("payout.paid");
    expect(response.body.payout.status).toBe("PAID");
    expect(response.body.payout.stripePayoutId).toBe("po_test_from_webhook");
  });

  it("rejects Stripe webhooks with a bad signature", async () => {
    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .set("content-type", "application/json")
      .send("{}");
    expect(response.status).toBe(400);
  });
});
