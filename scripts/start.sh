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
while [ $RETRIES -gt 0 ]; do
  # Try to connect using prisma migrate status (lightweight check)
  if prisma migrate status > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  echo "Waiting for database... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "⚠️  Could not verify database connection, proceeding with migrations anyway..."
fi

# Run database migrations
echo "📦 Running database migrations..."
prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "❌ Migration failed!"
  exit 1
fi

echo "✅ Migrations completed!"

# Start the application
echo "🚀 Starting server..."
exec npm start

