import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import {
  SANDBOX_SEED_API_KEY,
  SANDBOX_SEED_MERCHANT_ID,
  seedSandbox,
} from "../src/db/seed-sandbox";

const auth = { "x-api-key": SANDBOX_SEED_API_KEY };

describe("GET /api/v1 Flutter REST surface (seeded sandbox data)", () => {
  beforeEach(async () => {
    await seedSandbox();
  });

  it("returns the seeded merchant profile", async () => {
    const response = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.error).toBeNull();
    expect(response.body.data).toMatchObject({
      id: SANDBOX_SEED_MERCHANT_ID,
      apiKeyPrefix: "sandbox_",
    });
  });

  it("lists seeded payment intents with pagination and status filter", async () => {
    const all = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/payment-intents`)
      .query({ page: 1, limit: 5 })
      .set(auth);

    expect(all.status).toBe(200);
    expect(all.body.error).toBeNull();
    expect(all.body.data.total).toBe(8);
    expect(all.body.data.page).toBe(1);
    expect(all.body.data.limit).toBe(5);
    expect(all.body.data.totalPages).toBe(2);
    expect(all.body.data.items).toHaveLength(5);

    const page2 = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/payment-intents`)
      .query({ page: 2, limit: 5 })
      .set(auth);
    expect(page2.body.data.items).toHaveLength(3);
    expect(page2.body.data.total).toBe(8);

    const confirmed = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/payment-intents`)
      .query({ status: "CONFIRMED", page: 1, limit: 20 })
      .set(auth);
    expect(confirmed.body.data.total).toBe(3);
    expect(
      confirmed.body.data.items.every((row: { status: string }) => row.status === "CONFIRMED"),
    ).toBe(true);
  });

  it("returns dashboard summary stats for the seeded merchant", async () => {
    const response = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/summary`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.error).toBeNull();
    expect(response.body.data).toMatchObject({
      merchantId: SANDBOX_SEED_MERCHANT_ID,
      network: "sepolia",
      totalConfirmedVolumeCrypto: "0.06",
      currencyCrypto: "ETH",
      pendingCount: 2,
      confirmedCount: 3,
      expiredCount: 1,
      totalPaymentIntents: 8,
      successRate: 0.375,
      successRatePercent: 37.5,
      avgConfirmationTimeSeconds: 120,
      payoutsPending: 1,
      payoutsPaid: 1,
    });
  });

  it("lists seeded payouts", async () => {
    const response = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/payouts`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.items.map((row: { id: string }) => row.id).sort()).toEqual([
      "po_seed_paid",
      "po_seed_pending",
    ]);
  });

  it("returns a single payment intent with live watcher fields", async () => {
    const response = await request(app)
      .get("/api/v1/payment-intents/pi_seed_confirmed_a")
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "pi_seed_confirmed_a",
      status: "CONFIRMED",
      confirmations: 12,
      network: "sepolia",
    });
    expect(response.body.data.paymentUri).toMatch(/^ethereum:/);
  });

  it("creates a payment intent for the authenticated merchant", async () => {
    const response = await request(app).post("/api/v1/payment-intents").set(auth).send({
      merchantId: SANDBOX_SEED_MERCHANT_ID,
      amountRequestedCrypto: "0.01",
      currencyCrypto: "ETH",
      expiresInMinutes: 20,
    });

    expect(response.status).toBe(201);
    expect(response.body.error).toBeNull();
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.merchantId).toBe(SANDBOX_SEED_MERCHANT_ID);
  });

  it("returns field-level 400 errors for invalid query params", async () => {
    const response = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/payment-intents`)
      .query({ status: "NOPE", page: 0, limit: 500 })
      .set(auth);

    expect(response.status).toBe(400);
    expect(response.body.data).toBeNull();
    expect(response.body.error.message).toBe("Validation failed");
    const fields = response.body.error.fields as Array<{ field: string; message: string }>;
    expect(fields.map((item) => item.field).sort()).toEqual(["limit", "page", "status"]);
  });

  it("rejects missing and invalid API keys", async () => {
    const missing = await request(app).get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/summary`);
    expect(missing.status).toBe(401);
    expect(missing.body.data).toBeNull();

    const invalid = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/summary`)
      .set("x-api-key", "sandbox_not_a_real_key");
    expect(invalid.status).toBe(401);

    const live = await request(app)
      .get(`/api/v1/merchants/${SANDBOX_SEED_MERCHANT_ID}/summary`)
      .set("x-api-key", "live_should_not_work_in_sandbox");
    expect(live.status).toBe(401);
  });

  it("forbids using a seed API key against another merchant id", async () => {
    const response = await request(app).get("/api/v1/merchants/someone_else/summary").set(auth);
    expect(response.status).toBe(403);
    expect(response.body.data).toBeNull();
  });

  it("serves OpenAPI JSON and Swagger UI", async () => {
    const spec = await request(app).get("/api/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect(spec.body.paths["/api/v1/merchants/{id}/summary"]).toBeDefined();
    expect(spec.body.paths["/api/v1/merchants/{id}/payment-intents"]).toBeDefined();
    expect(spec.body.components.securitySchemes.ApiKeyAuth).toMatchObject({
      name: "X-API-Key",
    });

    const docs = await request(app).get("/api/docs/");
    expect(docs.status).toBe(200);
    expect(docs.text).toMatch(/swagger/i);
  });
});
