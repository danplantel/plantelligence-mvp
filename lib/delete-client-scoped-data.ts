import prisma from "@/lib/prisma";

/**
 * Deletes a Client (plan) row together with every plan-scoped record that
 * references it.
 *
 * Required relations are enforced by Prisma, so `prisma.client.delete*` throws
 * (P2014) while any child row still points at the client. Cleaning up only
 * Documents and Benefits — as the wizard publish path used to — therefore fails
 * silently for a plan that also owns a webinar, video, meeting, marketing
 * asset/flyer or portal slug, leaving the whole row behind. That was what made
 * publishing a resumed draft produce a second, identical Active plan next to the
 * draft it was supposed to replace.
 *
 * The order mirrors `DELETE /api/clients/[id]`.
 */
export async function deleteClientAndScopedData(
  clientId: string,
  userId?: string,
): Promise<void> {
  if (!clientId) return;
  // Plan-scoped children (webinar/benefit/document/meeting/marketing rows all
  // carry clientId; they are independent, so remove them in parallel).
  await Promise.all([
    prisma.webinar.deleteMany({ where: { clientId } }),
    // Benefit rows have a required BenefitToClient relation — they must go
    // before the client row or the delete throws P2014.
    prisma.benefit.deleteMany({ where: { clientId } }),
    prisma.document.deleteMany({ where: { clientId } }),
    prisma.meeting.deleteMany({
      where: { clientId },
    }),
    prisma.marketingAsset.deleteMany({ where: { clientId } }),
    prisma.marketingFlyer.deleteMany({ where: { clientId } }),
    prisma.video.deleteMany({ where: { clientId } }),
    // Retired/current slug aliases hold a scalar clientId (no relation), so
    // they never block the delete — but leaving them would keep orphan rows
    // reserving slugs that no longer belong to any plan.
    prisma.portalSlug.deleteMany({ where: { clientId } }),
  ]);

  await prisma.client.deleteMany({
    where: userId ? { id: clientId, userId } : { id: clientId },
  });
}
