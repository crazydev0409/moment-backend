-- NOTE: Prisma also detected a pre-existing orphan table `user_availability`
-- (left over from 0_init when the model was renamed to AvailabilitySlot) and
-- wanted to DROP it. That drop has been intentionally removed from this
-- migration to avoid destroying data; it is unrelated to the Hooks feature and
-- should be handled in a separate, deliberate migration.

-- AlterTable
ALTER TABLE "MomentRequest" ADD COLUMN     "hookId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "Hook" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "meetingType" TEXT,
    "category" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'personal',
    "state" TEXT NOT NULL DEFAULT 'active',
    "locationType" TEXT NOT NULL DEFAULT 'remote',
    "locationLabel" TEXT,
    "locationAddress" TEXT,
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "publishedToMesh" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookParticipant" (
    "id" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "userId" TEXT,
    "contactPhone" TEXT,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hook_ownerId_idx" ON "Hook"("ownerId");

-- CreateIndex
CREATE INDEX "Hook_accessLevel_state_idx" ON "Hook"("accessLevel", "state");

-- CreateIndex
CREATE INDEX "Hook_publishedToMesh_idx" ON "Hook"("publishedToMesh");

-- CreateIndex
CREATE INDEX "HookParticipant_userId_status_idx" ON "HookParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "HookParticipant_hookId_idx" ON "HookParticipant"("hookId");

-- CreateIndex
CREATE UNIQUE INDEX "HookParticipant_hookId_userId_key" ON "HookParticipant"("hookId", "userId");

-- CreateIndex
CREATE INDEX "MomentRequest_hookId_idx" ON "MomentRequest"("hookId");

-- AddForeignKey
ALTER TABLE "MomentRequest" ADD CONSTRAINT "MomentRequest_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "Hook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hook" ADD CONSTRAINT "Hook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HookParticipant" ADD CONSTRAINT "HookParticipant_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "Hook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HookParticipant" ADD CONSTRAINT "HookParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
