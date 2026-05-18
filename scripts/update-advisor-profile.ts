import { PrismaClient } from '@prisma/client';

async function main() {
  const userId = process.env.USER_ID;
  const categoriesJson = process.env.CATEGORIES_JSON;

  if (!userId || !categoriesJson) {
    console.error('Usage: USER_ID=... CATEGORIES_JSON=... npx ts-node scripts/update-advisor-profile.ts');
    process.exit(1);
  }

  try {
    const categories = JSON.parse(categoriesJson);
    const prisma = new PrismaClient();

    console.log(`Updating user ${userId} with categories:`, categories);

    await prisma.user.update({
      where: { id: userId },
      data: { primaryServiceCategories: categories } as any,
    });

    console.log('Successfully updated user profile categories.');
  } catch (error) {
    console.error('Failed to update user profile categories:', error);
    process.exit(1);
  }
}

main();
