/**
 * Shared bootstrap for the teammate scripts.
 *
 * Prisma's CLI loads `.env` automatically; a plain `npx tsx` run does not, so
 * these scripts read the project `.env` themselves before constructing a client.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const ENV_PATH = path.join(PROJECT_ROOT, ".env");

/** Load `.env` into process.env without overwriting anything already set. */
export function loadEnv(): void {
  try {
    if (!fs.existsSync(ENV_PATH)) return;
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Best-effort: fall back to whatever the shell already exports.
  }
}

/** Set `key=value` on a connection string, unless it is already present. */
function withParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${value}`;
}

/**
 * The connection string the scripts use: `DATABASE_URL`, with the pool widened for a CLI.
 *
 * Two facts about this project drive the choice, both observed directly:
 *
 *  1. `DIRECT_URL` is NOT a usable alternative here. Pointing the scripts at the unpooled
 *     host was tried and reverted — it failed with
 *
 *       P1001: Can't reach database server
 *
 *     twice, once partway through a run and once on the very first query. `prisma migrate`
 *     accepts that endpoint, but ordinary queries through it do not, so the pooled endpoint
 *     is the only one that works for these scripts.
 *
 *  2. The pooled endpoint is shared with the dev server, and a script's burst of parallel
 *     queries can exhaust it. Prisma's default 10s `pool_timeout` is then exceeded and the
 *     run dies with
 *
 *       P2024: Timed out fetching a new connection from the connection pool
 *
 *     often *after* every assertion has already passed — so a green suite reports as red,
 *     which is worse than a slow one. A lower `connection_limit` makes the script queue
 *     instead of burst, and a longer `pool_timeout` lets it wait for a slot rather than
 *     give up.
 *
 * Stop the dev server for the cleanest signal; this is a mitigation, not a substitute.
 */
function scriptDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  return withParam(withParam(base, "connection_limit", "5"), "pool_timeout", "30");
}

/** Load env then create a client the caller is responsible for disconnecting. */
export function createPrisma(): PrismaClient {
  loadEnv();
  const url = scriptDatabaseUrl();
  return url
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient();
}

/* ─────────────────────── assertion helpers ─────────────────────── */

let failures = 0;

export function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

export function failureCount(): number {
  return failures;
}

export function summary(title: string): void {
  const total = failures;
  console.log("");
  if (total === 0) {
    console.log(`${title}: all assertions passed.`);
  } else {
    console.error(`${title}: ${total} assertion(s) failed.`);
  }
}

/* ─────────────────────── fixture hygiene ─────────────────────── */

/**
 * The email shape every verify fixture owner uses (`t1-verify-a-…@example.test`).
 *
 * Anchored at both ends, so it can only ever match a fixture: the `t<n>-verify-` prefix is
 * asserted on every fixture account and no real address carries it. Two things it must NOT
 * narrow, both learned the hard way:
 *
 *  - the ticket number is any `t`-stamped tag (`t1`, `t2a`, `t9`, …), not just `t1`–`t5`;
 *  - the mailbox domain is any reserved `.test` domain, not just `@example.test`. Fixtures
 *    also use `@abbenefits.test`, `@abc.test`, `@other.test`, `@elsewhere.test`.
 *
 * Narrowing either one left stranded rows that the sweep could not see, which is exactly
 * the failure the sweep exists to prevent.
 */
export const FIXTURE_OWNER_EMAIL = /^t[a-z0-9]{1,3}-verify-[\s\S]*@[a-z0-9.-]+\.test$/i;

/**
 * Fixture *names*, for the rows a script creates without a fixture OWNER.
 *
 * `verify-t2` deliberately builds an organization whose `ownerUserId` is a fabricated
 * id — it is asserting the "owner User is gone" case — plus a plan inside it. Neither
 * can be found by ownership, so their names are the only handle. This matches
 * `t2-verify-ghost-…`, `T2 Verify Org …` and every other script's naming.
 */
export const FIXTURE_NAME = /^t\d[ -]verify-/i;

export interface FixtureSweepResult {
  users: number;
  organizations: number;
  profiles: number;
  assignments: number;
  companies: number;
  auditEvents: number;
  clients: number;
}

/**
 * Remove fixtures left behind by an interrupted verification run.
 *
 * Why this exists: each verify script cleans up after itself, but a Ctrl-C, a dropped
 * connection or a crash skips that cleanup. A stranded fixture owner has no
 * `Organization`, so the NEXT run of `verify-backfill` fails on
 * "every User has an organizationId" — which reads like a code regression and is not
 * one. Sweeping before a run starts makes that self-healing.
 *
 * Safety:
 *  - Selection is the anchored {@link FIXTURE_OWNER_EMAIL} pattern only. The Prisma
 *    query is a coarse `endsWith` pre-filter because the typed API has no `$regex`,
 *    and the JS regex is what actually decides — so it can only ever NARROW the set.
 *  - `exceptStamps` spares the current run (and any run whose stamp is listed), so a
 *    verifier never deletes the fixtures it is about to assert against.
 *  - Two verifications must not be run concurrently; each sweep removes the other's
 *    rows, because a foreign stamp is indistinguishable from a stranded one.
 */
export async function sweepStaleFixtures(
  prisma: PrismaClient,
  options: { exceptStamps?: number[]; dryRun?: boolean } = {},
): Promise<FixtureSweepResult> {
  const exceptStamps = options.exceptStamps ?? [];
  const empty: FixtureSweepResult = {
    users: 0,
    organizations: 0,
    profiles: 0,
    assignments: 0,
    companies: 0,
    auditEvents: 0,
    clients: 0,
  };

  const candidates = await prisma.user.findMany({
    // `.test` is a reserved TLD that cannot resolve, so it is the coarse cut; the anchored
    // {@link FIXTURE_OWNER_EMAIL} regex below is what actually decides. A tighter
    // `@example.test` cut silently skipped fixtures on the other fixture domains, which is
    // how a stranded T9 login survived a sweep and broke the next `verify-backfill`.
    where: { email: { endsWith: ".test" } },
    select: { id: true, email: true },
  });

  const targets = candidates.filter((candidate) => {
    const email = candidate.email ?? "";
    if (!FIXTURE_OWNER_EMAIL.test(email)) return false;
    return !exceptStamps.some((stamp) => email.includes(`-${stamp}@`));
  });

  const userIds = targets.map((target) => target.id);

  // Organizations are found TWO ways, because T2 deliberately creates one whose
  // `ownerUserId` is a fabricated id (it asserts the "owner User is gone" case), so
  // ownership alone cannot see it. `contains` is a coarse pre-cut — the typed API has
  // no `$regex` — and the JS regex decides, so it can only ever narrow the set.
  const orgCandidates = await prisma.organization.findMany({
    where: {
      OR: [
        ...(userIds.length > 0 ? [{ ownerUserId: { in: userIds } }] : []),
        { name: { contains: "verify" } },
      ],
    },
    select: { id: true, name: true, ownerUserId: true },
  });
  const organizationIds = orgCandidates
    .filter(
      (row) => userIds.includes(row.ownerUserId) || FIXTURE_NAME.test(row.name ?? ""),
    )
    .map((row) => row.id);

  // Profiles are keyed by organization AND by the login they are linked to; both are
  // collected so a profile whose org was already removed is still caught.
  const profileCandidates = await prisma.teammateProfile.findMany({
    where: {
      OR: [
        ...(organizationIds.length > 0
          ? [{ organizationId: { in: organizationIds } }]
          : []),
        ...(userIds.length > 0 ? [{ loginUserId: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  // NOTE: no `["__none__"]` sentinels anywhere below. `id` / `profileId` are ObjectIds
  // and Prisma validates every value in an `in` list, so a placeholder string raises
  // P2023 "Malformed ObjectID". An empty `in: []` already matches nothing.
  const profileIds = profileCandidates.map((row) => row.id);

  // Same two-way rule for plans: the ghost plan is owned by a fabricated user AND sits
  // in the ghost organization, so neither the owner nor the org lookup would find it.
  const clientCandidates = await prisma.client.findMany({
    where: {
      OR: [
        ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
        ...(organizationIds.length > 0
          ? [{ organizationId: { in: organizationIds } }]
          : []),
        { companyName: { contains: "verify" } },
      ],
    },
    select: { id: true, companyName: true, userId: true, organizationId: true },
  });
  const clientIds = clientCandidates
    .filter(
      (row) =>
        userIds.includes(row.userId) ||
        organizationIds.includes(row.organizationId ?? "") ||
        FIXTURE_NAME.test(row.companyName ?? ""),
    )
    .map((row) => row.id);

  if (
    userIds.length === 0 &&
    organizationIds.length === 0 &&
    clientIds.length === 0
  ) {
    return empty;
  }

  const [auditEvents, assignments, companies] = await Promise.all([
    prisma.teammateAuditEvent.count({
      where: { organizationId: { in: organizationIds } },
    }),
    prisma.planAssignment.count({ where: { profileId: { in: profileIds } } }),
    prisma.teammateCompany.count({ where: { organizationId: { in: organizationIds } } }),
  ]);

  const counts: FixtureSweepResult = {
    users: userIds.length,
    organizations: organizationIds.length,
    profiles: profileIds.length,
    assignments,
    companies,
    auditEvents,
    clients: clientIds.length,
  };

  // A dry run reports the same breakdown it would have deleted.
  if (options.dryRun) return counts;

  // Children first, matching the order the verify scripts themselves use: an
  // assignment points at a profile, a profile at a login, a plan at a user.
  await prisma.teammateAuditEvent.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.planAssignment.deleteMany({
    where: {
      OR: [
        { profileId: { in: profileIds } },
        { organizationId: { in: organizationIds } },
      ],
    },
  });
  await prisma.teammateProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.teammateCompany.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });

  return counts;
}

let guardsInstalled = false;

/**
 * Make Ctrl-C / SIGTERM leave the database clean.
 *
 * The scripts' own `finally` blocks handle a thrown error, but a signal kills the
 * process without running them. This sweeps the (pattern-matched) fixtures and exits,
 * so an interrupted battery is not a dirty database. Installed once per process.
 */
export function installFixtureGuards(
  prisma: PrismaClient,
  options: { exceptStamps?: number[] } = {},
): void {
  if (guardsInstalled) return;
  guardsInstalled = true;

  let handling = false;
  const handle = async (signal: string) => {
    // A second Ctrl-C while the sweep is in flight must not start a second sweep.
    if (handling) return;
    handling = true;
    console.log("");
    console.log(`[fixtures] ${signal} received — removing fixtures before exit…`);
    try {
      const swept = await sweepStaleFixtures(prisma, options);
      console.log(`[fixtures] removed ${swept.users} fixture user(s).`);
    } catch (error) {
      console.error(
        "[fixtures] sweep failed — run `npm run repair:purge-verification-fixtures -- --apply`",
        error,
      );
    } finally {
      await prisma.$disconnect().catch(() => undefined);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => void handle("SIGINT"));
  process.once("SIGTERM", () => void handle("SIGTERM"));
}
