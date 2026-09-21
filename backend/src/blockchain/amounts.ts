import { formatEther, parseEther } from "ethers";

export type AmountClass = "MATCH" | "UNDERPAID" | "OVERPAID";

export function toWei(amountCrypto: string): bigint {
  return parseEther(amountCrypto);
}

export function fromWei(amountWei: bigint): string {
  return formatEther(amountWei);
}

/**
 * Compare received vs requested using a percentage tolerance (e.g. 1 = ±1%).
 */
export function classifyPaymentAmount(
  requestedWei: bigint,
  receivedWei: bigint,
  tolerancePercent: number,
): AmountClass {
  if (requestedWei === 0n) {
    return receivedWei === 0n ? "MATCH" : "OVERPAID";
  }

  const delta =
    receivedWei >= requestedWei ? receivedWei - requestedWei : requestedWei - receivedWei;
  const toleranceBps = BigInt(Math.round(tolerancePercent * 100));
  const withinTolerance = delta * 10000n <= requestedWei * toleranceBps;

  if (withinTolerance) {
    return "MATCH";
  }
  return receivedWei < requestedWei ? "UNDERPAID" : "OVERPAID";
}

export function confirmationsBetween(txBlockNumber: number, currentBlockNumber: number): number {
  if (currentBlockNumber < txBlockNumber) {
    return 0;
  }
  return currentBlockNumber - txBlockNumber + 1;
}
