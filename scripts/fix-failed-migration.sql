-- Fix failed migration: 20251210014908_add_meeting_type_to_moment_request
-- This migration file doesn't exist in the codebase but is marked as failed in the database
-- Run this SQL to remove the failed migration record

-- Option 1: Delete the failed migration record (recommended if migration changes are already applied)
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251210014908_add_meeting_type_to_moment_request' 
  AND finished_at IS NULL;

-- Option 2: Mark as rolled back (if you want to keep the record but mark it as rolled back)
-- UPDATE "_prisma_migrations" 
-- SET finished_at = NOW(), rolled_back_at = NOW() 
-- WHERE migration_name = '20251210014908_add_meeting_type_to_moment_request' 
--   AND finished_at IS NULL;

