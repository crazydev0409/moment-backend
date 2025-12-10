# Railway Deployment Guide

This guide explains how to deploy the backend application with PostgreSQL database to Railway.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Railway CLI installed (optional, for local testing)
3. Git repository connected to Railway

## Deployment Steps

### 1. Create a New Project on Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or use Railway CLI)

### 2. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a PostgreSQL service
4. Note the `DATABASE_URL` environment variable (Railway provides this automatically)

### 3. Deploy the Backend Service

1. In your Railway project, click "New"
2. Select "GitHub Repo" and choose your repository
3. Railway will detect the `Dockerfile` and `railway.toml`
4. Set the root directory to `moment-backend` (if deploying from monorepo)

### 4. Configure Environment Variables

In Railway, add the following environment variables to your backend service:

**Required:**
- `DATABASE_URL` - Automatically provided by Railway when you link the PostgreSQL service
- `JWT_SECRET` - At least 32 characters long (generate a secure random string)
- `JWT_REFRESH_SECRET` - At least 32 characters long (generate a secure random string)

**Twilio (Required for OTP/SMS):**
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID (starts with 'AC')
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token (32 characters)
- `TWILIO_PHONE_NUMBER` - Twilio phone number in E.164 format (e.g., +1234567890)
- `TWILIO_VERIFY_SERVICE_SID` - Twilio Verify Service SID (starts with 'VA')

**Optional:**
- `PORT` - Server port (default: 3000, Railway sets this automatically)
- `NODE_ENV` - Set to `production`
- `REDIS_URL` - Redis connection URL (if using Redis)
- `EVENT_BUS_ADAPTER` - Event bus adapter (`memory` or `kafka`, default: `memory`)

### 5. Link Services

1. In your backend service settings, go to "Variables"
2. Railway should automatically detect and link the PostgreSQL service
3. The `DATABASE_URL` will be automatically injected

### 6. Deploy

1. Railway will automatically build and deploy when you push to your repository
2. Or click "Deploy" in the Railway dashboard
3. Check the logs to ensure migrations run successfully

## How It Works

1. **Build Stage**: Docker builds the TypeScript application and generates Prisma client
2. **Production Stage**: Creates a minimal production image
3. **Startup**: The `start.sh` script:
   - Waits for the database to be ready
   - Runs Prisma migrations (`prisma migrate deploy`)
   - Starts the Node.js server

## Database Migrations

Migrations run automatically on every deployment via the `start.sh` script. This ensures:
- Database schema is always up to date
- New migrations are applied automatically
- No manual migration steps required

## Health Checks

Railway will automatically check the health of your service at:
- `http://your-service-url/api/health`

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Check that PostgreSQL service is running
- Ensure services are linked in Railway

### Migration Failures

- Check Railway logs for migration errors
- Verify Prisma schema is correct
- Ensure database has proper permissions

### Build Failures

- Check that all dependencies are in `package.json`
- Verify Dockerfile syntax
- Check Railway build logs for specific errors

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-provided by Railway) |
| `JWT_SECRET` | Yes | Secret for JWT token signing (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Secret for JWT refresh tokens (min 32 chars) |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio authentication token |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio phone number (E.164 format) |
| `TWILIO_VERIFY_SERVICE_SID` | Yes | Twilio Verify service identifier |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (set to `production`) |
| `REDIS_URL` | No | Redis connection URL |
| `EVENT_BUS_ADAPTER` | No | Event bus adapter (`memory` or `kafka`) |

## Monitoring

- View logs in Railway dashboard
- Check service health status
- Monitor database connections
- Track deployment history

## Support

For Railway-specific issues, check:
- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

