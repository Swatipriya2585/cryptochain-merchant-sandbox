import { randomBytes } from "node:crypto";
import { PaymentStatus } from "@prisma/client";
import { config } from "../config/env";
import { assertAmountWithinCap, assertPaymentsAllowed } from "../config/limits";
import { prisma } from "../lib/prisma";
import { ensureMerchant } from "./merchants";
import { toWei } from "../blockchain/amounts";
import { getSharedReceiveAddress } from "../blockchain/provider";

export type CreatePaymentIntentInput = {
  merchantId: string;
  amountRequestedCrypto: string;
  currencyCrypto: string;
  expiresInMinutes: number;
};

/**
 * Receive strategy: one shared address plus a unique `reference`.
 *
 * Tradeoff vs a per-intent address (HD derivation):
 * - Shared address is simple — one wallet, easy QR/URI, no key management per intent.
 *   The EIP-681 URI cannot carry a reliable on-chain memo for a plain ETH transfer, so
 *   the watcher matches inbound txs by amount (within tolerance) and optional calldata,
 *   then oldest PENDING intent. Colliding amounts can be attributed to the wrong intent.
 * - Unique addresses isolate funds and matching perfectly, but need HD keys and sweeping.
 * Keep MAX_TRANSACTION_AMOUNT small until unique addresses exist. See CUTOVER_CHECKLIST.md.
 */
export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  assertPaymentsAllowed();

  const amount = input.amountRequestedCrypto.trim();
  const amountWei = assertAmountWithinCap(amount);

  await ensureMerchant(input.merchantId);

  const expectedAddress = getSharedReceiveAddress();
  const reference = `cc_${randomBytes(8).toString("hex")}`;
  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);
  const paymentUri = buildPaymentUri(expectedAddress, amountWei, reference);

  const row = await prisma.paymentIntent.create({
    data: {
      merchantId: input.merchantId,
      amountRequestedCrypto: amount,
      currencyCrypto: input.currencyCrypto.toUpperCase(),
      expectedAddress,
      reference,
      status: PaymentStatus.PENDING,
      expiresAt,
    },
  });

  return serializePaymentIntent(row, paymentUri);
}

export function buildPaymentUri(address: string, amountWei: bigint, reference: string): string {
  const params = new URLSearchParams({
    value: amountWei.toString(),
  });
  return `ethereum:${address}@${config.chainId}?${params.toString()}#${reference}`;
}

export async function listPaymentIntents(opts: {
  merchantId: string;
  status?: PaymentStatus;
  page: number;
  limit: number;
}) {
  const where = {
    merchantId: opts.merchantId,
    ...(opts.status ? { status: opts.status } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.paymentIntent.count({ where }),
    prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);

  return {
    items: rows.map((row) => serializePaymentIntent(row)),
    page: opts.page,
    limit: opts.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / opts.limit),
  };
}

export async function getPaymentIntent(id: string) {
  return prisma.paymentIntent.findUnique({ where: { id } });
}

export function serializePaymentIntent(
  row: {
    id: string;
    merchantId: string;
    amountRequestedCrypto: { toString(): string };
    currencyCrypto: string;
    expectedAddress: string;
    reference: string;
    status: PaymentStatus;
    txHash: string | null;
    txBlockNumber?: number | null;
    confirmations: number;
    receivedAmountCrypto: { toString(): string } | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt?: Date;
  },
  paymentUri?: string,
) {
  const amountWei = toWei(row.amountRequestedCrypto.toString());
  return {
    id: row.id,
    merchantId: row.merchantId,
    amountRequestedCrypto: row.amountRequestedCrypto.toString(),
    currencyCrypto: row.currencyCrypto,
    expectedAddress: row.expectedAddress,
    reference: row.reference,
    status: row.status,
    txHash: row.txHash,
    txBlockNumber: row.txBlockNumber ?? null,
    confirmations: row.confirmations,
    receivedAmountCrypto: row.receivedAmountCrypto?.toString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    network: config.network,
    chainId: config.chainId,
    paymentUri: paymentUri ?? buildPaymentUri(row.expectedAddress, amountWei, row.reference),
  };
}
