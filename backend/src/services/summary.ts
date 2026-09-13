import { PaymentStatus, type PaymentIntent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fromWei, toWei } from "../blockchain/amounts";

export type MerchantSummary = {
  merchantId: string;
  network: "sepolia";
  totalConfirmedVolumeCrypto: string;
  currencyCrypto: "ETH";
  pendingCount: number;
  confirmedCount: number;
  expiredCount: number;
  totalPaymentIntents: number;
  successRate: number;
  successRatePercent: number;
  avgConfirmationTimeSeconds: number | null;
  payoutsPending: number;
  payoutsPaid: number;
};

export async function getMerchantSummary(merchantId: string): Promise<MerchantSummary> {
  const [intents, payoutCounts] = await Promise.all([
    prisma.paymentIntent.findMany({
      where: { merchantId },
      include: {
        auditLogs: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.payout.groupBy({
      by: ["status"],
      where: { merchantId },
      _count: { _all: true },
    }),
  ]);

  const pendingCount = intents.filter((row) => row.status === PaymentStatus.PENDING).length;
  const confirmed = intents.filter((row) => row.status === PaymentStatus.CONFIRMED);
  const expiredCount = intents.filter((row) => row.status === PaymentStatus.EXPIRED).length;
  const totalPaymentIntents = intents.length;
  const confirmedCount = confirmed.length;

  let volumeWei = 0n;
  const confirmationSeconds: number[] = [];
  for (const row of confirmed) {
    const amount = row.receivedAmountCrypto ?? row.amountRequestedCrypto;
    volumeWei += toWei(amount.toString());
    confirmationSeconds.push(confirmationTimeSeconds(row));
  }

  const successRate = totalPaymentIntents === 0 ? 0 : confirmedCount / totalPaymentIntents;
  const avgConfirmationTimeSeconds =
    confirmationSeconds.length === 0
      ? null
      : Math.round(
          confirmationSeconds.reduce((sum, value) => sum + value, 0) / confirmationSeconds.length,
        );

  const payoutsPending = payoutCounts.find((row) => row.status === "PENDING")?._count._all ?? 0;
  const payoutsPaid = payoutCounts.find((row) => row.status === "PAID")?._count._all ?? 0;

  return {
    merchantId,
    network: "sepolia",
    totalConfirmedVolumeCrypto: fromWei(volumeWei),
    currencyCrypto: "ETH",
    pendingCount,
    confirmedCount,
    expiredCount,
    totalPaymentIntents,
    successRate: Number(successRate.toFixed(4)),
    successRatePercent: Number((successRate * 100).toFixed(2)),
    avgConfirmationTimeSeconds,
    payoutsPending,
    payoutsPaid,
  };
}

function confirmationTimeSeconds(
  row: PaymentIntent & { auditLogs: { toStatus: string; createdAt: Date }[] },
): number {
  const confirmedLog = row.auditLogs.find((log) => log.toStatus === PaymentStatus.CONFIRMED);
  const confirmedAt = confirmedLog?.createdAt ?? row.updatedAt;
  return Math.max(0, Math.round((confirmedAt.getTime() - row.createdAt.getTime()) / 1000));
}
