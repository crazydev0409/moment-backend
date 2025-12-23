# Stage 1: Build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-slim AS production

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy Prisma schema, migrations, and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Ensure migrations directory exists and is accessible
RUN ls -la prisma/migrations/ 2>&1 || echo "Migrations directory check"

# Install Prisma CLI for migrations (needed in production)
RUN npm install -g prisma@^6.14.0

# Create scripts directory and copy startup scripts
RUN mkdir -p ./scripts
COPY scripts/start.sh ./scripts/start.sh
COPY scripts/resolve-failed-migrations.js ./scripts/resolve-failed-migrations.js
COPY scripts/create-missing-tables.js ./scripts/create-missing-tables.js
RUN chmod +x ./scripts/start.sh
RUN chmod +x ./scripts/resolve-failed-migrations.js
RUN chmod +x ./scripts/create-missing-tables.js

# Expose port
EXPOSE 3000

# Set Node environment to production
ENV NODE_ENV=production

# Start the server (script will run migrations first)
CMD ["./scripts/start.sh"] 