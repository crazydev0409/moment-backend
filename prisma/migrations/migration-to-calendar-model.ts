import { PrismaClient } from '@prisma/client';

/**
 * Migration script to move from user-centric to calendar-centric model
 * 
 * This script should be run after applying the schema changes:
 * 1. Creates a default calendar for each user
 * 2. Moves existing moments to the default calendar
 * 3. Migrates working hours to the default calendar
 * 4. Converts visibility permissions to calendar shares
 * 
 * Note: This script assumes you have already run prisma generate after updating the schema
 */

// Use any to bypass type checking during migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient() as any;

async function main() {
  try {
    console.log('Starting migration to calendar-centric model...');
    
    // Get all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users to migrate`);
    
    for (const user of users) {
      console.log(`Migrating user: ${user.id} (${user.name || 'unnamed'})`);
      
      // 1. Create default calendar for the user
      const defaultCalendar = await prisma.calendar.create({
        data: {
          userId: user.id,
          name: 'My Calendar',
          isDefault: true,
          defaultAccessLevel: user.defaultCalendarVisibility === 'detailed' ? 'view_book' : 'busy_time',
          color: '#4285F4', // Google blue as default color
        }
      });
      
      console.log(`Created default calendar: ${defaultCalendar.id}`);
      
      // 2. Get all moments for this user
      const moments = await prisma.moment.findMany({
        where: { userId: user.id },
        include: { momentRequest: true }
      });
      
      console.log(`Found ${moments.length} moments to migrate`);
      
      // Migrate each moment to the new calendar
      for (const moment of moments) {
        // We need to create a new moment with the new schema
        // and then update the momentRequest to point to the new moment
        const newMoment = await prisma.moment.create({
          data: {
            calendarId: defaultCalendar.id,
            startTime: moment.startTime,
            endTime: moment.endTime,
            availability: moment.availability,
            notes: moment.note,
            icon: moment.icon,
            allDay: moment.allDay,
            visibleTo: moment.sharedWith || [],
            createdAt: moment.createdAt,
            updatedAt: moment.updatedAt
          }
        });
        
        // If this moment is linked to a moment request, update the link
        if (moment.momentRequest) {
          await prisma.momentRequest.update({
            where: { id: moment.momentRequest.id },
            data: { momentId: newMoment.id }
          });
        }
        
        // Now we can delete the old moment
        await prisma.moment.delete({
          where: { id: moment.id }
        });
      }
      
      // 3. Migrate working hours
      const workingHours = await prisma.workingHours.findMany({
        where: { userId: user.id }
      });
      
      console.log(`Found ${workingHours.length} working hour settings to migrate`);
      
      for (const hours of workingHours) {
        await prisma.calendarWorkingHours.create({
          data: {
            calendarId: defaultCalendar.id,
            dayOfWeek: hours.dayOfWeek,
            startTime: hours.startTime,
            endTime: hours.endTime,
            isActive: hours.isActive
          }
        });
      }
      
      // 4. Migrate calendar visibility permissions
      const visibilityPermissions = await prisma.calendarVisibility.findMany({
        where: { ownerId: user.id }
      });
      
      console.log(`Found ${visibilityPermissions.length} visibility permissions to migrate`);
      
      for (const permission of visibilityPermissions) {
        await prisma.calendarShare.create({
          data: {
            calendarId: defaultCalendar.id,
            userId: permission.viewerId,
            accessLevel: user.defaultCalendarVisibility === 'detailed' ? 'view_book' : 'busy_time',
            createdAt: permission.createdAt,
            updatedAt: permission.updatedAt
          }
        });
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 