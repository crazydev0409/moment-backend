#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createMissingTables() {
  try {
    console.log('🔍 Checking for missing tables...');
    
    // Check if scheduled_events table exists
    const scheduledEventsExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scheduled_events'
      );
    `;
    
    // Check if event_store table exists
    const eventStoreExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_store'
      );
    `;
    
    const scheduledExists = scheduledEventsExists[0]?.exists || false;
    const storeExists = eventStoreExists[0]?.exists || false;
    
    if (!scheduledExists || !storeExists) {
      console.log('⚠️  Missing tables detected, creating them...');
      
      if (!scheduledExists) {
        console.log('📦 Creating scheduled_events table...');
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "scheduled_events" (
            "id" TEXT NOT NULL,
            "eventData" TEXT NOT NULL,
            "scheduledFor" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "attempts" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
          );
        `);
        
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "scheduled_events_scheduledFor_status_idx" 
          ON "scheduled_events"("scheduledFor", "status");
        `);
        
        console.log('✅ Created scheduled_events table');
      }
      
      if (!storeExists) {
        console.log('📦 Creating event_store table...');
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "event_store" (
            "id" TEXT NOT NULL,
            "eventType" TEXT NOT NULL,
            "aggregateId" TEXT NOT NULL,
            "aggregateType" TEXT NOT NULL,
            "version" INTEGER NOT NULL,
            "eventData" TEXT NOT NULL,
            "metadata" JSONB,
            "timestamp" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "event_store_pkey" PRIMARY KEY ("id")
          );
        `);
        
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "event_store_aggregateId_aggregateType_idx" 
          ON "event_store"("aggregateId", "aggregateType");
        `);
        
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "event_store_eventType_idx" 
          ON "event_store"("eventType");
        `);
        
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "event_store_timestamp_idx" 
          ON "event_store"("timestamp");
        `);
        
        console.log('✅ Created event_store table');
      }
      
      console.log('✅ All missing tables created successfully');
    } else {
      console.log('✅ All required tables exist');
    }
  } catch (error) {
    console.error('❌ Error creating missing tables:', error.message);
    // Don't throw - let the app continue
  } finally {
    await prisma.$disconnect();
  }
}

createMissingTables()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(0); // Exit with 0 so startup continues
  });

