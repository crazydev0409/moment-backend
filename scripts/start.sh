#!/bin/sh
set -e

echo "🚀 Starting application..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

# Wait for database to be ready (for Railway/containerized environments)
echo "⏳ Waiting for database to be ready..."
RETRIES=30
DB_READY=0

while [ $RETRIES -gt 0 ]; do
  # Try to check migration status (this also verifies DB connection)
  if prisma migrate status > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    DB_READY=1
    break
  fi
  echo "Waiting for database... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $DB_READY -eq 0 ]; then
  echo "⚠️  Could not verify database connection after 60 seconds"
  echo "⚠️  Proceeding with migrations anyway (they may fail if DB is not ready)..."
fi

# Check for and resolve any failed migrations before running new ones
echo "🔍 Checking for failed migrations..."
# Don't fail if resolution script has issues - we'll try migrations anyway
node scripts/resolve-failed-migrations.js 2>&1 || {
  echo "⚠️  Migration resolution script had issues, but continuing with migration attempt..."
}

# Run database migrations
echo "📦 Running database migrations..."
echo "🔍 Checking migration files..."
if [ -d "prisma/migrations" ]; then
  echo "✅ Migrations directory exists"
  ls -la prisma/migrations/ 2>&1 || echo "⚠️  Could not list migrations directory"
  find prisma/migrations -name "migration.sql" 2>&1 || echo "⚠️  No migration.sql files found"
else
  echo "⚠️  Migrations directory does not exist!"
fi
MIGRATION_OUTPUT=$(prisma migrate deploy 2>&1)
MIGRATION_EXIT_CODE=$?
echo "Migration deploy output:"
echo "$MIGRATION_OUTPUT"

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  # Check if the error is due to failed migrations (P3009)
  if echo "$MIGRATION_OUTPUT" | grep -q "P3009\|failed migrations"; then
    echo "⚠️  Still found failed migrations after resolution attempt"
    echo "🔧 Attempting to resolve failed migrations from error output..."
    
    # Extract failed migration name from the error message
    FAILED_MIGRATION=$(echo "$MIGRATION_OUTPUT" | grep -oP '`\K[^`]+' | head -1 || echo "")
    
    if [ -n "$FAILED_MIGRATION" ]; then
      echo "📝 Resolving failed migration: $FAILED_MIGRATION"
      if prisma migrate resolve --applied "$FAILED_MIGRATION" 2>&1; then
        echo "✅ Successfully resolved failed migration"
        echo "🔄 Retrying migrations..."
        # Retry the migration after resolving
        if ! prisma migrate deploy; then
          echo "❌ Migration still failed after resolving!"
          exit 1
        fi
      else
        echo "⚠️  Could not automatically resolve migration"
        echo "❌ Migration failed!"
        echo "💡 You may need to manually resolve the failed migration:"
        echo "   prisma migrate resolve --applied $FAILED_MIGRATION"
        exit 1
      fi
    else
      echo "❌ Migration failed but could not identify failed migration name"
      echo "$MIGRATION_OUTPUT"
      exit 1
    fi
  else
    echo "❌ Migration failed with error:"
    echo "$MIGRATION_OUTPUT"
    exit 1
  fi
fi

echo "✅ Migrations completed successfully!"

# Ensure missing tables exist (for tables that might not have migrations)
echo "🔍 Ensuring all required tables exist..."
node scripts/create-missing-tables.js || {
  echo "⚠️  Table creation script had issues, but continuing..."
}

# Start the application
echo "🚀 Starting server..."
exec npm start

