-- Migration: Remove Calendar, CalendarShare, CalendarWorkingHours tables
-- Update Moment table to use userId instead of calendarId

-- Step 1: Add userId column to Moment (nullable first, we'll populate it)
ALTER TABLE "Moment" ADD COLUMN "userId" TEXT;

-- Step 2: Populate userId from Calendar table for existing moments
UPDATE "Moment" m
SET "userId" = c."userId"
FROM "Calendar" c
WHERE m."calendarId" = c.id;

-- Step 3: Make userId NOT NULL after populating
ALTER TABLE "Moment" ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add foreign key constraint for userId
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Step 5: Drop the old calendarId foreign key constraint
ALTER TABLE "Moment" DROP CONSTRAINT IF EXISTS "Moment_calendarId_fkey";

-- Step 6: Remove calendarId column from Moment
ALTER TABLE "Moment" DROP COLUMN "calendarId";

-- Step 7: Drop CalendarWorkingHours table
DROP TABLE IF EXISTS "CalendarWorkingHours";

-- Step 8: Drop CalendarShare table
DROP TABLE IF EXISTS "CalendarShare";

-- Step 9: Drop Calendar table
DROP TABLE IF EXISTS "Calendar";

