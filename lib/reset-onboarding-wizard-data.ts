import prisma from "@/lib/prisma";

/** Deletes persisted onboarding wizard (5-step) rows for the user. */
export async function resetOnboardingWizardData(userId: string): Promise<void> {
  await prisma.wizardDisclaimers.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardUserSetup.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardEmployerScope.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardBenefitTypes.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardBranding.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardTeamMembers.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardInsuranceLicensing.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardServices.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardTeamSize.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardClientProfile.deleteMany({
    where: { session: { userId } },
  });

  await prisma.wizardSession.deleteMany({
    where: { userId },
  });
}
