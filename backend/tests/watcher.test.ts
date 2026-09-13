import { PaymentStatus } from "@prisma/client";
import { parseEther } from "ethers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChainReader } from "../src/blockchain/watcher";
import { runWatcherTick } from "../src/blockchain/watcher";
import { prisma } from "../src/lib/prisma";

describe("payment watcher", () => {
  const expectedAddress = "0x00000000000000000000000000000000000000aA";
  const amountRequestedCrypto = "0.05";
  const txHash = "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1";

  beforeAll(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.paymentIntent.deleteMany();
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.paymentIntent.deleteMany();
  });

  it("marks a PENDING intent CONFIRMED and writes a WebhookEvent when a matching tx is observed", async () => {
    const intent = await prisma.paymentIntent.create({
      data: {
        merchantId: "merchant_test",
        amountRequestedCrypto,
        currencyCrypto: "ETH",
        expectedAddress,
        reference: `test_${Date.now()}`,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    const chain: ChainReader = {
      async getBlockNumber() {
        return 100;
      },
      async getIncomingTransfers() {
        return [
          {
            hash: txHash,
            from: "0x0000000000000000000000000000000000000001",
            to: expectedAddress,
            valueWei: parseEther(amountRequestedCrypto),
            blockNumber: 97,
            data: "0x",
          },
        ];
      },
    };

    await runWatcherTick({
      chain,
      db: prisma,
      fromBlock: 90,
      toBlock: 100,
      requiredConfirmations: 3,
      tolerancePercent: 1,
    });

    const updated = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(updated.status).toBe(PaymentStatus.CONFIRMED);
    expect(updated.txHash).toBe(txHash);
    expect(updated.confirmations).toBeGreaterThanOrEqual(3);

    const webhookEvents = await prisma.webhookEvent.findMany({
      where: { paymentIntentId: intent.id },
    });
    expect(webhookEvents).toHaveLength(1);
    expect(webhookEvents[0]?.eventType).toBe("payment_intent.confirmed");

    const auditLogs = await prisma.auditLog.findMany({ where: { paymentIntentId: intent.id } });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.toStatus).toBe(PaymentStatus.CONFIRMED);
  });
});
