#!/bin/sh
set -e

echo "Starting application..."

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "DATABASE_URL is configured"

# Run database migrations directly (managed DB services are always ready)
echo "Running database migrations..."
prisma migrate deploy 2>&1 || {
  echo "Migration failed, but continuing to start server..."
}

# Start the application
echo "Starting server..."
exec npm start

