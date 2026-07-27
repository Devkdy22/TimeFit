ALTER TABLE "Notification"
  ADD COLUMN "dedupKey" TEXT,
  ADD COLUMN "eventType" TEXT;

CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");
