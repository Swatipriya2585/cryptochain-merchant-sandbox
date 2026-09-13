import { Router } from "express";
import { asyncHandler } from "../http/async-handler";
import { HttpError, sendData } from "../http/envelope";
import { parseRequest } from "../http/validate";
import { requireOwnMerchant } from "../middleware/api-key-auth";
import { prisma } from "../lib/prisma";
import {
  createPaymentIntent,
  getPaymentIntent,
  listPaymentIntents,
  serializePaymentIntent,
} from "../services/payment-intents";
import { listPayouts } from "../services/payouts";
import { serializeMerchant } from "../services/merchants";
import { getMerchantSummary } from "../services/summary";
import {
  createPaymentIntentBodySchema,
  merchantIdParamsSchema,
  paginationQuerySchema,
  paymentIntentIdParamsSchema,
  paymentIntentListQuerySchema,
} from "../v1/schemas";

export const v1Router = Router();

v1Router.get(
  "/merchants/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseRequest(merchantIdParamsSchema, req.params);
    requireOwnMerchant(id, req.merchant!.id);
    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      throw new HttpError(404, "Merchant not found");
    }
    sendData(res, serializeMerchant(merchant));
  }),
);

v1Router.get(
  "/merchants/:id/payment-intents",
  asyncHandler(async (req, res) => {
    const { id } = parseRequest(merchantIdParamsSchema, req.params);
    requireOwnMerchant(id, req.merchant!.id);
    const query = parseRequest(paymentIntentListQuerySchema, req.query);
    const result = await listPaymentIntents({
      merchantId: id,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    sendData(res, result);
  }),
);

v1Router.get(
  "/merchants/:id/payouts",
  asyncHandler(async (req, res) => {
    const { id } = parseRequest(merchantIdParamsSchema, req.params);
    requireOwnMerchant(id, req.merchant!.id);
    const query = parseRequest(paginationQuerySchema, req.query);
    const result = await listPayouts({
      merchantId: id,
      page: query.page,
      limit: query.limit,
    });
    sendData(res, result);
  }),
);

v1Router.get(
  "/merchants/:id/summary",
  asyncHandler(async (req, res) => {
    const { id } = parseRequest(merchantIdParamsSchema, req.params);
    requireOwnMerchant(id, req.merchant!.id);
    sendData(res, await getMerchantSummary(id));
  }),
);

v1Router.get(
  "/payment-intents/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseRequest(paymentIntentIdParamsSchema, req.params);
    const intent = await getPaymentIntent(id);
    if (!intent || intent.merchantId !== req.merchant!.id) {
      throw new HttpError(404, "Payment intent not found");
    }
    sendData(res, serializePaymentIntent(intent));
  }),
);

v1Router.post(
  "/payment-intents",
  asyncHandler(async (req, res) => {
    const body = parseRequest(createPaymentIntentBodySchema, req.body);
    requireOwnMerchant(body.merchantId, req.merchant!.id);
    const intent = await createPaymentIntent(body);
    sendData(res, intent, 201);
  }),
);
