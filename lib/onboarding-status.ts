import prisma from "@/lib/prisma";

/**
 * Check if user has completed onboarding wizard
 */
export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  try {
    const completedSession = await prisma.wizardSession.findFirst({
      where: {
        userId: userId,
        completed: true,
      }
    });

    return !!completedSession;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}
