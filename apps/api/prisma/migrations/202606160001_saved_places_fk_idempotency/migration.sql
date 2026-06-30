-- Sprint 2 launch policy: legacy routines without weekday source data must not run
-- automatically after launch. Users can re-enable them after selecting weekdays.
UPDATE "Routine"
SET "active" = false
WHERE "weekdays" = ARRAY[]::INTEGER[]
  AND "active" = true;

-- SavedPlace must be owned by a valid User before the FK is enforced.
-- Orphan rows cannot be surfaced to a real user and are removed during launch hardening.
DELETE FROM "SavedPlace" sp
WHERE NOT EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."id" = sp."userId"
);

ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
  "responseSnapshot" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_userId_scope_key_key" ON "IdempotencyKey"("userId", "scope", "key");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");
CREATE INDEX "IdempotencyKey_userId_scope_idx" ON "IdempotencyKey"("userId", "scope");

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
