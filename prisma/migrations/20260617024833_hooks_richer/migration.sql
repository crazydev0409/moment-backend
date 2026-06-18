/*
  Warnings:

  - You are about to drop the `user_availability` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_availability" DROP CONSTRAINT "user_availability_userId_fkey";

-- AlterTable
ALTER TABLE "Hook" ADD COLUMN     "capacity" INTEGER;

-- DropTable
DROP TABLE "user_availability";

-- CreateTable
CREATE TABLE "HookAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL DEFAULT 540,
    "endMinutes" INTEGER NOT NULL DEFAULT 1020,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HookAvailabilitySlot_hookId_idx" ON "HookAvailabilitySlot"("hookId");

-- CreateIndex
CREATE UNIQUE INDEX "HookAvailabilitySlot_hookId_weekday_key" ON "HookAvailabilitySlot"("hookId", "weekday");

-- AddForeignKey
ALTER TABLE "HookAvailabilitySlot" ADD CONSTRAINT "HookAvailabilitySlot_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "Hook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
