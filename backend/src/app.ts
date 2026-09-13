import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import { config } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { merchantsRouter } from "./routes/merchants";
import { paymentIntentsRouter } from "./routes/payment-intents";
import { payoutsRouter } from "./routes/payouts";
import { stripeWebhooksRouter } from "./routes/stripe-webhooks";
import { webhookEventsRouter } from "./routes/webhook-events";

export const STRIPE_WEBHOOK_PATH = "/api/webhooks/stripe";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);

// Stripe signature verification needs the unmodified raw body on this path.
app.use(STRIPE_WEBHOOK_PATH, express.raw({ type: "application/json" }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    },
  }),
);

app.get("/health", async (_req, res) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (error) {
    logger.warn({ err: error }, "health check could not reach the database");
  }

  res.status(200).json({
    status: "ok",
    mode: config.mode,
    dbConnected,
  });
});

app.use("/api/merchants", merchantsRouter);
app.use("/api/payment-intents", paymentIntentsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/webhook-events", webhookEventsRouter);
app.use(STRIPE_WEBHOOK_PATH, stripeWebhooksRouter);
