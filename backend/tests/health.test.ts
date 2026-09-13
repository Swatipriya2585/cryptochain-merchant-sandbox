import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("GET /health", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 200 with dbConnected true against the sandbox database", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      mode: "sandbox",
      dbConnected: true,
    });
  });
});
