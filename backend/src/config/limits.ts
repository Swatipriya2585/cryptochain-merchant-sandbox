import { toWei } from "../blockchain/amounts";
import { HttpError } from "../http/envelope";
import { config, type Config } from "./env";

export function assertPaymentsAllowed(cfg: Config = config): void {
  if (!cfg.PAYMENTS_ENABLED) {
    throw new HttpError(
      403,
      "Payments are disabled (PAYMENTS_ENABLED=false). This is the production kill switch — set it to true in the secret store only after CUTOVER_CHECKLIST.md is signed off.",
    );
  }
}

/**
 * Server-side cap. The frontend value is untrusted; this is the only number that matters.
 */
export function assertAmountWithinCap(amountCrypto: string, cfg: Config = config): bigint {
  let amountWei: bigint;
  try {
    amountWei = toWei(amountCrypto.trim());
  } catch {
    throw new HttpError(400, "amountRequestedCrypto must be a valid ETH amount", [
      { field: "amountRequestedCrypto", message: "must be a valid ETH decimal" },
    ]);
  }

  if (amountWei <= 0n) {
    throw new HttpError(400, "amountRequestedCrypto must be greater than zero", [
      { field: "amountRequestedCrypto", message: "must be greater than zero" },
    ]);
  }

  let capWei: bigint;
  try {
    capWei = toWei(cfg.MAX_TRANSACTION_AMOUNT);
  } catch {
    throw new HttpError(500, "MAX_TRANSACTION_AMOUNT is not a valid ETH amount");
  }

  if (amountWei > capWei) {
    throw new HttpError(
      400,
      `amountRequestedCrypto exceeds MAX_TRANSACTION_AMOUNT (${cfg.MAX_TRANSACTION_AMOUNT} ETH)`,
      [
        {
          field: "amountRequestedCrypto",
          message: `must be ≤ ${cfg.MAX_TRANSACTION_AMOUNT} ETH (server-side cap)`,
        },
      ],
    );
  }

  return amountWei;
}
