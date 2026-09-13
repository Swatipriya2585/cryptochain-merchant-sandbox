-- Baseline schema so `prisma migrate deploy` can provision an empty CI Postgres
-- (GitHub Actions service container). Later migrations stay incremental and
-- idempotent for existing local sandbox databases that predate this folder.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'UNDERPAID', 'OVERPAID', 'CONFIRMED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Merchant" (
    "id" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amountRequestedCrypto" DECIMAL(36,18) NOT NULL,
    "currencyCrypto" TEXT NOT NULL,
    "expectedAddress" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "txBlockNumber" INTEGER,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "receivedAmountCrypto" DECIMAL(36,18),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deliveredSuccessfully" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastHttpStatus" INTEGER,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payout" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amountFiat" DECIMAL(18,2) NOT NULL,
    "currencyFiat" TEXT NOT NULL DEFAULT 'INR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripePayoutId" TEXT,
    "stripePaymentIntentId" TEXT,
    "lastStripeEventType" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Merchant_apiKeyHash_key" ON "Merchant"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_reference_key" ON "PaymentIntent"("reference");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_txHash_key" ON "PaymentIntent"("txHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_expectedAddress_idx" ON "PaymentIntent"("expectedAddress");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_merchantId_idx" ON "PaymentIntent"("merchantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_paymentIntentId_idx" ON "WebhookEvent"("paymentIntentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_deliveredSuccessfully_idx" ON "WebhookEvent"("deliveredSuccessfully");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_paymentIntentId_idx" ON "AuditLog"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_paymentIntentId_key" ON "Payout"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_stripePayoutId_key" ON "Payout"("stripePayoutId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_stripePaymentIntentId_key" ON "Payout"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payout_merchantId_idx" ON "Payout"("merchantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
