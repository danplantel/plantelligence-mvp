/**
 * T1 backfill — give every existing User an Organization and stamp
 * `organizationId` onto User and Client rows.
 *
 *   npx tsx scripts/teammates/backfill-organizations.ts [--dry-run]
 *
 * Idempotent: a user that already carries an `organizationId` is only checked
 * for unstamped plans, so re-running reports what is left to do and changes
 * nothing else.
 *
 * Additive by design — `Client.userId` is NEVER modified, because it remains the
 * anchor for the pre-T1 query surface. See plans/teammates-t1-data-model.md.
 *
 * IMPORTANT (MongoDB null semantics): the plan filter must match both an explicit
 * `null` AND an absent field. With this Prisma/MongoDB combination, `null` matches
 * only explicit nulls — a plain `{ organizationId: null }` silently skips every
 * row that never had the field set, which is all of them before the first run.
 * That bug is why the first pass reported "plans stamped: 0".
 */
import type { Prisma } from "@prisma/client";
import { createPrisma } from "./shared";

interface BrandingSnapshot {
  [key: string]: string | null;
  brandColor: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logo: string | null;
  backgroundImage: string | null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = createPrisma();

  let organizationsCreated = 0;
  let usersLinked = 0;
  let plansStamped = 0;
  let plansToStamp = 0;

  /** Plans that still need an org: explicit null OR field absent. */
  const clientNeedsOrg = (userId: string): Prisma.ClientWhereInput => ({
    userId,
    OR: [{ organizationId: null }, { organizationId: { isSet: false } }],
  });

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
        organizationName: true,
        organizationEmail: true,
        brandColor: true,
        primaryColor: true,
        secondaryColor: true,
        advisorLogo: true,
        advisorLogoUrl: true,
        backgroundImage: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(
      `Found ${users.length} user(s).${dryRun ? " (dry run — no writes)" : ""}`,
    );

    for (const user of users) {
      let organizationId = user.organizationId ?? null;

      if (!organizationId) {
        const existing = await prisma.organization.findFirst({
          where: { ownerUserId: user.id },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });

        if (existing) {
          organizationId = existing.id;
        } else if (dryRun) {
          organizationsCreated += 1;
          plansToStamp += await prisma.client.count({
            where: clientNeedsOrg(user.id),
          });
          console.log(`  would create Organization for ${user.email}`);
          continue;
        } else {
          const branding: BrandingSnapshot = {
            brandColor: user.brandColor ?? null,
            primaryColor: user.primaryColor ?? null,
            secondaryColor: user.secondaryColor ?? null,
            logo: user.advisorLogo ?? user.advisorLogoUrl ?? null,
            backgroundImage: user.backgroundImage ?? null,
          };

          const organization = await prisma.organization.create({
            data: {
              name:
                (user.organizationName && user.organizationName.trim()) ||
                user.name ||
                "Untitled Organization",
              ownerUserId: user.id,
              organizationEmail: user.organizationEmail ?? null,
              branding,
            },
            select: { id: true },
          });
          organizationId = organization.id;
          organizationsCreated += 1;
        }

        if (!dryRun && organizationId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { organizationId },
          });
          usersLinked += 1;
        }
      }

      if (!organizationId) continue;

      if (dryRun) {
        plansToStamp += await prisma.client.count({
          where: clientNeedsOrg(user.id),
        });
      } else {
        const result = await prisma.client.updateMany({
          where: clientNeedsOrg(user.id),
          data: { organizationId },
        });
        plansStamped += result.count;
      }
    }

    console.log("");
    console.log("Backfill summary");
    console.log(`  organizations created : ${organizationsCreated}`);
    console.log(`  users linked          : ${usersLinked}`);
    if (dryRun) {
      console.log(`  plans needing a stamp : ${plansToStamp}`);
    } else {
      console.log(`  plans stamped         : ${plansStamped}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
