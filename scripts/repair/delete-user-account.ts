/**
 * Repair — delete a User account and everything it owns, by id.
 *
 *   npx tsx scripts/repair/delete-user-account.ts <userId> [--apply]
 *
 * Why this exists: deleting the `User` row directly (Neon SQL editor, `psql`, a GUI)
 * fails on the first foreign key — Prisma relations default to `Restrict`, so
 * `WizardSession.userId`, `Plan.userId`, `Client.userId`, `Task.userId`, … all refuse
 * while rows still point at the user. Deleting the children by hand is worse than the
 * error: the teammate models carry NO foreign keys (`Organization.ownerUserId`,
 * `TeammateProfile.*`, `PlanAssignment.*` are plain scalars), so a manual delete leaves
 * an ownerless Organization and orphaned plans/team rows behind with nothing to flag it.
 *
 * This script runs the SAME cascade the app runs on account deletion
 * (`DELETE /api/profile/delete`), reusing the tested helpers, in the order the relations
 * demand — plus `Task`, which that route does not yet clear.
 *
 * Defaults to a DRY RUN. Pass `--apply` to delete. Before deleting it writes a JSON
 * backup of the account's own rows (User, Organization, clients, plans) to
 * `scripts/repair/backups/`, so the change is traceable.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createPrisma, PROJECT_ROOT } from "../teammates/shared";
import { deleteClientAndScopedData } from "../../lib/delete-client-scoped-data";
import { deletePlansAndScopedDataForUser } from "../../lib/delete-user-plans-and-scoped-data";
import { deleteOrganizationForOwner } from "../../lib/teammates/organization-cleanup.server";
import { markProfilesSelfDeletedByLogin } from "../../lib/teammates/profiles.server";

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const TARGET_USER_ID = ARGS.find((arg) => !arg.startsWith("--")) ?? "";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!TARGET_USER_ID) {
    fail(
      "Usage: npx tsx scripts/repair/delete-user-account.ts <userId> [--apply]",
    );
  }

  const prisma = createPrisma();

  try {
    console.log("Delete a User account and everything it owns");
    console.log("");
    console.log(`  target userId : ${TARGET_USER_ID}`);
    console.log(`  mode          : ${APPLY ? "APPLY (deletes)" : "dry run"}`);
    console.log("");

    const user = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      fail(
        `  ABORT: no User with id ${TARGET_USER_ID}. If the row is already gone, use ` +
          `\`npm run repair:purge-orphaned-user -- ${TARGET_USER_ID} --apply\` instead.`,
      );
    }
    console.log(`  User: ${user.name} <${user.email}>`);
    console.log("");

    /* ── Inventory ──────────────────────────────────────────────────────── */

    const [clients, plans, wizardSessions, newClientSessions, organization] =
      await Promise.all([
        prisma.client.findMany({
          where: { userId: TARGET_USER_ID },
          select: { id: true, companyName: true },
        }),
        prisma.plan.findMany({
          where: { userId: TARGET_USER_ID },
          select: { id: true, clientName: true, companyName: true },
        }),
        prisma.wizardSession.findMany({
          where: { userId: TARGET_USER_ID },
          select: { id: true },
        }),
        prisma.newClientWizardSession.findMany({
          where: { userId: TARGET_USER_ID },
          select: { id: true },
        }),
        prisma.organization.findFirst({
          where: { ownerUserId: TARGET_USER_ID },
          select: { id: true, name: true },
        }),
      ]);

    // Every table whose FK to `User` is Restrict — the reason a raw `DELETE FROM "User"`
    // fails. Counted so a dry run shows exactly what blocks the delete.
    const fkCounts = await Promise.all(
      (
        [
          ["tasks", prisma.task.count({ where: { userId: TARGET_USER_ID } })],
          ["meeting custom types", prisma.meetingCustomType.count({ where: { userId: TARGET_USER_ID } })],
          ["future contacts", prisma.futureContact.count({ where: { userId: TARGET_USER_ID } })],
          ["headshots", prisma.headshot.count({ where: { userId: TARGET_USER_ID } })],
          ["marketing assets", prisma.marketingAsset.count({ where: { userId: TARGET_USER_ID } })],
          ["webinars", prisma.webinar.count({ where: { userId: TARGET_USER_ID } })],
          ["marketing flyers", prisma.marketingFlyer.count({ where: { userId: TARGET_USER_ID } })],
          ["meetings (userId)", prisma.meeting.count({ where: { userId: TARGET_USER_ID } })],
        ] as const
      ).map(async ([label, promise]) => [label, await promise] as const),
    );

    console.log("  Owned rows:");
    console.log(`    ${String(clients.length).padStart(4)}  clients (plans hub)`);
    console.log(`    ${String(plans.length).padStart(4)}  plans (retirement)`);
    console.log(`    ${String(wizardSessions.length).padStart(4)}  wizard sessions`);
    console.log(
      `    ${String(newClientSessions.length).padStart(4)}  new-client wizard sessions`,
    );
    console.log(
      `    ${organization ? `  1  organization — ${organization.name}` : "   0  organization"}`,
    );
    for (const [label, count] of fkCounts) {
      console.log(`    ${String(count).padStart(4)}  ${label}`);
    }
    console.log("");

    if (!APPLY) {
      console.log("  Dry run only — nothing was deleted.");
      console.log("  Re-run with --apply to delete.");
      return;
    }

    /* ── Backup ─────────────────────────────────────────────────────────── */

    const backupDir = path.join(PROJECT_ROOT, "scripts", "repair", "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(
      backupDir,
      `deleted-user-account-${TARGET_USER_ID}-${Date.now()}.json`,
    );
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ user, organization, clients, plans }, null, 2),
      "utf-8",
    );
    console.log(`  Backup written: ${path.relative(PROJECT_ROOT, backupPath)}`);
    console.log("");

    /* ── Cascade (mirrors DELETE /api/profile/delete) ───────────────────── */

    // 0. Rows that reference BOTH User and Client must go before either parent.
    await prisma.marketingAsset.deleteMany({ where: { userId: TARGET_USER_ID } });

    // 0b. Per-client cascade: portal slugs, videos, benefits, documents,
    //     meetings, webinars, marketing rows — everything whose FK would block
    //     the client delete. `deletePlansAndScopedDataForUser` clears the client
    //     rows themselves afterwards.
    for (const client of clients) {
      await deleteClientAndScopedData(client.id, TARGET_USER_ID);
    }

    // 1. Plans and every other user-scoped record (plan analytics/events,
    //    documents, benefits, meetings, webinars, marketing flyers, the client
    //    rows, and both new-client-wizard session trees).
    await deletePlansAndScopedDataForUser(TARGET_USER_ID);

    // 2. Onboarding wizard sessions: required step children first, then the
    //    parent sessions.
    if (wizardSessions.length > 0) {
      const sessionIds = wizardSessions.map((session) => session.id);
      await Promise.all([
        prisma.wizardUserSetup.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardBranding.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardClientProfile.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardTeamSize.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardServices.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardInsuranceLicensing.deleteMany({
          where: { sessionId: { in: sessionIds } },
        }),
        prisma.wizardTeamMembers.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardDisclaimers.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardEmployerScope.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        prisma.wizardBenefitTypes.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      ]);
      await prisma.wizardSession.deleteMany({ where: { userId: TARGET_USER_ID } });
    }

    // 3. Remaining rows keyed directly by userId. `task` is the one the profile
    //    delete route does not clear — its FK blocks the User delete otherwise.
    await prisma.task.deleteMany({ where: { userId: TARGET_USER_ID } });
    await prisma.meetingCustomType.deleteMany({ where: { userId: TARGET_USER_ID } });
    await prisma.futureContact.deleteMany({ where: { userId: TARGET_USER_ID } });
    await prisma.headshot.deleteMany({ where: { userId: TARGET_USER_ID } });

    // 4. The organization this user OWNS, plus its teammate rows. No foreign
    //    keys protect these, so nothing else removes them.
    await deleteOrganizationForOwner(TARGET_USER_ID);

    // 4b. Seats this login holds in organizations it does NOT own: flag the
    //     profile so an Owner/Admin can confirm the deletion (the app's own
    //     behaviour). Must run before the User row disappears, because the
    //     profiles are found by `loginUserId`.
    await markProfilesSelfDeletedByLogin(TARGET_USER_ID);

    // 5. The account itself.
    await prisma.user.delete({ where: { id: TARGET_USER_ID } });

    console.log("  Deleted. Verifying…");
    const stillThere = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      select: { id: true },
    });
    if (stillThere) {
      fail("  FAIL: the User row still exists after the delete.");
    }
    console.log("  Done — the User row is gone and every dependent row was cleared first.");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
