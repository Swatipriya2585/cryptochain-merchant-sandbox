import { PaymentStatus, type PaymentIntent, type PrismaClient } from "@prisma/client";
import { config } from "../config/env";
import { logger } from "../lib/logger";
import { prisma as defaultPrisma } from "../lib/prisma";
import { classifyPaymentAmount, confirmationsBetween, fromWei, toWei } from "./amounts";
import { assertConnectedToConfiguredChain, getProvider } from "./provider";
import { enqueueWebhookDelivery } from "../webhooks/dispatcher";
import { eventTypeForStatus } from "../webhooks/event-types";
import { enqueueOpsAlert } from "../lib/alerts";

export type IncomingTransfer = {
  hash: string;
  from: string;
  to: string;
  valueWei: bigint;
  blockNumber: number;
  data: string;
};

export type ChainReader = {
  getBlockNumber(): Promise<number>;
  getIncomingTransfers(
    address: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<IncomingTransfer[]>;
};

export type WatcherTickDeps = {
  chain: ChainReader;
  db?: PrismaClient;
  now?: Date;
  requiredConfirmations?: number;
  tolerancePercent?: number;
  fromBlock?: number;
  toBlock?: number;
};

const POLL_INTERVAL_MS = config.WATCHER_POLL_INTERVAL_MS;

let lastScannedBlock = 0;
let tickInFlight = false;
let pollTimer: NodeJS.Timeout | undefined;

function confirmationCount(txBlockNumber: number, currentBlock: number): number {
  return confirmationsBetween(txBlockNumber, currentBlock);
}

function transferMentionsReference(transfer: IncomingTransfer, reference: string): boolean {
  if (!transfer.data || transfer.data === "0x") {
    return false;
  }
  const hex = transfer.data.toLowerCase().replace(/^0x/, "");
  const refHex = Buffer.from(reference, "utf8").toString("hex");
  return hex.includes(reference.toLowerCase().replace(/^0x/, "")) || hex.includes(refHex);
}

async function recordTransition(
  db: PrismaClient,
  intent: PaymentIntent,
  toStatus: PaymentStatus,
  message: string,
  extra: Record<string, unknown>,
): Promise<void> {
  if (intent.status === toStatus) {
    return;
  }

  const payload = {
    paymentIntentId: intent.id,
    merchantId: intent.merchantId,
    fromStatus: intent.status,
    toStatus,
    reference: intent.reference,
    ...extra,
  };

  const event = await db.$transaction(async (tx) => {
    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: toStatus,
        txHash: typeof extra.txHash === "string" ? extra.txHash : intent.txHash,
        confirmations:
          typeof extra.confirmations === "number" ? extra.confirmations : intent.confirmations,
        receivedAmountCrypto:
          typeof extra.receivedAmountCrypto === "string"
            ? extra.receivedAmountCrypto
            : intent.receivedAmountCrypto,
        txBlockNumber:
          typeof extra.txBlockNumber === "number" ? extra.txBlockNumber : intent.txBlockNumber,
      },
    });
    const created = await tx.webhookEvent.create({
      data: {
        paymentIntentId: intent.id,
        eventType: eventTypeForStatus(toStatus),
        payload,
      },
    });
    await tx.auditLog.create({
      data: {
        paymentIntentId: intent.id,
        fromStatus: intent.status,
        toStatus,
        message,
        metadata: payload,
      },
    });
    return created;
  });

  enqueueWebhookDelivery(event.id);
}

function pickTransferForIntent(
  intent: PaymentIntent,
  unmatched: IncomingTransfer[],
  pendingForAddress: number,
  tolerancePercent: number,
): IncomingTransfer | undefined {
  const address = intent.expectedAddress.toLowerCase();
  const candidates = unmatched.filter((transfer) => transfer.to.toLowerCase() === address);
  if (candidates.length === 0) {
    return undefined;
  }

  const requestedWei = toWei(intent.amountRequestedCrypto.toString());
  const byReference = candidates.find((transfer) =>
    transferMentionsReference(transfer, intent.reference),
  );
  if (byReference) {
    return byReference;
  }

  const byAmount = candidates.find(
    (transfer) =>
      classifyPaymentAmount(requestedWei, transfer.valueWei, tolerancePercent) === "MATCH",
  );
  if (byAmount) {
    return byAmount;
  }

  // Last resort only when this is the sole PENDING intent on the shared address.
  if (pendingForAddress === 1) {
    return candidates[0];
  }
  return undefined;
}

