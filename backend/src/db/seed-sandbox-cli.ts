import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { SANDBOX_SEED_API_KEY, SANDBOX_SEED_MERCHANT_ID, seedSandbox } from "./seed-sandbox";

async function main() {
  await seedSandbox();
  logger.info(
    { merchantId: SANDBOX_SEED_MERCHANT_ID },
    "sandbox seed complete — Flutter X-API-Key is the well-known sandbox_ seed key (see README)",
  );
  console.log(`Merchant: ${SANDBOX_SEED_MERCHANT_ID}`);
  console.log(`X-API-Key: ${SANDBOX_SEED_API_KEY}`);
}

void main()
  .catch((error) => {
    logger.error({ err: error }, "sandbox seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
