import { app } from "./app";
import { startPaymentWatcher } from "./blockchain/watcher";
import { config } from "./config/env";
import { logger } from "./lib/logger";

const bold = (value: string): string => `\x1b[1m${value}\x1b[0m`;

if (config.NODE_ENV === "production") {
  logger.warn(
    "Never point NODE_ENV=production at a wallet holding real funds without going through the cutover checklist in /infra/CUTOVER_CHECKLIST.md",
  );
}

app.listen(config.PORT, () => {
  const banner = [
    "============================================================",
    "  CryptoChain backend",
    `  Mode:  ${bold(config.mode)}`,
    `  Chain: ${bold(config.chain)}`,
    `  Port:  ${config.PORT}`,
    "============================================================",
  ].join("\n");

  console.log(banner);
  logger.info({ mode: config.mode, chain: config.chain, port: config.PORT }, "backend started");

  void startPaymentWatcher().catch((error) => {
    logger.error({ err: error }, "failed to start payment watcher");
  });
});
