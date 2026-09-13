DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayoutStatus') THEN
    CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
  END IF;
END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_paymentIntentId_key" ON "Payout"("paymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_stripePayoutId_key" ON "Payout"("stripePayoutId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_stripePaymentIntentId_key" ON "Payout"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "Payout_merchantId_idx" ON "Payout"("merchantId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_paymentIntentId_fkey') THEN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentIntentId_fkey"
      FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_merchantId_fkey') THEN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_merchantId_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
