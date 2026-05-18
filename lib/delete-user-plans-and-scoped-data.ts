import prisma from "@/lib/prisma";

/** Removes retirement plans, benefits clients, and plan-scoped hub data for the user. */
export async function deletePlansAndScopedDataForUser(
  userId: string,
): Promise<void> {
  await prisma.planAnalytic.deleteMany({
    where: {
      OR: [{ plan: { userId } }, { userId }],
    },
  });

  await prisma.planEvent.deleteMany({
    where: { plan: { userId } },
  });

  await prisma.plan.deleteMany({
    where: { userId },
  });

  await prisma.marketingFlyer.deleteMany({
    where: { userId },
  });

  await prisma.document.deleteMany({
    where: { client: { userId } },
  });

  await prisma.webinar.deleteMany({
    where: { userId },
  });

  await prisma.meeting.deleteMany({ where: { userId } });
  await prisma.meeting.deleteMany({
    where: { clientRecord: { userId } },
  });

  await prisma.client.deleteMany({
    where: { userId },
  });

  await prisma.newClientCompanyBasics.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientWelcomeStatement.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientKeyContacts.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientComplianceDocuments.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientEmployeePortalPreview.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientContactBuilder.deleteMany({
    where: { session: { userId } },
  });

  await prisma.newClientWizardSession.deleteMany({
    where: { userId },
  });
}
