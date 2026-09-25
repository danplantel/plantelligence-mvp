/**
 * Repair — resolve data that blocks `prisma db push` from building unique indexes.
 *
 *   npx tsx scripts/repair/fix-unique-conflicts.ts            # dry run
 *   npx tsx scripts/repair/fix-unique-conflicts.ts --apply    # delete redundant rows
 *
 * Background: several models declare `sessionId @unique`, but the wizard writes
 * these rows with a read-then-write pattern (`findFirst({ where: { sessionId } })`
 * → update or create). Concurrent or retried step saves therefore leave a second
 * row for the same session. Because MongoDB pushes are not transactional, ONE
 * such duplicate aborts the whole push — every index after it in the plan is
 * skipped, which is how this blocked T1.
 *
 * Two classes of conflict, handled differently:
 *
 *  1. **Session-scoped step rows** (group A). These are 1:1 children of a
 *     `WizardSession`/`NewClientWizardSession`. A duplicate is a redundant
 *     sibling, so the most recently updated row is kept and the rest are deleted.
 *     Auto-repairable with `--apply`.
 *
 *  2. **Primary business data** (group B: `Client.slug`, `PortalSlug.slug`,
 *     `Benefit(clientId, category)`). A duplicate here is a real modelling
 *     question — which slug should win? — so this script only REPORTS those and
 *     exits non-zero. Fixing them is a deliberate decision, not a repair.
 *
 * Every row that would be deleted is written to
 * `scripts/repair/backups/unique-conflicts-<timestamp>.json` before any deletion.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createPrisma, PROJECT_ROOT } from "../teammates/shared";

const APPLY = process.argv.includes("--apply");

/** Group A — 1:1 session step rows. Prisma delegate name → collection label. */
const SESSION_STEP_MODELS = [
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
  "newClientCompanyBasics",
  "newClientWelcomeStatement",
  "newClientKeyContacts",
  "newClientComplianceDocuments",
  "newClientEmployeePortalPreview",
] as const;

interface StepRow {
  id: string;
  sessionId: string;
  updatedAt?: Date;
}

/** Row shapes for the report-only scans, so the mappers stay typed. */
interface ClientSlugRow {
  id: string;
  slug: string | null;
  userId: string;
  companyName: string;
}

interface PortalSlugRow {
  id: string;
  slug: string;
  clientId: string;
  isCurrent: boolean;
}

interface BenefitRow {
  id: string;
  clientId: string;
  category: string;
}

interface SessionGroup {
  model: string;
  sessionId: string;
  rows: StepRow[];
}

interface BusinessConflict {
  label: string;
  key: string;
  count: number;
  detail: string;
}

async function scanSessionSteps(prisma: any): Promise<SessionGroup[]> {
  const groups: SessionGroup[] = [];

  for (const model of SESSION_STEP_MODELS) {
    const rows: StepRow[] = await prisma[model].findMany({
      select: { id: true, sessionId: true, updatedAt: true },
      orderBy: [{ sessionId: "asc" }, { updatedAt: "desc" }],
    });

    const bySession = new Map<string, StepRow[]>();
    for (const row of rows) {
      const key = String(row.sessionId);
      const bucket = bySession.get(key);
      if (bucket) bucket.push(row);
      else bySession.set(key, [row]);
    }

    for (const [sessionId, bucket] of bySession) {
      if (bucket.length > 1) groups.push({ model, sessionId, rows: bucket });
    }
  }

  return groups;
}

async function scanBusinessUniques(prisma: any): Promise<BusinessConflict[]> {
  const conflicts: BusinessConflict[] = [];

  // Client.slug — @unique, nullable.
  const clients: ClientSlugRow[] = await prisma.client.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true, userId: true, companyName: true },
  });
  const bySlug = new Map<string, ClientSlugRow[]>();
  for (const client of clients) {
    const key = String(client.slug);
    const bucket = bySlug.get(key);
    if (bucket) bucket.push(client);
    else bySlug.set(key, [client]);
  }
  for (const [slug, bucket] of bySlug) {
    if (bucket.length > 1) {
      conflicts.push({
        label: "Client.slug",
        key: slug,
        count: bucket.length,
        detail: bucket.map((c) => `${c.companyName} (${c.id})`).join(", "),
      });
    }
  }

  // PortalSlug.slug — @unique and globally reserved.
  const portalSlugs: PortalSlugRow[] = await prisma.portalSlug.findMany({
    select: { id: true, slug: true, clientId: true, isCurrent: true },
  });
  const byPortalSlug = new Map<string, PortalSlugRow[]>();
  for (const row of portalSlugs) {
    const bucket = byPortalSlug.get(row.slug);
    if (bucket) bucket.push(row);
    else byPortalSlug.set(row.slug, [row]);
  }
  for (const [slug, bucket] of byPortalSlug) {
    if (bucket.length > 1) {
      conflicts.push({
        label: "PortalSlug.slug",
        key: slug,
        count: bucket.length,
        detail: bucket.map((r) => `${r.clientId} (${r.id})`).join(", "),
      });
    }
  }

  // Benefit (clientId, category) — @@unique.
  const benefits: BenefitRow[] = await prisma.benefit.findMany({
    select: { id: true, clientId: true, category: true },
  });
  const byBenefitKey = new Map<string, BenefitRow[]>();
  for (const benefit of benefits) {
    const key = `${benefit.clientId}::${benefit.category}`;
    const bucket = byBenefitKey.get(key);
    if (bucket) bucket.push(benefit);
    else byBenefitKey.set(key, [benefit]);
  }
  for (const [key, bucket] of byBenefitKey) {
    if (bucket.length > 1) {
      conflicts.push({
        label: "Benefit(clientId, category)",
        key,
        count: bucket.length,
        detail: bucket.map((b) => b.id).join(", "),
      });
    }
  }

  return conflicts;
}

