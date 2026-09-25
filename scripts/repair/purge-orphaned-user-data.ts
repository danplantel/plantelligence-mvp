/**
 * Repair — purge everything left behind by a deleted User account.
 *
 *   npx tsx scripts/repair/purge-orphaned-user-data.ts [userId] [--apply]
 *
 * Why: deleting a `User` only removes the `User` row. Every plan, document,
 * meeting, wizard session, etc. that referenced it survives, owned by a `userId`
 * that no longer resolves. Those plans can never be attributed to an
 * Organization (so T1's backfill skips them) and teammate assignment on them is
 * refused. This removes them.
 *
 * Defaults to a DRY RUN. Pass `--apply` to delete. Before deleting anything it
 * writes a full JSON dump of every affected row to `scripts/repair/backups/`, so
 * the purge is reversible.
 *
 * Deletion order follows the codebase's own cascades — the plan-scoped group
 * reuses `lib/delete-client-scoped-data.ts` and
 * `lib/delete-user-plans-and-scoped-data.ts` — with the wizard-session children
 * (required relations) removed before their parent sessions.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createPrisma, PROJECT_ROOT } from "../teammates/shared";
import { deleteClientAndScopedData } from "../../lib/delete-client-scoped-data";
import { deletePlansAndScopedDataForUser } from "../../lib/delete-user-plans-and-scoped-data";

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
// The userId is the first non-flag argument, so `--apply` alone still targets
// the default account rather than being mistaken for an ObjectId.
const TARGET_USER_ID =
  ARGS.find((arg) => !arg.startsWith("--")) ?? "6a9b1976b81208c857a6922b";

/** Rows directly keyed by `userId`. */
const USER_SCOPED_MODELS = [
  "task",
  "headshot",
  "futureContact",
  "meetingCustomType",
  "wizardSession",
  "newClientWizardSession",
  "meeting",
  "webinar",
  "marketingFlyer",
  "marketingAsset",
  "plan",
  "planAnalytic",
  "client",
] as const;

/** Required children of `WizardSession` — must be deleted before the session. */
const WIZARD_SESSION_CHILDREN = [
  "wizardClientProfile",
  "wizardTeamSize",
  "wizardServices",
  "wizardInsuranceLicensing",
  "wizardTeamMembers",
  "wizardBranding",
  "wizardBenefitTypes",
  "wizardEmployerScope",
  "wizardUserSetup",
  "wizardDisclaimers",
] as const;

/** Required children of `NewClientWizardSession`. */
const NEW_CLIENT_SESSION_CHILDREN = [
  "newClientCompanyBasics",
  "newClientWelcomeStatement",
  "newClientKeyContacts",
  "newClientComplianceDocuments",
  "newClientEmployeePortalPreview",
  "newClientContactBuilder",
] as const;

interface AnyModel {
  count: (args?: unknown) => Promise<number>;
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
}

interface InventoryEntry {
  label: string;
  model: string;
  where: unknown;
}

/** Every table to back up / verify (deletion uses the app's cascades). */
const ALL_TABLES = [
  ...USER_SCOPED_MODELS,
  ...WIZARD_SESSION_CHILDREN,
  ...NEW_CLIENT_SESSION_CHILDREN,
  "organization",
  "document",
  "benefit",
  "video",
  "planEvent",
  "portalSlug",
] as const;

function rowLabel(row: Record<string, unknown>): string {
  return (
    (row.companyName as string) ??
    (row.name as string) ??
    (row.title as string) ??
    (row.email as string) ??
    (row.slug as string) ??
    String(row.id)
  );
}

