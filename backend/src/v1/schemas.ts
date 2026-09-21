import { PaymentStatus, PayoutStatus } from "@prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };

export const paymentStatusSchema = z.nativeEnum(PaymentStatus).openapi("PaymentStatus");
export const payoutStatusSchema = z.nativeEnum(PayoutStatus).openapi("PayoutStatus");

export const merchantIdParamsSchema = z
  .object({
    id: z.string().min(1).openapi({ description: "Merchant id", example: "merchant_sandbox_seed" }),
  })
  .openapi("MerchantIdParams");

export const paymentIntentIdParamsSchema = z
  .object({
    id: z.string().min(1).openapi({ description: "Payment intent id" }),
  })
  .openapi("PaymentIntentIdParams");

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1, type: "integer" }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .openapi({ example: 20, type: "integer" }),
  })
  .openapi("PaginationQuery");

export const paymentIntentListQuerySchema = paginationQuerySchema
  .extend({
    status: paymentStatusSchema.optional(),
  })
  .openapi("PaymentIntentListQuery");

export const createPaymentIntentBodySchema = z
  .object({
    merchantId: z.string().min(1).openapi({ example: "merchant_sandbox_seed" }),
    amountRequestedCrypto: z.coerce.string().min(1).openapi({
      example: "0.01",
      description: "ETH amount. Enforced against MAX_TRANSACTION_AMOUNT server-side.",
    }),
    currencyCrypto: z.string().min(1).openapi({ example: "ETH" }),
    expiresInMinutes: z.coerce
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .openapi({ example: 20, type: "integer" }),
  })
  .openapi("CreatePaymentIntentBody");

export const fieldErrorSchema = z
  .object({
    field: z.string(),
    message: z.string(),
  })
  .openapi("FieldError");

export const apiErrorSchema = z
  .object({
    message: z.string(),
    fields: z.array(fieldErrorSchema).optional(),
  })
  .openapi("ApiError");

export const merchantSchema = z
  .object({
    id: z.string(),
    webhookUrl: z.string().nullable(),
    webhookSecretPreview: z.string(),
    apiKeyPrefix: z.enum(["sandbox_", "live_"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Merchant");

export const paymentIntentSchema = z
  .object({
    id: z.string(),
    merchantId: z.string(),
    amountRequestedCrypto: z.string(),
    currencyCrypto: z.string(),
    expectedAddress: z.string(),
    reference: z.string(),
    status: paymentStatusSchema,
    txHash: z.string().nullable(),
    txBlockNumber: z.number().int().nullable(),
    confirmations: z.number().int(),
    receivedAmountCrypto: z.string().nullable(),
    expiresAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    network: z.enum(["sepolia", "mainnet"]),
    chainId: z.number().int(),
    paymentUri: z.string(),
  })
  .openapi("PaymentIntent");

export const paginatedPaymentIntentsSchema = z
  .object({
    items: z.array(paymentIntentSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("PaginatedPaymentIntents");

export const payoutSchema = z
  .object({
    id: z.string(),
    paymentIntentId: z.string(),
    merchantId: z.string(),
    amountFiat: z.string(),
    currencyFiat: z.string(),
    status: payoutStatusSchema,
    stripePayoutId: z.string().nullable(),
    stripePaymentIntentId: z.string().nullable(),
    lastStripeEventType: z.string().nullable(),
    simulated: z.boolean(),
    paidAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Payout");

export const paginatedPayoutsSchema = z
  .object({
    items: z.array(payoutSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("PaginatedPayouts");

export const merchantSummarySchema = z
  .object({
    merchantId: z.string(),
    network: z.enum(["sepolia", "mainnet"]),
    totalConfirmedVolumeCrypto: z.string(),
    currencyCrypto: z.literal("ETH"),
    pendingCount: z.number().int(),
    confirmedCount: z.number().int(),
    expiredCount: z.number().int(),
    totalPaymentIntents: z.number().int(),
    successRate: z.number(),
    successRatePercent: z.number(),
    avgConfirmationTimeSeconds: z.number().nullable(),
    payoutsPending: z.number().int(),
    payoutsPaid: z.number().int(),
  })
  .openapi("MerchantSummary");

export function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    error: z.null(),
  });
}

export const errorEnvelopeSchema = z
  .object({
    data: z.null(),
    error: apiErrorSchema,
  })
  .openapi("ErrorEnvelope");
