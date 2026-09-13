import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export async function ensureMerchant(
  merchantId: string,
  extras: { webhookUrl?: string | null; webhookSecret?: string } = {},
) {
  return prisma.merchant.upsert({
    where: { id: merchantId },
    create: {
      id: merchantId,
      webhookUrl: extras.webhookUrl ?? null,
      webhookSecret: extras.webhookSecret ?? generateWebhookSecret(),
    },
    update: {
      ...(extras.webhookUrl !== undefined ? { webhookUrl: extras.webhookUrl } : {}),
      ...(extras.webhookSecret ? { webhookSecret: extras.webhookSecret } : {}),
    },
  });
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
