import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { createPaymentIntent } from "../services/payment-intents";

const createBodySchema = z.object({
  merchantId: z.string().min(1),
  amountRequestedCrypto: z.union([z.string(), z.number()]).transform((value) => String(value)),
  currencyCrypto: z.string().min(1),
  expiresInMinutes: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60),
});

export const paymentIntentsRouter = Router();

paymentIntentsRouter.post("/", async (req, res) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const intent = await createPaymentIntent(parsed.data);
    res.status(201).json(intent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment intent";
    logger.error({ err: error }, "create payment intent failed");
    const status = message.includes("NODE_ENV") ? 403 : 400;
    res.status(status).json({ error: message });
  }
});
