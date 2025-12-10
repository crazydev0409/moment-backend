# Railway Deployment Summary

## Files Created/Updated

### 1. **Dockerfile** (Updated)
- Multi-stage build for optimized production image
- Installs Prisma CLI globally for migrations
- Includes startup script that runs migrations before starting server
- Installs curl for health checks

### 2. **scripts/start.sh** (New)
- Startup script that:
  - Checks for DATABASE_URL
  - Waits for database to be ready
  - Runs Prisma migrations automatically
  - Starts the Node.js server

### 3. **railway.toml** (New)
- Railway configuration file
- Specifies Dockerfile as build method
- Sets startup command to run migrations first

### 4. **railway.json** (New)
- Alternative Railway configuration (JSON format)
- Same configuration as railway.toml

### 5. **README-RAILWAY.md** (New)
- Comprehensive deployment guide
- Step-by-step instructions
- Environment variables reference
- Troubleshooting guide

## Quick Start

1. **Create Railway Project**
   - Go to https://railway.app
   - Create new project
   - Connect your GitHub repository

2. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically provides `DATABASE_URL`

3. **Deploy Backend Service**
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Set root directory to `moment-backend` (if monorepo)
   - Railway will auto-detect Dockerfile

4. **Set Environment Variables**
   - Required: `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - Required: Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, etc.)
   - Optional: `PORT`, `NODE_ENV`, `REDIS_URL`, `EVENT_BUS_ADAPTER`

5. **Link Services**
   - Railway automatically links PostgreSQL service
   - `DATABASE_URL` is automatically injected

## How It Works

1. Railway builds the Docker image using the Dockerfile
2. On container start, `start.sh` script runs:
   - Waits for database connection
   - Runs `prisma migrate deploy` to apply migrations
   - Starts the Node.js server
3. Database migrations run automatically on every deployment

## Important Notes

- **Database Migrations**: Run automatically on startup via `start.sh`
- **Health Checks**: Railway checks `/api/health` endpoint
- **Port**: Railway sets `PORT` automatically (default: 3000)
- **Database**: Railway provides PostgreSQL as a separate service
- **Environment Variables**: Set in Railway dashboard under service settings

## Troubleshooting

- Check Railway logs for migration errors
- Verify `DATABASE_URL` is correctly set
- Ensure all required environment variables are configured
- Check that PostgreSQL service is running and linked

