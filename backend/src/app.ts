import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
import { errorHandler } from "./http/envelope";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { apiKeyAuth } from "./middleware/api-key-auth";
import { v1RateLimiter } from "./middleware/rate-limit";
import { merchantsRouter } from "./routes/merchants";
import { paymentIntentsRouter } from "./routes/payment-intents";
import { payoutsRouter } from "./routes/payouts";
import { stripeWebhooksRouter } from "./routes/stripe-webhooks";
import { v1Router } from "./routes/v1";
import { webhookEventsRouter } from "./routes/webhook-events";
import { openApiDocument } from "./v1/openapi";

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

app.use("/api/docs", (_req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
});
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "CryptoChain Sandbox API",
    swaggerOptions: { persistAuthorization: true },
  }),
);
app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use("/api/v1", v1RateLimiter, apiKeyAuth, v1Router);

app.use("/api/merchants", merchantsRouter);
app.use("/api/payment-intents", paymentIntentsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/webhook-events", webhookEventsRouter);
app.use(STRIPE_WEBHOOK_PATH, stripeWebhooksRouter);

app.use(errorHandler);