async function main(): Promise<void> {
  const prisma = createPrisma();
  // Dynamic delegate lookup (`db[model].deleteMany`) — the model name is data,
  // so it cannot be statically indexed on PrismaClient.
  const db = prisma as unknown as Record<
    string,
    { deleteMany: (args: unknown) => Promise<{ count: number }> }
  >;
  let blocking = 0;

  try {
    console.log("Unique-index conflict scan");
    console.log("");

    /* ── Group A: auto-repairable session step rows ─────────────────────── */

    const groups = await scanSessionSteps(prisma);
    const toDelete = groups.flatMap((group) => group.rows.slice(1));

    console.log("A. Session step rows (auto-repairable)");
    console.log(`   duplicated session rows : ${toDelete.length}`);
    if (groups.length > 0) {
      console.log("   affected collections:");
      const perModel = new Map<string, number>();
      for (const group of groups) {
        perModel.set(group.model, (perModel.get(group.model) ?? 0) + 1);
      }
      for (const [model, count] of perModel) {
        console.log(`     ${model}: ${count} duplicated session(s)`);
      }
    }
    console.log("");

    /* ── Group B: report-only business data ─────────────────────────────── */

    const businessConflicts = await scanBusinessUniques(prisma);
    console.log("B. Primary business data (report only — needs a decision)");
    if (businessConflicts.length === 0) {
      console.log("   no conflicts found");
    } else {
      blocking += businessConflicts.length;
      for (const conflict of businessConflicts) {
        console.log(
          `   ${conflict.label} "${conflict.key}" ×${conflict.count}: ${conflict.detail}`,
        );
      }
    }
    console.log("");

    if (toDelete.length === 0) {
      console.log("No session-step duplicates to repair.");
    } else if (!APPLY) {
      console.log(
        `${toDelete.length} row(s) would be deleted. Re-run with --apply to proceed.`,
      );
      blocking += 1;
    } else {
      const backupDir = path.join(PROJECT_ROOT, "scripts", "repair", "backups");
      fs.mkdirSync(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, `unique-conflicts-${Date.now()}.json`);
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          groups.map((group) => ({
            model: group.model,
            sessionId: group.sessionId,
            kept: group.rows[0],
            deleted: group.rows.slice(1),
          })),
          null,
          2,
        ),
        "utf-8",
      );
      console.log(
        `   Backup written: ${path.relative(PROJECT_ROOT, backupPath)}`,
      );

      const perModelDeleted = new Map<string, string[]>();
      for (const group of groups) {
        const ids = group.rows.slice(1).map((row) => row.id);
        const bucket = perModelDeleted.get(group.model) ?? [];
        bucket.push(...ids);
        perModelDeleted.set(group.model, bucket);
      }

      let deleted = 0;
      for (const [model, ids] of perModelDeleted) {
        const result = await db[model].deleteMany({ where: { id: { in: ids } } });
        deleted += result.count;
        console.log(`   ${model}: deleted ${result.count}`);
      }
      console.log("");

      // Re-verify: every session-scoped step model must now be unique.
      const remaining = await scanSessionSteps(prisma);
      if (remaining.length === 0) {
        console.log(
          `   Verified: ${deleted} redundant row(s) removed; all session steps unique.`,
        );
      } else {
        console.error(
          `   WARNING: ${remaining.length} duplicated session(s) remain — investigate.`,
        );
        blocking += remaining.length;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (blocking > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Unique-conflict repair crashed:", error);
  process.exitCode = 1;
});
