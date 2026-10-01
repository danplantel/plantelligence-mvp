/**
 * Repair — re-anchor invited teammates to the organization that invited them.
 *
 *   npx tsx scripts/repair/reanchor-teammate-organizations.ts [--apply] [--delete-empty-orgs] [--include-dual-role]
 *
 * Why: `acceptInvitation` used to call `getOrCreateOrganizationForUser`, which answers "the
 * organization this User OWNS" and MINTS one when there is none. So every accepted
 * invitation left the invitee as the owner of a brand-new, empty organization, with
 * `User.organizationId` pointing at it — and `getOrgSession()` scopes every teammate read by
 * exactly that value. The invited person therefore landed in a workspace of their own instead
 * of the seat they were given, and never appeared in the inviting organization's session.
 *
 * That call is gone (see `anchorTeammateUserToInvitingOrganization`), which fixes NEW
 * acceptances. This repairs the accounts created before it.
 *
 * What it does per affected account: points `User.organizationId` at the organization whose
 * `TeammateProfile` carries their login — the same value `findTeammateOrganizationId`
 * resolves for them at runtime.
 *
 * Defaults to a DRY RUN. `--apply` writes, after dumping every row it is about to change to
 * `scripts/repair/backups/`.
 *
 * Two guard rails, because this touches tenancy:
 *
 *  - **A dual-role account is reported, not moved.** Somebody who owns an organization with
 *    plans AND is a linked teammate elsewhere has a legitimate workspace; re-anchoring them
 *    would move their home. Those are skipped unless `--include-dual-role` is passed.
 *  - **Deleting the minted organization is opt-in and strictly bounded.** `--delete-empty-orgs`
 *    removes it only when it is unmistakably a trace: owned by the same user, no plans, no
 *    other teammate profiles, and no plan assignments. Anything else is left behind and said
 *    so.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { createPrisma, PROJECT_ROOT } from "../teammates/shared";

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const DELETE_EMPTY_ORGS = ARGS.includes("--delete-empty-orgs");
const INCLUDE_DUAL_ROLE = ARGS.includes("--include-dual-role");

const BACKUP_DIR = path.join(PROJECT_ROOT, "scripts", "repair", "backups");

function databaseHost(): string {
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/@([^/:?]+)/);
  return match ? match[1] : "(unparsed)";
}

interface Affected {
  userId: string;
  userName: string;
  userEmail: string;
  currentOrganizationId: string | null;
  currentOrganizationName: string | null;
  currentOrganizationOwnedByUser: boolean;
  currentOrganizationPlans: number;
  currentOrganizationProfiles: number;
  currentOrganizationAssignments: number;
  invitingOrganizationId: string;
  invitingOrganizationName: string | null;
  profileIds: string[];
  dualRole: boolean;
}

/** Everything a decision about this account needs, gathered in one place. */
async function inspect(
  prisma: PrismaClient,
  profileRows: {
    id: string;
    loginUserId: string;
    organizationId: string;
    createdAt: Date;
  }[],
): Promise<Affected[]> {
  const byUser = new Map<string, typeof profileRows>();
  for (const row of profileRows) {
    const bucket = byUser.get(row.loginUserId) ?? [];
    bucket.push(row);
    byUser.set(row.loginUserId, bucket);
  }

  const found: Affected[] = [];

  for (const [userId, profiles] of byUser) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, organizationId: true },
    });
    if (!user) continue;

    // The earliest profile wins, matching `findTeammateOrganizationId`'s own
    // `orderBy: { createdAt: "asc" }`, so this script and the runtime resolver cannot
    // disagree about where a person belongs.
    const ordered = [...profiles].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const invitingOrganizationId = ordered[0].organizationId;

    if (user.organizationId === invitingOrganizationId) continue;

    const currentOrganizationId = user.organizationId ?? null;
    const [currentOrganization, plans, profileCount, assignmentCount] =
      await Promise.all([
        currentOrganizationId
          ? prisma.organization.findUnique({
              where: { id: currentOrganizationId },
              select: { name: true, ownerUserId: true },
            })
          : Promise.resolve(null),
        currentOrganizationId
          ? prisma.client.count({ where: { organizationId: currentOrganizationId } })
          : Promise.resolve(0),
        currentOrganizationId
          ? prisma.teammateProfile.count({
              where: { organizationId: currentOrganizationId },
            })
          : Promise.resolve(0),
        currentOrganizationId
          ? prisma.planAssignment.count({
              where: { organizationId: currentOrganizationId },
            })
          : Promise.resolve(0),
      ]);

    const invitingOrganization = await prisma.organization.findUnique({
      where: { id: invitingOrganizationId },
      select: { name: true },
    });

    const ownedByUser = currentOrganization?.ownerUserId === userId;

    found.push({
      userId: user.id,
      userName: user.name ?? "(no name)",
      userEmail: user.email,
      currentOrganizationId,
      currentOrganizationName: currentOrganization?.name ?? null,
      currentOrganizationOwnedByUser: ownedByUser,
      currentOrganizationPlans: plans,
      currentOrganizationProfiles: profileCount,
      currentOrganizationAssignments: assignmentCount,
      invitingOrganizationId,
      invitingOrganizationName: invitingOrganization?.name ?? null,
      profileIds: ordered.map((row) => row.id),
      // Their own workspace with real content: a person who is an advisor AND a guest.
      dualRole: ownedByUser && plans > 0,
    });
  }

  return found;
}