async function main(): Promise<void> {
  const prisma = createPrisma();
  const db = prisma as unknown as Record<string, AnyModel>;

  try {
    console.log("Purge orphaned data for a deleted User");
    console.log("");
    console.log(`  target userId : ${TARGET_USER_ID}`);
    console.log(`  mode          : ${APPLY ? "APPLY (deletes)" : "dry run"}`);
    console.log("");

    // Never purge a live account's data.
    const user = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      select: { id: true, email: true },
    });
    if (user) {
      console.error(
        `  ABORT: User ${TARGET_USER_ID} (${user.email}) still exists. This purge is only for deleted accounts.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("  Confirmed: the User row does not exist.");
    console.log("");

    /* ── Inventory (phase 1: keyed by userId) ───────────────────────────── */

    const inventory: InventoryEntry[] = [];
    for (const model of USER_SCOPED_MODELS) {
      inventory.push({
        label: `${model} (userId)`,
        model,
        where: { userId: TARGET_USER_ID },
      });
    }
    for (const model of WIZARD_SESSION_CHILDREN) {
      inventory.push({
        label: `${model} (session.userId)`,
        model,
        where: { session: { userId: TARGET_USER_ID } },
      });
    }
    for (const model of NEW_CLIENT_SESSION_CHILDREN) {
      inventory.push({
        label: `${model} (session.userId)`,
        model,
        where: { session: { userId: TARGET_USER_ID } },
      });
    }
    inventory.push({
      label: "organization (ownerUserId)",
      model: "organization",
      where: { ownerUserId: TARGET_USER_ID },
    });

    const found = new Map<string, Record<string, unknown>[]>();
    let totalRows = 0;

    const collect = async (entry: InventoryEntry): Promise<void> => {
      const rows = await db[entry.model].findMany({ where: entry.where });
      if (rows.length === 0) return;
      totalRows += rows.length;
      const key = `${entry.model}::${entry.label}`;
      found.set(key, rows);

      const names = rows.map(rowLabel).slice(0, 3).join(", ");
      console.log(
        `    ${String(rows.length).padStart(4)}  ${entry.label}  — ${names}${rows.length > 3 ? " …" : ""}`,
      );
    };

    console.log("  Found:");
    for (const entry of inventory) {
      await collect(entry);
    }

    /* ── Inventory (phase 2: removed by the client/plan cascade) ────────── */

    // These are not keyed by userId, so they only surface once the client and
    // plan ids are known. They are backed up too, otherwise the purge would not
    // be reversible.
    const clientIds = [...found.entries()]
      .filter(([key]) => key.startsWith("client::"))
      .flatMap(([, rows]) => rows.map((row) => String(row.id)));
    const planIds = [...found.entries()]
      .filter(([key]) => key.startsWith("plan::"))
      .flatMap(([, rows]) => rows.map((row) => String(row.id)));

    const cascadeEntries: InventoryEntry[] = [
      {
        label: "document (client.userId)",
        model: "document",
        where: { client: { userId: TARGET_USER_ID } },
      },
      {
        label: "benefit (client.userId)",
        model: "benefit",
        where: { client: { userId: TARGET_USER_ID } },
      },
      {
        label: "video (client.userId)",
        model: "video",
        where: { client: { userId: TARGET_USER_ID } },
      },
      {
        label: "planEvent (plan.userId)",
        model: "planEvent",
        where: { plan: { userId: TARGET_USER_ID } },
      },
      {
        label: "portalSlug (clientId)",
        model: "portalSlug",
        where: { clientId: { in: clientIds } },
      },
      {
        label: "webinar (clientId)",
        model: "webinar",
        where: { clientId: { in: clientIds } },
      },
      {
        label: "meeting (clientId)",
        model: "meeting",
        where: { clientId: { in: clientIds } },
      },
      {
        label: "marketingAsset (clientId)",
        model: "marketingAsset",
        where: { clientId: { in: clientIds } },
      },
      {
        label: "marketingFlyer (clientId)",
        model: "marketingFlyer",
        where: { clientId: { in: clientIds } },
      },
      {
        label: "video (planId)",
        model: "video",
        where: { planId: { in: planIds } },
      },
    ];

    for (const entry of cascadeEntries) {
      inventory.push(entry);
      await collect(entry);
    }

    if (totalRows === 0) {
      console.log("    (nothing)");
      console.log("");
      console.log("Nothing to purge — no rows reference this userId.");
      return;
    }

    console.log("");
    console.log(`  Total rows referencing it: ${totalRows}`);

    // Informational: teammate rows belong to their organization, not to the
    // deleted login, so they are deliberately NOT purged.
    const teammateProfiles = await prisma.teammateProfile.findMany({
      where: { loginUserId: TARGET_USER_ID },
      select: { id: true, email: true, organizationId: true },
    });
    const teammateAuditEvents = await prisma.teammateAuditEvent.count({
      where: { actorUserId: TARGET_USER_ID },
    });
    if (teammateProfiles.length > 0 || teammateAuditEvents > 0) {
      console.log("");
      console.log("  Teammate references (NOT purged — they belong to their org):");
      console.log(`    profiles with this login   : ${teammateProfiles.length}`);
      console.log(`    audit events by this actor : ${teammateAuditEvents}`);
    }

    if (!APPLY) {
      console.log("");
      console.log("Dry run — nothing deleted. Re-run with --apply to purge.");
      return;
    }

    /* ── Backup ─────────────────────────────────────────────────────────── */

    const backupDir = path.join(PROJECT_ROOT, "scripts", "repair", "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(
      backupDir,
      `purged-user-${TARGET_USER_ID}-${Date.now()}.json`,
    );
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          targetUserId: TARGET_USER_ID,
          purgedAt: new Date().toISOString(),
          tables: [...found.entries()].map(([key, rows]) => ({
            key,
            count: rows.length,
            rows,
          })),
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log("");
    console.log(`  Backup written: ${path.relative(PROJECT_ROOT, backupPath)}`);
    console.log("");

    /* ── Delete ─────────────────────────────────────────────────────────── */

    // 1. Wizard session children before their parent sessions.
    for (const model of WIZARD_SESSION_CHILDREN) {
      const result = await db[model].deleteMany({
        where: { session: { userId: TARGET_USER_ID } },
      });
      if (result.count) console.log(`  ${model}: deleted ${result.count}`);
    }

    // 2. Direct userId rows with no dependants.
    for (const model of [
      "task",
      "headshot",
      "futureContact",
      "meetingCustomType",
    ] as const) {
      const result = await db[model].deleteMany({
        where: { userId: TARGET_USER_ID },
      });
      if (result.count) console.log(`  ${model}: deleted ${result.count}`);
    }

    // 3. Each plan plus its plan-scoped children, using the app's own cascade so
    //    Documents/Benefits/Meetings/Webinars/Marketing/Videos and PortalSlug
    //    aliases are removed in the order Prisma's required relations demand.
    const clients = await prisma.client.findMany({
      where: { userId: TARGET_USER_ID },
      select: { id: true, companyName: true },
    });
    for (const client of clients) {
      await deleteClientAndScopedData(client.id);
      console.log(`  client: deleted "${client.companyName}" (${client.id})`);
    }

    // 4. Remaining userId-scoped rows via the shared cascade helper (legacy
    //    Plan/Analytic/Event, any remaining Webinar/Meeting/MarketingFlyer/
    //    Document/Benefit/Client, and the NewClient wizard sessions).
    await prisma.wizardSession.deleteMany({
      where: { userId: TARGET_USER_ID },
    });
    await deletePlansAndScopedDataForUser(TARGET_USER_ID);
    console.log("  plans, scoped data, and remaining sessions: purged");

    // 5. An Organization this user owned, if one survived.
    const orgResult = await prisma.organization.deleteMany({
      where: { ownerUserId: TARGET_USER_ID },
    });
    if (orgResult.count) {
      console.log(`  organization: deleted ${orgResult.count}`);
    }

    /* ── Verify ─────────────────────────────────────────────────────────── */

    console.log("");
    let remaining = 0;
    for (const entry of inventory) {
      const count = await db[entry.model].count({ where: entry.where });
      remaining += count;
      if (count > 0) {
        console.error(`  REMAINING  ${entry.label}: ${count}`);
      }
    }
    console.log(
      remaining === 0
        ? "  Verified: no rows reference this userId any more."
        : `  WARNING: ${remaining} row(s) still reference it.`,
    );
    if (remaining > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Purge crashed:", error);
  process.exitCode = 1;
});
