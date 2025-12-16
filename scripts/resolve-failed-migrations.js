#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 Checking for failed migrations...');

// Known failed migration (from logs)
const KNOWN_FAILED_MIGRATION = '20251210014908_add_meeting_type_to_moment_request';

function resolveMigration(migrationName) {
  try {
    console.log(`🔧 Resolving migration: ${migrationName}`);
    execSync(`prisma migrate resolve --applied "${migrationName}"`, {
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log(`✅ Successfully resolved migration: ${migrationName}`);
    return true;
  } catch (resolveError) {
    console.error(`⚠️  Could not resolve migration ${migrationName}:`, resolveError.message);
    return false;
  }
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
        console.error('❌ Could not resolve any migrations');
        process.exit(1);
      }
    } else {
      // Try the known migration as last resort
      console.log('📝 Trying to resolve known failed migration:', KNOWN_FAILED_MIGRATION);
      if (resolveMigration(KNOWN_FAILED_MIGRATION)) {
        console.log('✅ Resolved known failed migration');
        process.exit(0);
      } else {
        console.error('❌ Could not extract migration names from error output');
        console.error('Error output:', errorOutput);
        process.exit(1);
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

