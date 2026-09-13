import { createServer, type AddressInfo } from "node:http";
import { PaymentStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { ensureMerchant } from "../src/services/merchants";
import { createFakeWebhookEvent } from "../src/webhooks/trigger-event";
import { WEBHOOK_SIGNATURE_HEADER } from "../src/webhooks/signature";

describe("webhook event HTTP API", () => {
  const merchantId = "merchant_webhook_http_test";
  const secret = "whsec_http_replay_secret_value";
  const received: Array<{ body: string; signature: string | undefined }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      received.push({
        body: Buffer.concat(chunks).toString("utf8"),
        signature: req.headers[WEBHOOK_SIGNATURE_HEADER] as string | undefined,
      });
      res.statusCode = 200;
      res.end("ok");
    });
  });

  let intentId = "";
  let webhookUrl = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    webhookUrl = `http://127.0.0.1:${port}/hooks`;

    await prisma.webhookEvent.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.auditLog.deleteMany({ where: { paymentIntent: { merchantId } } });
    await prisma.paymentIntent.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });

    await ensureMerchant(merchantId, { webhookUrl, webhookSecret: secret });
    const intent = await prisma.paymentIntent.create({
      data: {
        merchantId,
        amountRequestedCrypto: "0.02",
        currencyCrypto: "ETH",
        expectedAddress: "0x00000000000000000000000000000000000000cc",
        reference: `http_${Date.now()}`,
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
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("lists delivery history and replays a webhook", async () => {
    received.length = 0;
    const event = await createFakeWebhookEvent({
      paymentIntentId: intentId,
      type: "payment_intent.underpaid",
      dispatch: false,
      updateIntent: false,
    });

    const listed = await request(app).get("/api/webhook-events").query({
      merchantId,
      status: "pending",
    });
    expect(listed.status).toBe(200);
    expect(listed.body.events.some((row: { id: string }) => row.id === event.id)).toBe(true);

    const replay = await request(app).post(`/api/webhook-events/${event.id}/replay`);
    expect(replay.status).toBe(200);
    expect(replay.body.delivered).toBe(true);
    expect(replay.body.event.deliveredSuccessfully).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]?.signature).toBeTruthy();

    const succeededList = await request(app).get("/api/webhook-events").query({
      merchantId,
      status: "underpaid",
    });
    expect(succeededList.status).toBe(200);
    expect(succeededList.body.events[0]?.eventType).toBe("payment_intent.underpaid");
  });
});