/** A minted-in-error organization, and nothing else. */
function isRemovableTrace(row: Affected): boolean {
  return (
    row.currentOrganizationOwnedByUser &&
    row.currentOrganizationPlans === 0 &&
    row.currentOrganizationProfiles === 0 &&
    row.currentOrganizationAssignments === 0 &&
    !!row.currentOrganizationId
  );
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    console.log("Re-anchor invited teammates to the organization that invited them");
    console.log("");
    console.log(`  database        : ${databaseHost()}`);
    console.log(`  mode            : ${APPLY ? "APPLY (writes)" : "dry run"}`);
    console.log(`  delete empty orgs: ${DELETE_EMPTY_ORGS ? "yes" : "no"}`);
    console.log(`  dual-role       : ${INCLUDE_DUAL_ROLE ? "move them too" : "report only"}`);
    console.log("");

    const profiles = await prisma.teammateProfile.findMany({
      where: { loginUserId: { not: null } },
      select: {
        id: true,
        loginUserId: true,
        organizationId: true,
        createdAt: true,
      },
    });
    console.log(`  ${profiles.length} linked teammate profile(s) on this database.`);

    const affected = await inspect(
      prisma,
      profiles as {
        id: string;
        loginUserId: string;
        organizationId: string;
        createdAt: Date;
      }[],
    );

    if (affected.length === 0) {
      console.log(
        "  Nothing to do: every linked account is anchored to the organization that invited it.",
      );
      return;
    }

    console.log(`  ${affected.length} account(s) anchored to the wrong organization.`);
    console.log("");

    let moved = 0;
    let deletedOrgs = 0;

    for (const row of affected) {
      console.log(`  ── ${row.userEmail}  (${row.userName})`);
      console.log(`     user                 ${row.userId}`);
      console.log(
        `     currently anchored   ${row.currentOrganizationId ?? "(none)"}  ${row.currentOrganizationName ?? ""}`,
      );
      console.log(
        `       owned by them: ${row.currentOrganizationOwnedByUser ? "yes" : "no"}` +
          ` · plans ${row.currentOrganizationPlans}` +
          ` · profiles ${row.currentOrganizationProfiles}` +
          ` · assignments ${row.currentOrganizationAssignments}`,
      );
      console.log(
        `     should be anchored   ${row.invitingOrganizationId}  ${row.invitingOrganizationName ?? ""}`,
      );
      console.log(`     teammate profile(s)  ${row.profileIds.join(", ")}`);

      if (row.dualRole && !INCLUDE_DUAL_ROLE) {
        console.log(
          "     SKIPPED: they own a workspace with plans of their own. Re-anchoring would move " +
            "their home organization; pass --include-dual-role to do it anyway.",
        );
        console.log("");
        continue;
      }

      if (!APPLY) {
        const removeNote =
          DELETE_EMPTY_ORGS && isRemovableTrace(row)
            ? " (its empty organization would also be deleted)"
            : DELETE_EMPTY_ORGS && row.currentOrganizationId
              ? " (their organization is NOT empty — it would be left in place)"
              : "";
        console.log(`     dry run — re-run with --apply to re-anchor${removeNote}`);
        console.log("");
        continue;
      }

      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(
        BACKUP_DIR,
        `reanchor-teammate-${row.userId}-${Date.now()}.json`,
      );
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          { removedAt: new Date().toISOString(), reason: "invited teammate anchored to a minted personal organization", row },
          null,
          2,
        ),
        "utf-8",
      );

      await prisma.user.update({
        where: { id: row.userId },
        data: { organizationId: row.invitingOrganizationId },
      });
      moved += 1;
      console.log(`     re-anchored → ${row.invitingOrganizationId}`);

      if (DELETE_EMPTY_ORGS && isRemovableTrace(row) && row.currentOrganizationId) {
        // Scoped by id, and only after the re-anchor: the user no longer points at it, and
        // every other check above said nothing else references it.
        await prisma.organization.delete({ where: { id: row.currentOrganizationId } });
        deletedOrgs += 1;
        console.log(`     deleted the empty organization ${row.currentOrganizationId}`);
      } else if (DELETE_EMPTY_ORGS && row.currentOrganizationId) {
        console.log(
          `     left ${row.currentOrganizationId} in place — it is not empty, so it is not a trace.`,
        );
      }

      console.log(`     backed up → ${path.relative(PROJECT_ROOT, backupPath)}`);
      console.log("");
    }

    console.log(
      APPLY
        ? `  Done. ${moved} account(s) re-anchored, ${deletedOrgs} organization(s) deleted.`
        : "  Dry run finished. Nothing was changed.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Repair failed:", error);
  process.exitCode = 1;
});
