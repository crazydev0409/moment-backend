-- AlterTable
ALTER TABLE "User" ADD COLUMN "meetingTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

