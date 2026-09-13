import type { RequestHandler } from "express";
import { config } from "../config/env";
import { HttpError } from "../http/envelope";
import { sendError } from "../http/envelope";
import { apiKeyLooksValid, apiKeyPrefix, hashApiKey } from "../lib/api-keys";
import { prisma } from "../lib/prisma";

export const API_KEY_HEADER = "x-api-key";

export const apiKeyAuth: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.header(API_KEY_HEADER);
    if (typeof raw !== "string" || raw.trim().length === 0) {
      sendError(res, 401, "Missing X-API-Key header", [
        { field: "X-API-Key", message: "API key is required" },
      ]);
      return;
    }

    const apiKey = raw.trim();
    if (!apiKeyLooksValid(apiKey)) {
      sendError(res, 401, "Invalid API key", [
        {
          field: "X-API-Key",
          message: 'API keys must start with "sandbox_" or "live_"',
        },
      ]);
      return;
    }

    const expectedPrefix = apiKeyPrefix();
    if (!apiKey.startsWith(expectedPrefix)) {
      sendError(res, 401, "API key does not match this environment", [
        {
          field: "X-API-Key",
          message: `NODE_ENV=${config.NODE_ENV} requires a ${expectedPrefix} key`,
        },
      ]);
      return;
    }

    const merchant = await prisma.merchant.findUnique({
      where: { apiKeyHash: hashApiKey(apiKey) },
    });
    if (!merchant) {
      sendError(res, 401, "Invalid API key", [
        { field: "X-API-Key", message: "No merchant matches this API key" },
      ]);
      return;
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireOwnMerchant(merchantId: string, authenticatedId: string): void {
  if (merchantId !== authenticatedId) {
    throw new HttpError(403, "Forbidden: API key does not belong to this merchant");
  }
}
