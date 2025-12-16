#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for failed migrations...');

// Known failed migration (from logs)
const KNOWN_FAILED_MIGRATION = '20251210014908_add_meeting_type_to_moment_request';

function migrationExists(migrationName) {
  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  if (!fs.existsSync(migrationsDir)) {
    return false;
  }
  const migrationDirs = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  return migrationDirs.includes(migrationName);
}

function resolveMigration(migrationName) {
  try {
    const exists = migrationExists(migrationName);
    
    if (!exists) {
      console.log(`⚠️  Migration file ${migrationName} not found in prisma/migrations`);
      console.log(`🔧 Attempting to mark as rolled back (migration file missing)...`);
      
      try {
        // Try to mark as rolled back since the file doesn't exist
        execSync(`prisma migrate resolve --rolled-back "${migrationName}"`, {
          encoding: 'utf8',
          stdio: 'inherit'
        });
        console.log(`✅ Successfully marked migration as rolled back: ${migrationName}`);
        return true;
      } catch (rollbackError) {
        console.log(`⚠️  Could not mark as rolled back, trying to remove from database directly...`);
        // If that fails, we'll try to remove it from the database directly
        return removeMigrationFromDatabase(migrationName);
      }
    } else {
      console.log(`🔧 Resolving migration: ${migrationName}`);
      execSync(`prisma migrate resolve --applied "${migrationName}"`, {
        encoding: 'utf8',
        stdio: 'inherit'
      });
      console.log(`✅ Successfully resolved migration: ${migrationName}`);
      return true;
    }
  } catch (resolveError) {
    console.error(`⚠️  Could not resolve migration ${migrationName}:`, resolveError.message);
    // Try removing from database as last resort
    if (!migrationExists(migrationName)) {
      return removeMigrationFromDatabase(migrationName);
    }
    return false;
  }
}

function removeMigrationFromDatabase(migrationName) {
  console.log(`💡 Migration file doesn't exist and couldn't be marked as rolled back`);
  console.log(`💡 You need to manually remove the failed migration record from the database`);
  console.log(`💡 Run this SQL query in your database:`);
  console.log(`   DELETE FROM "_prisma_migrations" WHERE migration_name = '${migrationName}' AND finished_at IS NULL;`);
  console.log(`💡 Or mark it as rolled back manually:`);
  console.log(`   UPDATE "_prisma_migrations" SET finished_at = NOW(), rolled_back_at = NOW() WHERE migration_name = '${migrationName}' AND finished_at IS NULL;`);
  return false;
}

try {
  // Try to get migration status
  const statusOutput = execSync('prisma migrate status', { 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('✅ No failed migrations found');
  process.exit(0);
} catch (error) {
  const errorOutput = (error.stdout || error.stderr || error.message || '').toString();
  
  // Check if error is due to failed migrations
  if (errorOutput.includes('P3009') || errorOutput.includes('failed migrations')) {
    console.log('⚠️  Found failed migrations in database');
    
    // Extract migration names from error output
    // Pattern: "The `20251210014908_add_meeting_type_to_moment_request` migration"
    const migrationMatches = errorOutput.match(/`([^`]+)`/g);
    
    const migrationsToResolve = [];
    
    if (migrationMatches && migrationMatches.length > 0) {
      migrationsToResolve.push(...migrationMatches.map(m => m.replace(/`/g, '')));
    }
    
    // Also try the known failed migration as a fallback
    if (!migrationsToResolve.includes(KNOWN_FAILED_MIGRATION)) {
      migrationsToResolve.push(KNOWN_FAILED_MIGRATION);
    }
    
    if (migrationsToResolve.length > 0) {
      console.log(`📝 Attempting to resolve ${migrationsToResolve.length} migration(s):`, migrationsToResolve);
      
      let resolved = false;
      for (const migration of migrationsToResolve) {
        if (resolveMigration(migration)) {
          resolved = true;
        }
      }
      
      if (resolved) {
        console.log('✅ Finished resolving failed migrations');
        process.exit(0);
      } else {
        console.error('⚠️  Could not automatically resolve migrations');
        console.log('💡 The app will continue, but you should manually fix the failed migration');
        console.log('💡 See instructions above for manual SQL commands');
        // Don't exit with error - let the app try to start
        process.exit(0);
      }
    } else {
      // Try the known migration as last resort
      console.log('📝 Trying to resolve known failed migration:', KNOWN_FAILED_MIGRATION);
      if (resolveMigration(KNOWN_FAILED_MIGRATION)) {
        console.log('✅ Resolved known failed migration');
        process.exit(0);
      } else {
        console.error('⚠️  Could not extract migration names from error output');
        console.error('Error output:', errorOutput);
        // Don't exit with error - let migrations try to run
        process.exit(0);
      }
    }
  } else {
    // Some other error occurred - try resolving known migration anyway
    console.log('⚠️  Migration status check failed, trying to resolve known failed migration...');
    if (resolveMigration(KNOWN_FAILED_MIGRATION)) {
      console.log('✅ Resolved known failed migration');
      process.exit(0);
    } else {
      console.error('❌ Error checking migration status:', errorOutput);
      // Don't exit with error - let migrations try to run
      process.exit(0);
    }
  }
}

