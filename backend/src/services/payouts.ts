import { PaymentStatus, PayoutStatus, type Payout, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { enqueueOpsAlert } from "../lib/alerts";

export type CreatePayoutInput = {
  paymentIntentId: string;
  amountFiat: string;
  currencyFiat?: string;
};

/**
 * Fiat (INR) payout leg for a CONFIRMED on-chain payment.
 *
 * PLACEHOLDER FOR STRIPE CONNECT:
 * A real marketplace would call stripe.payouts.create / Transfer to a connected
 * account after KYC. Sandbox does **not** hit Stripe's payout API — it inserts a
 * PENDING Payout row and waits for either:
 *   - POST /api/payouts/:id/simulate-stripe-event  (manual test trigger)
 *   - POST /api/webhooks/stripe                    (Stripe CLI / test-mode webhooks)
 */
export async function createPayout(input: CreatePayoutInput) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: input.paymentIntentId },
  });
  if (!intent) {
    throw new Error("PaymentIntent not found");
  }
  if (intent.status !== PaymentStatus.CONFIRMED) {
    throw new Error(
      `Payouts can only be created for CONFIRMED payment intents (status is ${intent.status}).`,
    );
  }

  const existing = await prisma.payout.findUnique({
    where: { paymentIntentId: intent.id },
  });
  if (existing) {
    return serializePayout(existing);
  }

  const amount = input.amountFiat.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error("amountFiat must be a positive INR amount with up to 2 decimal places.");
  }

  const payout = await prisma.payout.create({
    data: {
      paymentIntentId: intent.id,
      merchantId: intent.merchantId,
      amountFiat: amount,
      currencyFiat: (input.currencyFiat ?? "INR").toUpperCase(),
      status: PayoutStatus.PENDING,
      simulated: true,
    },
  });

  logger.info(
    { payoutId: payout.id, paymentIntentId: intent.id },
    "sandbox payout created (PENDING; Stripe Connect not called)",
  );

  return serializePayout(payout);
}

export type StripeLikeEvent = {
  id: string;
  type: string;
  data: { object: { id?: string; metadata?: Record<string, string> | null } };
};

export async function applyStripeEventToPayout(event: StripeLikeEvent): Promise<Payout | null> {
  const object = event.data.object;
  const metadataId = object.metadata?.payoutId;
  const objectId = object.id;

  let payout =
    (metadataId ? await prisma.payout.findUnique({ where: { id: metadataId } }) : null) ??
    (event.type.startsWith("payout.") && objectId
      ? await prisma.payout.findUnique({ where: { stripePayoutId: objectId } })
      : null) ??
    (event.type.startsWith("payment_intent.") && objectId
      ? await prisma.payout.findUnique({ where: { stripePaymentIntentId: objectId } })
      : null);

  if (!payout) {
    logger.info(
      { stripeEventId: event.id, type: event.type, objectId },
      "Stripe event did not match a sandbox Payout row",
    );
    return null;
  }

  const data: Prisma.PayoutUpdateInput = {
    lastStripeEventType: event.type,
  };

  if (event.type === "payment_intent.succeeded") {
    data.stripePaymentIntentId = objectId ?? payout.stripePaymentIntentId;
  }

  if (event.type === "payout.paid") {
    data.stripePayoutId = objectId ?? payout.stripePayoutId;
    data.status = PayoutStatus.PAID;
    data.paidAt = new Date();
  }

  if (event.type === "payout.failed" || event.type === "payout.canceled") {
    data.stripePayoutId = objectId ?? payout.stripePayoutId;
    data.status = PayoutStatus.FAILED;
  }

  payout = await prisma.payout.update({
    where: { id: payout.id },
    data,
  });

  if (payout.status === PayoutStatus.FAILED) {
    enqueueOpsAlert({
      title: "Payout FAILED",
      body: `Payout ${payout.id} marked FAILED from Stripe event ${event.type}.`,
      severity: "error",
      fields: {
        payoutId: payout.id,
        paymentIntentId: payout.paymentIntentId,
        stripeEvent: event.type,
      },
      dedupeKey: `payout-failed:${payout.id}`,
    });
  }

  logger.info(
    { payoutId: payout.id, type: event.type, status: payout.status },
    "applied Stripe test event to payout",
  );
  return payout;
}

/**
 * PLACEHOLDER FOR STRIPE CONNECT:
 * Builds a synthetic Stripe-shaped event and applies it locally. Replace this
 * with stripe.payouts.create + connected-account webhooks before go-live.
 */
export async function simulateStripeTestEvent(payoutId: string, type: string) {
  if (type !== "payout.paid" && type !== "payment_intent.succeeded" && type !== "payout.failed") {
    throw new Error('type must be "payout.paid", "payout.failed", or "payment_intent.succeeded"');
  }

  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    throw new Error("Payout not found");
  }

  const objectId =
    type === "payout.paid"
      ? (payout.stripePayoutId ?? `po_test_${payout.id}`)
      : (payout.stripePaymentIntentId ?? `pi_test_${payout.id}`);

  const event = {
    id: `evt_test_${Date.now()}`,
    type,
    data: {
      object: {
        id: objectId,
        metadata: { payoutId: payout.id },
      },
    },
  };

  const updated = await applyStripeEventToPayout(event);
  if (!updated) {
    throw new Error("Failed to apply simulated Stripe event");
  }
  return serializePayout(updated);
}

export async function listPayouts(opts: { merchantId: string; page: number; limit: number }) {
  const where = { merchantId: opts.merchantId };
  const [total, rows] = await prisma.$transaction([
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);

  return {
    items: rows.map((row) => serializePayout(row)),
    page: opts.page,
    limit: opts.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / opts.limit),
  };
}

export function serializePayout(row: Payout) {
  return {
    id: row.id,
    paymentIntentId: row.paymentIntentId,
    merchantId: row.merchantId,
    amountFiat: row.amountFiat.toString(),
    currencyFiat: row.currencyFiat,
    status: row.status,
    stripePayoutId: row.stripePayoutId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    lastStripeEventType: row.lastStripeEventType,
    simulated: row.simulated,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
