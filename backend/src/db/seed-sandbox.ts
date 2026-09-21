import { PaymentStatus, PayoutStatus } from "@prisma/client";
import { hashApiKey } from "../lib/api-keys";
import { prisma } from "../lib/prisma";

/** Seeded sandbox merchant used by the Flutter dashboard and v1 integration tests. */
export const SANDBOX_SEED_MERCHANT_ID = "merchant_sandbox_seed";

/** Well-known sandbox API key — never use a `live_` key, and never reuse this outside sandbox. */
export const SANDBOX_SEED_API_KEY = "sandbox_seed_frontend_key_aaaaaaaaaaaaaaaaaaaaaaaa";

export const SANDBOX_SEED_WEBHOOK_SECRET = "whsec_sandbox_seed_webhook_secret_value";

const SEED_CREATED_AT = new Date("2026-09-01T12:00:00.000Z");
const ADDRESS = "0x1111111111111111111111111111111111111111";

type SeedIntent = {
  id: string;
  status: PaymentStatus;
  amount: string;
  received?: string;
  confirmAfterSeconds?: number;
  expiresAt: Date;
};

const INTENTS: SeedIntent[] = [
  {
    id: "pi_seed_confirmed_a",
    status: PaymentStatus.CONFIRMED,
    amount: "0.01",
    received: "0.01",
    confirmAfterSeconds: 60,
    expiresAt: new Date("2026-09-02T12:00:00.000Z"),
  },
  {
    id: "pi_seed_confirmed_b",
    status: PaymentStatus.CONFIRMED,
    amount: "0.02",
    received: "0.02",
    confirmAfterSeconds: 120,
    expiresAt: new Date("2026-09-02T12:00:00.000Z"),
  },
  {
    id: "pi_seed_confirmed_c",
    status: PaymentStatus.CONFIRMED,
    amount: "0.03",
    received: "0.03",
    confirmAfterSeconds: 180,
    expiresAt: new Date("2026-09-02T12:00:00.000Z"),
  },
  {
    id: "pi_seed_pending_a",
    status: PaymentStatus.PENDING,
    amount: "0.04",
    expiresAt: new Date("2026-12-01T12:00:00.000Z"),
  },
  {
    id: "pi_seed_pending_b",
    status: PaymentStatus.PENDING,
    amount: "0.05",
    expiresAt: new Date("2026-12-01T12:00:00.000Z"),
  },
  {
    id: "pi_seed_expired_a",
    status: PaymentStatus.EXPIRED,
    amount: "0.06",
    expiresAt: new Date("2026-08-01T12:00:00.000Z"),
  },
  {
    id: "pi_seed_underpaid_a",
    status: PaymentStatus.UNDERPAID,
    amount: "0.07",
    received: "0.01",
    expiresAt: new Date("2026-12-01T12:00:00.000Z"),
  },
  {
    id: "pi_seed_overpaid_a",
    status: PaymentStatus.OVERPAID,
    amount: "0.08",
    received: "0.10",
    expiresAt: new Date("2026-12-01T12:00:00.000Z"),
  },
];

function seedTxHash(id: string): string {
  const hex = Buffer.from(id).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}`;
}

/**
 * Idempotent sandbox dataset (Phase 1 demo merchant).
 * Confirmed volume 0.06 ETH, 2 pending, success rate 3/8, avg confirmation 120s.
 */
export async function seedSandbox(): Promise<void> {
  await prisma.merchant.upsert({
    where: { id: SANDBOX_SEED_MERCHANT_ID },
    create: {
      id: SANDBOX_SEED_MERCHANT_ID,
      webhookUrl: null,
      webhookSecret: SANDBOX_SEED_WEBHOOK_SECRET,
      apiKeyHash: hashApiKey(SANDBOX_SEED_API_KEY),
    },
    update: {
      webhookSecret: SANDBOX_SEED_WEBHOOK_SECRET,
      apiKeyHash: hashApiKey(SANDBOX_SEED_API_KEY),
    },
  });

  await prisma.paymentIntent.deleteMany({ where: { merchantId: SANDBOX_SEED_MERCHANT_ID } });

  for (const intent of INTENTS) {
    const confirmedAt =
      intent.confirmAfterSeconds !== undefined
        ? new Date(SEED_CREATED_AT.getTime() + intent.confirmAfterSeconds * 1000)
        : undefined;
    const hasOnChainTx =
      intent.status === PaymentStatus.CONFIRMED ||
      intent.status === PaymentStatus.UNDERPAID ||
      intent.status === PaymentStatus.OVERPAID;

    await prisma.paymentIntent.create({
      data: {
        id: intent.id,
        merchantId: SANDBOX_SEED_MERCHANT_ID,
        amountRequestedCrypto: intent.amount,
        currencyCrypto: "ETH",
        expectedAddress: ADDRESS,
        reference: `ref_${intent.id}`,
        status: intent.status,
        receivedAmountCrypto: intent.received ?? null,
        txHash: hasOnChainTx ? seedTxHash(intent.id) : null,
        confirmations: intent.status === PaymentStatus.CONFIRMED ? 12 : 0,
        txBlockNumber: intent.status === PaymentStatus.CONFIRMED ? 1 : null,
        expiresAt: intent.expiresAt,
        createdAt: SEED_CREATED_AT,
        updatedAt: confirmedAt ?? SEED_CREATED_AT,
      },
    });

    if (confirmedAt) {
      await prisma.auditLog.create({
        data: {
          paymentIntentId: intent.id,
          fromStatus: PaymentStatus.PENDING,
          toStatus: PaymentStatus.CONFIRMED,
          message: "sandbox seed confirmation",
          createdAt: confirmedAt,
        },
      });
    }
  }

  await prisma.payout.createMany({
    data: [
      {
        id: "po_seed_paid",
        paymentIntentId: "pi_seed_confirmed_a",
        merchantId: SANDBOX_SEED_MERCHANT_ID,
        amountFiat: "1500.00",
        currencyFiat: "INR",
        status: PayoutStatus.PAID,
        simulated: true,
        paidAt: new Date("2026-09-01T12:05:00.000Z"),
      },
      {
        id: "po_seed_pending",
        paymentIntentId: "pi_seed_confirmed_b",
        merchantId: SANDBOX_SEED_MERCHANT_ID,
        amountFiat: "2500.00",
        currencyFiat: "INR",
        status: PayoutStatus.PENDING,
        simulated: true,
      },
    ],
  });
}
