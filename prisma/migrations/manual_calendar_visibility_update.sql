-- Add defaultCalendarVisibility to User table
ALTER TABLE "User" ADD COLUMN "defaultCalendarVisibility" TEXT NOT NULL DEFAULT 'busy';

-- Add sharedWith array to Moment table 
ALTER TABLE "Moment" ADD COLUMN "sharedWith" TEXT[] DEFAULT '{}';

-- Drop visibility column from Moment table (if exists)
ALTER TABLE "Moment" DROP COLUMN IF EXISTS "visibility";

-- Create BlockedContact table
CREATE TABLE "BlockedContact" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedContact_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on blocker and blocked
CREATE UNIQUE INDEX "BlockedContact_blockerId_blockedId_key" ON "BlockedContact"("blockerId", "blockedId");

-- Add foreign key constraints
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; 