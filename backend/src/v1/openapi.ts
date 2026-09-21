import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { config } from "../config/env";
import {
  createPaymentIntentBodySchema,
  errorEnvelopeSchema,
  merchantIdParamsSchema,
  merchantSchema,
  merchantSummarySchema,
  paginatedPaymentIntentsSchema,
  paginatedPayoutsSchema,
  paymentIntentIdParamsSchema,
  paymentIntentListQuerySchema,
  paymentIntentSchema,
  paginationQuerySchema,
  successEnvelope,
} from "./schemas";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
  description:
    "Merchant API key. Sandbox keys are prefixed `sandbox_`; production would use `live_`.",
});

const json = <T>(schema: T, description: string) => ({
  description,
  content: {
    "application/json": { schema },
  },
});

const errorResponses = {
  400: json(errorEnvelopeSchema, "Validation failed (field-level `error.fields`)"),
  401: json(errorEnvelopeSchema, "Missing or invalid X-API-Key"),
  403: json(errorEnvelopeSchema, "API key does not belong to this merchant"),
  404: json(errorEnvelopeSchema, "Resource not found"),
  429: json(errorEnvelopeSchema, "Rate limit exceeded (100 requests per minute per API key)"),
};

registry.registerPath({
  method: "get",
  path: "/api/v1/merchants/{id}",
  summary: "Merchant profile",
  tags: ["Merchants"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: merchantIdParamsSchema },
  responses: {
    200: json(successEnvelope(merchantSchema), "Merchant profile"),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/merchants/{id}/payment-intents",
  summary: "List payment intents",
  tags: ["Payment intents"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: merchantIdParamsSchema, query: paymentIntentListQuerySchema },
  responses: {
    200: json(successEnvelope(paginatedPaymentIntentsSchema), "Paginated payment intents"),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/merchants/{id}/payouts",
  summary: "List merchant payouts",
  tags: ["Payouts"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: merchantIdParamsSchema, query: paginationQuerySchema },
  responses: {
    200: json(successEnvelope(paginatedPayoutsSchema), "Paginated payouts"),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/merchants/{id}/summary",
  summary: "Dashboard aggregate stats",
  description:
    "Sandbox totals: confirmed crypto volume, pending count, success rate, and average confirmation time.",
  tags: ["Merchants"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: merchantIdParamsSchema },
  responses: {
    200: json(successEnvelope(merchantSummarySchema), "Merchant dashboard summary"),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/payment-intents/{id}",
  summary: "Get a payment intent (live watcher status)",
  tags: ["Payment intents"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: paymentIntentIdParamsSchema },
  responses: {
    200: json(
      successEnvelope(paymentIntentSchema),
      "Current payment intent, including watcher status",
    ),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/payment-intents",
  summary: "Create a payment intent",
  tags: ["Payment intents"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createPaymentIntentBodySchema } },
      required: true,
    },
  },
  responses: {
    201: json(successEnvelope(paymentIntentSchema), "Created PENDING payment intent"),
    ...errorResponses,
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "CryptoChain Sandbox API",
    version: "1.0.0",
    description:
      "Flutter-facing REST API (`/api/v1`). All responses are `{ data, error }`. Authenticate with `X-API-Key`. Sandbox: Sepolia + Stripe test mode. Production: mainnet + Stripe live, with MAX_TRANSACTION_AMOUNT enforced server-side.",
  },
  servers: [{ url: `http://localhost:${config.PORT}`, description: "Local sandbox" }],
});
