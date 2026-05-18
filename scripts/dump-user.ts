import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const email = 'vlad@example.com'; // Adjust if needed

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'vlad' } },
        { name: { contains: 'vlad' } }
      ]
    },
    include: {
      wizardSessions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          userSetup: true,
          branding: true
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('USER DATA:');
  console.log(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    title: user.title,
    headshot: user.advisorLogoUrl,
    primaryServiceCategories: (user as any).primaryServiceCategories
  }, null, 2));

  if (user.wizardSessions[0]) {
    console.log('\nWIZARD SESSION USER SETUP:');
    console.log(JSON.stringify(user.wizardSessions[0].userSetup, null, 2));
    console.log('\nWIZARD SESSION BRANDING:');
    console.log(JSON.stringify(user.wizardSessions[0].branding, null, 2));
  }
}

main().catch(console.error);
