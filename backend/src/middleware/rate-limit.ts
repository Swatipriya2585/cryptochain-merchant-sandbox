import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { sendError } from "../http/envelope";
import { hashApiKey } from "../lib/api-keys";
import { API_KEY_HEADER } from "./api-key-auth";

/** 100 requests per minute per API key (falls back to IP when the header is missing). */
export const v1RateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const apiKey = req.header(API_KEY_HEADER);
    if (apiKey && apiKey.trim().length > 0) {
      return `k:${hashApiKey(apiKey.trim())}`;
    }
    return `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
  },
  handler: (_req, res) => {
    sendError(res, 429, "Rate limit exceeded: 100 requests per minute per API key");
  },
});