async function applyObservedTransfer(
  db: PrismaClient,
  intent: PaymentIntent,
  transfer: IncomingTransfer,
  currentBlock: number,
  requiredConfirmations: number,
  tolerancePercent: number,
): Promise<void> {
  const requestedWei = toWei(intent.amountRequestedCrypto.toString());
  const classification = classifyPaymentAmount(requestedWei, transfer.valueWei, tolerancePercent);
  const confirmations = confirmationCount(transfer.blockNumber, currentBlock);
  const receivedAmountCrypto = fromWei(transfer.valueWei);
  const extra = {
    txHash: transfer.hash,
    txBlockNumber: transfer.blockNumber,
    confirmations,
    receivedAmountCrypto,
  };

  if (classification === "UNDERPAID") {
    await recordTransition(
      db,
      intent,
      PaymentStatus.UNDERPAID,
      `Received ${receivedAmountCrypto} ${intent.currencyCrypto} which is below requested ${intent.amountRequestedCrypto.toString()}`,
      extra,
    );
    return;
  }

  if (classification === "OVERPAID") {
    await recordTransition(
      db,
      intent,
      PaymentStatus.OVERPAID,
      `Received ${receivedAmountCrypto} ${intent.currencyCrypto} which is above requested ${intent.amountRequestedCrypto.toString()}`,
      extra,
    );
    return;
  }

  if (confirmations >= requiredConfirmations) {
    await recordTransition(
      db,
      intent,
      PaymentStatus.CONFIRMED,
      `Payment matched within tolerance with ${confirmations} confirmations`,
      extra,
    );
    return;
  }

  await db.paymentIntent.update({
    where: { id: intent.id },
    data: extra,
  });
}

