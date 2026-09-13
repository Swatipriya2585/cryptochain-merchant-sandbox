import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { HttpError } from "../http/envelope";
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
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, fields: error.fields });
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to create payment intent";
    logger.error({ err: error }, "create payment intent failed");
    res.status(400).json({ error: message });
  }
});
