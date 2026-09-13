import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { createMerchantWithApiKey, serializeMerchant } from "../services/merchants";

const upsertBodySchema = z.object({
  id: z.string().min(1),
  webhookUrl: z.string().url().nullable().optional(),
  webhookSecret: z.string().min(8).optional(),
});

export const merchantsRouter = Router();

merchantsRouter.post("/", async (req, res) => {
  const parsed = upsertBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const { merchant, apiKey, created } = await createMerchantWithApiKey(parsed.data.id, {
      webhookUrl: parsed.data.webhookUrl,
      webhookSecret: parsed.data.webhookSecret,
    });
    res.status(created ? 201 : 200).json({
      ...serializeMerchant(merchant),
      ...(apiKey ? { apiKey } : {}),
    });
  } catch (error) {
    logger.error({ err: error }, "upsert merchant failed");
    res.status(500).json({ error: "Failed to save merchant" });
  }
});
