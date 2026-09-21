import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("POST /api/payment-intents", () => {
  afterAll(async () => {
    await prisma.paymentIntent.deleteMany({ where: { merchantId: "merchant_api_test" } });
  });

  it("creates a PENDING intent with a QR-ready payment URI", async () => {
    const response = await request(app).post("/api/payment-intents").send({
      merchantId: "merchant_api_test",
      amountRequestedCrypto: "0.01",
      currencyCrypto: "ETH",
      expiresInMinutes: 20,
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("PENDING");
    expect(response.body.expectedAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(response.body.paymentUri).toMatch(/^ethereum:0x[0-9a-fA-F]{40}@11155111\?value=/);
    expect(response.body.network).toBe("sepolia");
  });

  it("rejects amounts above MAX_TRANSACTION_AMOUNT even if the client asks", async () => {
    const response = await request(app).post("/api/payment-intents").send({
      merchantId: "merchant_api_test",
      amountRequestedCrypto: "2",
      currencyCrypto: "ETH",
      expiresInMinutes: 20,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/MAX_TRANSACTION_AMOUNT/);
  });
});
