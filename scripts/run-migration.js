const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Reading SQL migration file...');
    const migrationPath = path.join(__dirname, '../prisma/migrations/manual_calendar_visibility_update.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL commands by semicolon
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
    
    console.log(`Found ${sqlCommands.length} SQL commands to execute`);
    
    // Execute each SQL command
    for (let i = 0; i < sqlCommands.length; i++) {
      const cmd = sqlCommands[i];
      console.log(`Executing command ${i + 1}/${sqlCommands.length}:`);
      console.log(cmd);
      
      try {
        await prisma.$executeRawUnsafe(`${cmd};`);
        console.log('Command executed successfully');
      } catch (err) {
        console.error(`Error executing command: ${err.message}`);
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration(); 