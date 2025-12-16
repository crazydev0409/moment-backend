-- CreateTable
CREATE TABLE IF NOT EXISTS "scheduled_events" (
    "id" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_events_scheduledFor_status_idx" ON "scheduled_events"("scheduledFor", "status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_store" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventData" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_store_aggregateId_aggregateType_idx" ON "event_store"("aggregateId", "aggregateType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_store_eventType_idx" ON "event_store"("eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_store_timestamp_idx" ON "event_store"("timestamp");

