-- Persist auth identities/sessions so login, refresh, logout, and revoke survive restarts
-- and multiple API instances. Refresh/access tokens are stored only as SHA-256 hashes.
CREATE TABLE "AuthIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");
CREATE UNIQUE INDEX "AuthSession_accessTokenHash_key" ON "AuthSession"("accessTokenHash");
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_refreshExpiresAt_idx" ON "AuthSession"("refreshExpiresAt");

ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Align Routine storage with the mobile/API DTO. Existing rows cannot be safely backfilled
-- without origin/destination place references, so place-backed rows are backfilled before
-- legacy columns are removed. Rows without place references are detectable with the launch
-- gate query in docs/sprint-1-5-migration-checklist.md.
ALTER TABLE "Routine" ADD COLUMN "originName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Routine" ADD COLUMN "originLat" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Routine" ADD COLUMN "originLng" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Routine" ADD COLUMN "destinationName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Routine" ADD COLUMN "destinationLat" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Routine" ADD COLUMN "destinationLng" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Routine" ADD COLUMN "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Routine" ADD COLUMN "arrivalTime" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Routine" ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Routine" ADD COLUMN "notificationMinutesBefore" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Routine" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Routine" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Routine" ADD COLUMN "savedRoute" JSONB;
ALTER TABLE "Routine" ADD COLUMN "expoPushToken" TEXT;
ALTER TABLE "Routine" ADD COLUMN "lastTriggeredAt" TIMESTAMP(3);

UPDATE "Routine" r
SET
  "originName" = p."label",
  "originLat" = p."lat",
  "originLng" = p."lng"
FROM "Place" p
WHERE r."originPlaceId" = p."id";

UPDATE "Routine" r
SET
  "destinationName" = p."label",
  "destinationLat" = p."lat",
  "destinationLng" = p."lng"
FROM "Place" p
WHERE r."destinationPlaceId" = p."id";

UPDATE "Routine"
SET "arrivalTime" = "arrivalRule"
WHERE "arrivalRule" ~ '^[0-2][0-9]:[0-5][0-9]$';

ALTER TABLE "Routine" ALTER COLUMN "originName" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "originLat" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "originLng" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "destinationName" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "destinationLat" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "destinationLng" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "weekdays" DROP DEFAULT;
ALTER TABLE "Routine" ALTER COLUMN "arrivalTime" DROP DEFAULT;

ALTER TABLE "Routine" DROP COLUMN IF EXISTS "originPlaceId";
ALTER TABLE "Routine" DROP COLUMN IF EXISTS "destinationPlaceId";
ALTER TABLE "Routine" DROP COLUMN IF EXISTS "arrivalRule";
ALTER TABLE "Routine" DROP COLUMN IF EXISTS "isActive";

CREATE INDEX "Routine_active_idx" ON "Routine"("active");
