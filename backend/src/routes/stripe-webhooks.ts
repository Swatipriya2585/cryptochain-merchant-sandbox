import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getStripe, getStripeWebhookSecret } from "../lib/stripe";
import { applyStripeEventToPayout, serializePayout } from "../services/payouts";

export const stripeWebhooksRouter = Router();

stripeWebhooksRouter.post("/", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || signature.length === 0) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : req.rawBody ? req.rawBody : null;
  if (!rawBody) {
    res
      .status(400)
      .json({ error: "Raw body missing; Stripe signature verification requires express.raw()" });
    return;
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid signature";
    logger.warn({ err: error }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  try {
    if (event.type === "payment_intent.succeeded" || event.type === "payout.paid") {
      const payout = await applyStripeEventToPayout(event);
      res.json({
        received: true,
        type: event.type,
        payout: payout ? serializePayout(payout) : null,
      });
      return;
    }

    logger.info({ type: event.type }, "ignored unhandled Stripe test event");
    res.json({ received: true, type: event.type, payout: null });
  } catch (error) {
    logger.error({ err: error, type: event.type }, "Stripe webhook handler failed");
    res.status(500).json({ error: "Failed to process Stripe webhook" });
  }
});
