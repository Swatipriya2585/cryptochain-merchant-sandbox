import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { apiKeyPrefix, generateMerchantApiKey } from "../lib/api-keys";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export async function ensureMerchant(
  merchantId: string,
  extras: {
    webhookUrl?: string | null;
    webhookSecret?: string;
    apiKeyHash?: string;
  } = {},
) {
  return prisma.merchant.upsert({
    where: { id: merchantId },
    create: {
      id: merchantId,
      webhookUrl: extras.webhookUrl ?? null,
      webhookSecret: extras.webhookSecret ?? generateWebhookSecret(),
      apiKeyHash: extras.apiKeyHash ?? generateMerchantApiKey().hash,
    },
    update: {
      ...(extras.webhookUrl !== undefined ? { webhookUrl: extras.webhookUrl } : {}),
      ...(extras.webhookSecret ? { webhookSecret: extras.webhookSecret } : {}),
      ...(extras.apiKeyHash ? { apiKeyHash: extras.apiKeyHash } : {}),
    },
  });
}

export async function createMerchantWithApiKey(
  merchantId: string,
  extras: { webhookUrl?: string | null; webhookSecret?: string } = {},
) {
  const existing = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (existing) {
    const merchant = await ensureMerchant(merchantId, extras);
    return { merchant, apiKey: null as string | null, created: false };
  }
  const { plaintext, hash } = generateMerchantApiKey();
  const merchant = await ensureMerchant(merchantId, { ...extras, apiKeyHash: hash });
  return { merchant, apiKey: plaintext, created: true };
}

export function serializeMerchant(row: {
  id: string;
  webhookUrl: string | null;
  webhookSecret: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    webhookUrl: row.webhookUrl,
    webhookSecretPreview: `${row.webhookSecret.slice(0, 8)}…`,
    apiKeyPrefix: apiKeyPrefix(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
