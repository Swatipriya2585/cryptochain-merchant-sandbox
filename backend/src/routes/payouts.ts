import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { createPayout, serializePayout, simulateStripeTestEvent } from "../services/payouts";
import { prisma } from "../lib/prisma";

const createBodySchema = z.object({
  paymentIntentId: z.string().min(1),
  amountFiat: z.union([z.string(), z.number()]).transform((value) => String(value)),
  currencyFiat: z.string().min(1).optional(),
});

const simulateBodySchema = z.object({
  type: z.enum(["payout.paid", "payment_intent.succeeded"]),
});

export const payoutsRouter = Router();

payoutsRouter.post("/", async (req, res) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const payout = await createPayout(parsed.data);
    res.status(201).json(payout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payout";
    logger.error({ err: error }, "create payout failed");
    const status = message.includes("not found") ? 404 : message.includes("CONFIRMED") ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

payoutsRouter.post("/:id/simulate-stripe-event", async (req, res) => {
  const parsed = simulateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const payout = await simulateStripeTestEvent(String(req.params.id), parsed.data.type);
    res.json(payout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to simulate Stripe event";
    logger.error({ err: error }, "simulate stripe event failed");
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

payoutsRouter.get("/:id", async (req, res) => {
  const payout = await prisma.payout.findUnique({ where: { id: String(req.params.id) } });
  if (!payout) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }
  res.json(serializePayout(payout));
});
