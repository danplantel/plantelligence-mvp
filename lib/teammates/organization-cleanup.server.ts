/**
 * organization-cleanup.server — remove an organization's teammate data.
 *
 * Why this must exist explicitly: **the teammate models carry no foreign keys.**
 * `Organization.ownerUserId`, `TeammateProfile.organizationId`,
 * `PlanAssignment.profileId` / `clientId`, `TeammateAuditEvent.*`,
 * `TeammateCompany.organizationId` and `DirectThread.organizationId` are all plain scalars —
 * declared that way on purpose when
 * this module was built on MongoDB (see the note above `model Organization` in
 * `prisma/schema.prisma`: *"Why plain scalar `organizationId` instead of an `@relation`"*).
 * PostgreSQL therefore enforces **nothing** for them, and deleting the owning `User` leaves
 * the whole team behind: an Organization with no owner, plus its profiles, assignments,
 * companies and audit rows.
 *
 * `DirectThread` is the one entry above that is only PARTLY unprotected: its participants have
 * real cascading FKs, so the owner's own conversations go with their account. The threads between
 * two other people do not, and they are the reason it is swept here — see the note on the delete
 * in `deleteOrganizationTeammateData`.
 *
 * That is not hypothetical. Deleting a profile through the app left exactly that, and
 * `verify-backfill` — whose job is to assert the tenancy invariants — caught it:
 *
 *   FAIL  Organization count matches User count (one org per owner) — 1 orgs vs 0 users
 *   FAIL  every Organization references a real User as owner — 1 orphaned
 *
 * So account deletion calls this **before** it reports success. Deleting the dependants
 * first is also the order the relations would have imposed had they existed — the same
 * child-first discipline `lib/delete-client-scoped-data.ts` uses for the `Client`
 * relations, which *are* enforced.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";

export interface OrganizationTeammatePurgeResult {
  organizations: number;
  profiles: number;
  assignments: number;
  companies: number;
  auditEvents: number;
  directThreads: number;
}

/** Delete every teammate row scoped to an organization. Leaves the Organization itself. */
export async function deleteOrganizationTeammateData(
  organizationId: string,
): Promise<OrganizationTeammatePurgeResult> {
  // Nothing here references anything else, so the deletes are independent. They run as
  // ONE batch transaction rather than `Promise.all`: concurrent deletes checked out one pooled
  // connection each, and this runs inside account deletion — the request that was observed
  // tripping the pooled endpoint's limit. Audit rows are removed with the data they describe:
  // they are scoped by the organization, and an event whose subject no longer exists is not a
  // useful record.
  const [assignments, auditEvents, profiles, companies, directThreads] =
    await prisma.$transaction([
      prisma.planAssignment.deleteMany({ where: { organizationId } }),
      prisma.teammateAuditEvent.deleteMany({ where: { organizationId } }),
      prisma.teammateProfile.deleteMany({ where: { organizationId } }),
      prisma.teammateCompany.deleteMany({ where: { organizationId } }),
      // Direct message threads DO cascade from `User`, so deleting the owner's account would
      // remove the ones they are in — but not the others. Two COLLABORATORS can hold a thread
      // in this organization, and neither of their `User` rows is removed here, so without this
      // the thread would survive pointing at an organization that no longer exists. The
      // messages follow through the `DirectMessage` FK, one level down.
      prisma.directThread.deleteMany({ where: { organizationId } }),
    ]);

  return {
    organizations: 0,
    profiles: profiles.count,
    assignments: assignments.count,
    companies: companies.count,
    auditEvents: auditEvents.count,
    directThreads: directThreads.count,
  };
}

/**
 * Delete the organization owned by `userId`, and everything the teammate layer owns for it.
 *
 * Idempotent, and safe to call for a user who owns no organization — the normal case for a
 * collaborator, whose account came from accepting an invite rather than from signing up.
 */
export async function deleteOrganizationForOwner(
  userId: string,
): Promise<OrganizationTeammatePurgeResult> {
  const organizations = await prisma.organization.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  });

  const total: OrganizationTeammatePurgeResult = {
    organizations: 0,
    profiles: 0,
    assignments: 0,
    companies: 0,
    auditEvents: 0,
    directThreads: 0,
  };

  for (const organization of organizations) {
    const purged = await deleteOrganizationTeammateData(organization.id);

    // The Organization row goes last: it is the parent the rows above were scoped by, and
    // leaving it behind is precisely the orphan this function exists to prevent.
    await prisma.organization.delete({ where: { id: organization.id } });

    total.organizations += 1;
    total.profiles += purged.profiles;
    total.assignments += purged.assignments;
    total.companies += purged.companies;
    total.auditEvents += purged.auditEvents;
    total.directThreads += purged.directThreads;
  }

  return total;
}
