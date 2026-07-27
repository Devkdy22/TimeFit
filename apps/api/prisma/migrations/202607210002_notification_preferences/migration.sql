ALTER TABLE "Preference"
  ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "departureLeadMinutes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "delayNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rerouteNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "vibrationEnabled" BOOLEAN NOT NULL DEFAULT true;
