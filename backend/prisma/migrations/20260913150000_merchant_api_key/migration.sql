ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;

UPDATE "Merchant"
SET "apiKeyHash" = encode(sha256(('legacy-' || "id")::bytea), 'hex')
WHERE "apiKeyHash" IS NULL;

ALTER TABLE "Merchant" ALTER COLUMN "apiKeyHash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Merchant_apiKeyHash_key" ON "Merchant"("apiKeyHash");
