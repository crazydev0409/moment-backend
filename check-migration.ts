import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking calendars:');
    const calendars = await prisma.calendar.findMany();
    console.log(calendars);

    console.log('\nChecking moments:');
    const moments = await prisma.moment.findMany();
    console.log(moments);

    console.log('\nChecking moment with calendar:');
    const momentsWithCalendars = await prisma.moment.findMany({
      include: { calendar: true }
    });
    console.log(JSON.stringify(momentsWithCalendars, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }); 