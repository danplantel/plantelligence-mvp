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

  // Every task this login holds — their own, and every one assigned to them from a comment. They go
  // because the dashboard they lived on is going, and they MUST go before the caller deletes the
  // `User` row: `Task.userId` is a real relation with no cascade, so Prisma would refuse that delete
  // while these rows still point at it.
  //
  // Tasks this login ASSIGNED to other people stay: the work belongs to whoever holds it now, and
  // their byline degrades to "a teammate" rather than taking the work away with the assigner.
  await prisma.task.deleteMany({ where: { userId } });

  await prisma.plan.deleteMany({
    where: { userId },
  });

  await prisma.marketingFlyer.deleteMany({
    where: { userId },
  });

  await prisma.document.deleteMany({
    where: { client: { userId } },
  });

  // Benefit rows have a required BenefitToClient relation — they must be
  // removed before the client, otherwise prisma.client.deleteMany() throws P2014.
  await prisma.benefit.deleteMany({
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
