-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "MomentRequest"
ADD COLUMN IF NOT EXISTS "locationType" TEXT NOT NULL DEFAULT 'remote',
ADD COLUMN IF NOT EXISTS "locationLabel" TEXT,
ADD COLUMN IF NOT EXISTS "locationAddress" TEXT,
ADD COLUMN IF NOT EXISTS "locationLatitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "locationLongitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "accountEmail" TEXT,
    "accountName" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "encryptedCredentials" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "sourceCalendarName" TEXT,
    "providerUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AvailabilitySlot_userId_weekday_idx" ON "AvailabilitySlot"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarIntegration_userId_provider_key" ON "CalendarIntegration"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalCalendarEvent_integrationId_providerEventId_key" ON "ExternalCalendarEvent"("integrationId", "providerEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExternalCalendarEvent_startTime_endTime_idx" ON "ExternalCalendarEvent"("startTime", "endTime");

-- AddForeignKey
ALTER TABLE "AvailabilitySlot"
ADD CONSTRAINT "AvailabilitySlot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration"
ADD CONSTRAINT "CalendarIntegration_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent"
ADD CONSTRAINT "ExternalCalendarEvent_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
