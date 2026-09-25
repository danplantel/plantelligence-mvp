/**
 * Verify the T1 organization backfill.
 *
 *   npx tsx scripts/teammates/verify-backfill.ts
 *
 * The backfill is additive: it creates one `Organization` per existing `User`
 * and stamps `organizationId` onto `User` and `Client`. This asserts the
 * invariants that must hold afterwards — in particular that the legacy
 * `Client.userId` ownership anchor was left completely intact, since the whole
 * point of the additive migration is that pre-T1 queries keep working.
 *
 * Exit code is non-zero when an invariant is violated.
 */
import { check, createPrisma, failureCount, summary } from "./shared";

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, organizationId: true },
      orderBy: { createdAt: "asc" },
    });
    const organizations = await prisma.organization.findMany({
      select: { id: true, ownerUserId: true },
    });
    const clients = await prisma.client.findMany({
      select: { id: true, userId: true, organizationId: true, companyName: true },
    });

    console.log("T1 backfill verification");
    console.log("");
    console.log(`  users         : ${users.length}`);
    console.log(`  organizations : ${organizations.length}`);
    console.log(`  clients       : ${clients.length}`);
    console.log("");
    console.log("  owners:");
    for (const user of users) {
      console.log(
        `    ${user.organizationId ? "org ok " : "NO ORG "}  ${user.email}`,
      );
    }
    console.log("");

    const usersWithoutOrg = users.filter((u) => !u.organizationId);
    check(
      "every User has an organizationId",
      usersWithoutOrg.length === 0,
      `${usersWithoutOrg.length} missing`,
    );

    check(
      "Organization count matches User count (one org per owner)",
      organizations.length === users.length,
      `${organizations.length} orgs vs ${users.length} users`,
    );

    const userIds = new Set(users.map((u) => u.id));
    const orphanOrgs = organizations.filter((o) => !userIds.has(o.ownerUserId));
    check(
      "every Organization references a real User as owner",
      orphanOrgs.length === 0,
      `${orphanOrgs.length} orphaned`,
    );

    const clientsMissingOwner = clients.filter((c) => !c.userId);
    check(
      "legacy Client.userId ownership is intact for every plan",
      clientsMissingOwner.length === 0,
      `${clientsMissingOwner.length} missing userId`,
    );

    // Two classes of unstamped plan, and only one is a failure:
    //  (a) the owner User still exists, so the backfill should have stamped it;
    //  (b) the owner User is gone — a pre-existing orphaned plan that no
    //      backfill can attribute to an organization.
    const orphanClients = clients.filter((c) => !userIds.has(c.userId));
    const stampableUnstamped = clients.filter(
      (c) => userIds.has(c.userId) && !c.organizationId,
    );
    check(
      "every Client whose owner still exists is stamped with an organizationId",
      stampableUnstamped.length === 0,
      `${stampableUnstamped.length} unstamped`,
    );

    if (orphanClients.length > 0) {
      console.log("");
      console.log(
        `  NOTE: ${orphanClients.length} plan(s) are owned by a userId with no User row:`,
      );
      for (const client of orphanClients) {
        console.log(
          `    ${client.companyName} (${client.id})  userId=${client.userId}`,
        );
      }
      console.log(
        "  These are pre-existing orphans the backfill cannot attribute. Reported, not counted as failures.",
      );
    }

    const orgIds = new Set(organizations.map((o) => o.id));
    const clientsWithUnknownOrg = clients.filter(
      (c) => c.organizationId && !orgIds.has(c.organizationId),
    );
    check(
      "every Client organizationId points at a real Organization",
      clientsWithUnknownOrg.length === 0,
      `${clientsWithUnknownOrg.length} dangling`,
    );

    // A client's org must belong to the client's own legacy owner.
    const orgOwner = new Map(organizations.map((o) => [o.id, o.ownerUserId]));
    const mismatched = clients.filter(
      (c) =>
        c.organizationId && orgOwner.get(c.organizationId) !== c.userId,
    );
    check(
      "each Client's organization is owned by that Client's userId",
      mismatched.length === 0,
      mismatched
        .slice(0, 5)
        .map((c) => `${c.companyName} (${c.id})`)
        .join(", "),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    summary("T1 backfill verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("Backfill verification crashed:", error);
    process.exitCode = 1;
  });
