import { randomBytes } from "node:crypto";
import { PaymentStatus } from "@prisma/client";
import { config } from "../config/env";
import { prisma } from "../lib/prisma";
import { toWei } from "../blockchain/amounts";
import { getSharedReceiveAddress, SEPOLIA_CHAIN_ID_NUMBER } from "../blockchain/provider";

export type CreatePaymentIntentInput = {
  merchantId: string;
  amountRequestedCrypto: string;
  currencyCrypto: string;
  expiresInMinutes: number;
};

/**
 * Sandbox receive strategy: one shared Sepolia address plus a unique `reference`.
 *
 * Tradeoff vs a per-intent address (HD derivation):
 * - Shared address is simple — one throwaway faucet-funded wallet, easy QR/URI, no key
 *   management per intent. The EIP-681 URI cannot carry a reliable on-chain memo for a
 *   plain ETH transfer, so the watcher matches inbound txs by amount (within tolerance)
 *   and optional calldata, then oldest PENDING intent. Colliding amounts can be
 *   attributed to the wrong intent.
 * - Unique addresses isolate funds and matching perfectly, but need HD keys, sweeping,
 *   and more faucet ETH. Use that before any production cutover.
 */
export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  if (config.NODE_ENV !== "sandbox") {
    throw new Error("Payment intents can only be created when NODE_ENV=sandbox.");
  }

  const amount = input.amountRequestedCrypto.trim();
  const amountWei = toWei(amount);
  if (amountWei <= 0n) {
    throw new Error("amountRequestedCrypto must be greater than zero.");
  }

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
  return `ethereum:${address}@${SEPOLIA_CHAIN_ID_NUMBER}?${params.toString()}#${reference}`;
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
    confirmations: number;
    receivedAmountCrypto: { toString(): string } | null;
    expiresAt: Date;
    createdAt: Date;
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
    confirmations: row.confirmations,
    receivedAmountCrypto: row.receivedAmountCrypto?.toString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    network: "sepolia",
    chainId: SEPOLIA_CHAIN_ID_NUMBER,
    paymentUri: paymentUri ?? buildPaymentUri(row.expectedAddress, amountWei, row.reference),
  };
}
