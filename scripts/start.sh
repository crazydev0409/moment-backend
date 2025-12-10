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

# Run database migrations
echo "📦 Running database migrations..."
if ! prisma migrate deploy; then
  echo "❌ Migration failed!"
  echo "❌ Please check your database connection and migration files"
  exit 1
fi

echo "✅ Migrations completed successfully!"

# Start the application
echo "🚀 Starting server..."
exec npm start

