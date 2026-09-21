import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { replayWebhookEvent } from "../webhooks/dispatcher";
import { normalizeEventType } from "../webhooks/event-types";

const listQuerySchema = z.object({
  merchantId: z.string().min(1),
  status: z.string().min(1).optional(),
});

export const webhookEventsRouter = Router();

webhookEventsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "merchantId is required", details: parsed.error.flatten() });
    return;
  }

  const { merchantId, status } = parsed.data;
  const deliveryFilter = deliveryStatusFilter(status);
  const eventType = status && !deliveryFilter ? normalizeEventType(status) : undefined;

  try {
    const events = await prisma.webhookEvent.findMany({
      where: {
        paymentIntent: { merchantId },
        ...(deliveryFilter ?? {}),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        paymentIntent: {
          select: {
            id: true,
            merchantId: true,
            status: true,
            reference: true,
          },
        },
      },
    });

    res.json({
      events: events.map(serializeWebhookEvent),
    });
  } catch (error) {
    logger.error({ err: error }, "list webhook events failed");
    res.status(500).json({ error: "Failed to list webhook events" });
  }
});

webhookEventsRouter.post("/:id/replay", async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = await prisma.webhookEvent.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Webhook event not found" });
    return;
  }

  try {
    const delivered = await replayWebhookEvent(id);
    const updated = await prisma.webhookEvent.findUniqueOrThrow({
      where: { id },
      include: {
        paymentIntent: {
          select: { id: true, merchantId: true, status: true, reference: true },
        },
      },
    });
    res.json({
      delivered,
      event: serializeWebhookEvent(updated),
    });
  } catch (error) {
    logger.error({ err: error, id }, "replay webhook failed");
    res.status(500).json({ error: "Failed to replay webhook event" });
  }
});

function deliveryStatusFilter(status: string | undefined) {
  if (!status) {
    return undefined;
  }
  const value = status.toLowerCase();
  if (value === "delivered" || value === "success" || value === "succeeded") {
    if (value === "succeeded") {
      return undefined;
    }
    return { deliveredSuccessfully: true };
  }
  if (value === "failed") {
    return { deliveredSuccessfully: false, attempts: { gte: 3 } };
  }
  if (value === "pending") {
    return { deliveredSuccessfully: false, attempts: { lt: 3 } };
  }
  return undefined;
}

function serializeWebhookEvent(row: {
  id: string;
  paymentIntentId: string;
  eventType: string;
  payload: unknown;
  deliveredSuccessfully: boolean;
  attempts: number;
  lastHttpStatus: number | null;
  lastError: string | null;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  paymentIntent?: {
    id: string;
    merchantId: string;
    status: string;
    reference: string;
  };
}) {
  return {
    id: row.id,
    paymentIntentId: row.paymentIntentId,
    eventType: row.eventType,
    payload: row.payload,
    deliveredSuccessfully: row.deliveredSuccessfully,
    attempts: row.attempts,
    lastHttpStatus: row.lastHttpStatus,
    lastError: row.lastError,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    paymentIntent: row.paymentIntent,
    deliveryStatus: row.deliveredSuccessfully
      ? "delivered"
      : row.attempts >= 3
        ? "failed"
        : "pending",
  };
}
