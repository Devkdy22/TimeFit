ALTER TABLE "Notification"
  ADD COLUMN "providerTicketId" TEXT,
  ADD COLUMN "providerPushToken" TEXT,
  ADD COLUMN "receiptCheckedAt" TIMESTAMP(3);

CREATE INDEX "Notification_providerTicketId_receiptCheckedAt_idx"
  ON "Notification"("providerTicketId", "receiptCheckedAt");
