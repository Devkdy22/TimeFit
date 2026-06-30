CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Device" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "pushToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Device_userId_idx" ON "Device"("userId");
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Place" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Place_userId_idx" ON "Place"("userId");
ALTER TABLE "Place" ADD CONSTRAINT "Place_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Preference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prepMinutes" INTEGER NOT NULL DEFAULT 10,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 8,
  "quietArrival" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Preference_userId_idx" ON "Preference"("userId");
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "arrivalAt" TIMESTAMP(3) NOT NULL,
  "departureAt" TIMESTAMP(3) NOT NULL,
  "totalEstimatedMin" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Recommendation_userId_idx" ON "Recommendation"("userId");
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecommendationRoute" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "durationMin" INTEGER NOT NULL,
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationRoute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationRoute_recommendationId_idx" ON "RecommendationRoute"("recommendationId");
ALTER TABLE "RecommendationRoute" ADD CONSTRAINT "RecommendationRoute_recommendationId_fkey"
  FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Routine" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originPlaceId" TEXT,
  "destinationPlaceId" TEXT,
  "arrivalRule" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'preparing',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expectedArrivalAt" TIMESTAMP(3),
  "plannedDurationMin" INTEGER,
  "delayOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");
CREATE INDEX "Trip_recommendationId_idx" ON "Trip"("recommendationId");
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_recommendationId_fkey"
  FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tripId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'push',
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TrafficSnapshot" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "congestionIndex" DOUBLE PRECISION NOT NULL,
  "ttlSeconds" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrafficSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrafficSnapshot_key_expiresAt_idx" ON "TrafficSnapshot"("key", "expiresAt");

CREATE TABLE "OdsayUsageDaily" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
  "totalRequests" INTEGER NOT NULL DEFAULT 0,
  "externalApiCalls" INTEGER NOT NULL DEFAULT 0,
  "cacheHits" INTEGER NOT NULL DEFAULT 0,
  "staleFallbackHits" INTEGER NOT NULL DEFAULT 0,
  "deduplicatedRequests" INTEGER NOT NULL DEFAULT 0,
  "successResponses" INTEGER NOT NULL DEFAULT 0,
  "failedResponses" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OdsayUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdsayUsageDaily_date_key" ON "OdsayUsageDaily"("date");

CREATE TABLE "SavedPlace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedLabel" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedPlace_userId_idx" ON "SavedPlace"("userId");
CREATE UNIQUE INDEX "SavedPlace_userId_normalizedLabel_key" ON "SavedPlace"("userId", "normalizedLabel");
