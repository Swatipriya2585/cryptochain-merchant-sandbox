-- CreateTable
CREATE TABLE IF NOT EXISTS "Merchant" (
    "id" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- Backfill merchants and webhook delivery columns when upgrading an existing sandbox DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PaymentIntent'
  ) THEN
    INSERT INTO "Merchant" ("id", "webhookSecret", "createdAt", "updatedAt")
    SELECT DISTINCT pi."merchantId", 'whsec_sandbox_backfill', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "PaymentIntent" pi
    WHERE NOT EXISTS (
      SELECT 1 FROM "Merchant" m WHERE m."id" = pi."merchantId"
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'WebhookEvent'
  ) THEN
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deliveredSuccessfully" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "lastHttpStatus" INTEGER;
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PaymentIntent'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntent_merchantId_fkey'
  ) THEN
    ALTER TABLE "PaymentIntent"
      ADD CONSTRAINT "PaymentIntent_merchantId_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