export async function runWatcherTick(deps: WatcherTickDeps): Promise<void> {
  const db = deps.db ?? defaultPrisma;
  const now = deps.now ?? new Date();
  const requiredConfirmations = deps.requiredConfirmations ?? config.REQUIRED_CONFIRMATIONS;
  const tolerancePercent = deps.tolerancePercent ?? config.PAYMENT_TOLERANCE_PERCENT;
  const currentBlock = deps.toBlock ?? (await deps.chain.getBlockNumber());
  const fromBlock = deps.fromBlock ?? currentBlock;

  const pending = await db.paymentIntent.findMany({
    where: { status: PaymentStatus.PENDING },
    orderBy: { createdAt: "asc" },
  });

  const usedHashes = new Set(
    (
      await db.paymentIntent.findMany({
        where: { txHash: { not: null } },
        select: { txHash: true },
      })
    )
      .map((row) => row.txHash)
      .filter((hash): hash is string => Boolean(hash))
      .map((hash) => hash.toLowerCase()),
  );

  const addresses = [...new Set(pending.map((intent) => intent.expectedAddress.toLowerCase()))];
  const unmatched: IncomingTransfer[] = [];
  if (fromBlock <= currentBlock) {
    for (const address of addresses) {
      const incoming = await deps.chain.getIncomingTransfers(address, fromBlock, currentBlock);
      for (const transfer of incoming) {
        if (!usedHashes.has(transfer.hash.toLowerCase())) {
          unmatched.push(transfer);
        }
      }
    }
  }

  const pendingCountByAddress = pending.reduce<Record<string, number>>((acc, intent) => {
    const key = intent.expectedAddress.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  for (const intent of pending) {
    if (intent.txHash && intent.txBlockNumber != null) {
      const confirmations = confirmationCount(intent.txBlockNumber, currentBlock);
      const requestedWei = toWei(intent.amountRequestedCrypto.toString());
      const receivedWei = intent.receivedAmountCrypto
        ? toWei(intent.receivedAmountCrypto.toString())
        : 0n;
      const classification = intent.receivedAmountCrypto
        ? classifyPaymentAmount(requestedWei, receivedWei, tolerancePercent)
        : "MATCH";

      if (classification === "MATCH" && confirmations >= requiredConfirmations) {
        await recordTransition(
          db,
          intent,
          PaymentStatus.CONFIRMED,
          `Reached ${confirmations} confirmations for ${intent.txHash}`,
          {
            txHash: intent.txHash,
            txBlockNumber: intent.txBlockNumber,
            confirmations,
            receivedAmountCrypto: intent.receivedAmountCrypto?.toString(),
          },
        );
      } else if (intent.confirmations !== confirmations) {
        await db.paymentIntent.update({
          where: { id: intent.id },
          data: { confirmations },
        });
      }
      continue;
    }

    if (now >= intent.expiresAt) {
      await recordTransition(
        db,
        intent,
        PaymentStatus.EXPIRED,
        "expiresAt passed with no observed transaction",
        { confirmations: 0 },
      );
      continue;
    }

    const addressKey = intent.expectedAddress.toLowerCase();
    const chosen = pickTransferForIntent(
      intent,
      unmatched,
      pendingCountByAddress[addressKey] ?? 0,
      tolerancePercent,
    );
    if (!chosen) {
      continue;
    }

    const index = unmatched.findIndex((transfer) => transfer.hash === chosen.hash);
    if (index >= 0) {
      unmatched.splice(index, 1);
    }
    usedHashes.add(chosen.hash.toLowerCase());
    pendingCountByAddress[addressKey] = Math.max(0, (pendingCountByAddress[addressKey] ?? 1) - 1);

    await applyObservedTransfer(
      db,
      intent,
      chosen,
      currentBlock,
      requiredConfirmations,
      tolerancePercent,
    );
  }
}

export function createEthersChainReader(): ChainReader {
  const provider = getProvider();
  return {
    async getBlockNumber() {
      return provider.getBlockNumber();
    },
    async getIncomingTransfers(address: string, fromBlock: number, toBlock: number) {
      const results: IncomingTransfer[] = [];
      const target = address.toLowerCase();
      const start = Math.max(0, fromBlock);
      const end = Math.max(start, toBlock);
      const maxSpan = 40;
      const boundedStart = end - start + 1 > maxSpan ? end - maxSpan + 1 : start;

      for (let blockNumber = boundedStart; blockNumber <= end; blockNumber += 1) {
        const block = await provider.getBlock(blockNumber, true);
        if (!block) {
          continue;
        }
        for (const tx of block.prefetchedTransactions) {
          if (tx.to && tx.to.toLowerCase() === target && tx.value > 0n) {
            results.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              valueWei: tx.value,
              blockNumber,
              data: tx.data,
            });
          }
        }
      }
      return results;
    },
  };
}

export async function startPaymentWatcher(): Promise<void> {
  await assertConnectedToConfiguredChain();
  const chain = createEthersChainReader();
  lastScannedBlock = await chain.getBlockNumber();
  logger.info(
    {
      lastScannedBlock,
      pollIntervalMs: POLL_INTERVAL_MS,
      network: config.network,
      chainId: config.chainId,
      requiredConfirmations: config.REQUIRED_CONFIRMATIONS,
    },
    "payment watcher started",
  );

  const provider = getProvider();
  provider.on("block", (blockNumber: number) => {
    void runScheduledTick(chain, lastScannedBlock + 1, blockNumber);
  });

  pollTimer = setInterval(() => {
    void (async () => {
      const head = await chain.getBlockNumber();
      await runScheduledTick(chain, lastScannedBlock + 1, head);
    })();
  }, POLL_INTERVAL_MS);
  pollTimer.unref();
}

async function runScheduledTick(
  chain: ChainReader,
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  if (tickInFlight) {
    return;
  }
  tickInFlight = true;
  try {
    await runWatcherTick({
      chain,
      fromBlock: Math.min(fromBlock, toBlock),
      toBlock,
    });
    lastScannedBlock = Math.max(lastScannedBlock, toBlock);
  } catch (error) {
    logger.error({ err: error }, "payment watcher tick failed");
    enqueueOpsAlert({
      title: "Payment watcher tick failed",
      body: error instanceof Error ? error.message : "payment watcher tick failed",
      severity: "error",
      dedupeKey: "watcher-tick-failed",
    });
  } finally {
    tickInFlight = false;
  }
}

export function stopPaymentWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  try {
    getProvider().off("block");
  } catch {
    // provider may not have been constructed in tests
  }
}
