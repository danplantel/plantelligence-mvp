/**
 * Repair — purge teammate verification fixtures, including ones stranded by an
 * interrupted run.
 *
 *   npx tsx scripts/repair/purge-verification-fixtures.ts [--apply]
 *
 * Why: `verify-t1` … `verify-t5` build isolated fixtures, assert against them, and
 * delete them unless `--keep` was passed. If a run is interrupted — Ctrl-C, a lost
 * connection, a crash — the fixtures survive, and because a fixture owner has no
 * Organization the next `verify-backfill` then fails with:
 *
 *   FAIL  every User has an organizationId — 1 missing
 *   FAIL  Organization count matches User count (one org per owner)
 *
 * The verify scripts now sweep before they run, and sweep again on SIGINT/SIGTERM, so
 * this command is the manual escape hatch: for a run killed with SIGKILL or a power
 * loss, or when you want to inspect what is stranded without running anything else.
 *
 * Safety: selection is the anchored `t<1-5>-verify-*@example.test` pattern in
 * [`sweepStaleFixtures`](../teammates/shared.ts) — no real account can match it, and a
 * mistyped argument cannot widen it. DRY RUN by default; `--apply` to delete.
 */
import { createPrisma, sweepStaleFixtures } from "../teammates/shared";

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    const dryRun = !APPLY;
    const result = await sweepStaleFixtures(prisma, { dryRun });

    console.log(`Verification fixtures — ${APPLY ? "APPLY" : "DRY RUN"}`);

    // Every count matters, not just users: `verify-t2` leaves an organization and a
    // plan whose owner id is fabricated, so a run can have zero stranded users and
    // still have rows to remove. Checking only `users` would report "nothing to
    // purge" while the orphaned org kept failing the backfill assertions.
    const total =
      result.users +
      result.organizations +
      result.profiles +
      result.assignments +
      result.companies +
      result.auditEvents +
      result.clients;

    if (total === 0) {
      console.log("\nNothing to purge.");
      return;
    }

    console.log(`  fixture users : ${result.users}`);
    console.log(`  organizations : ${result.organizations}`);
    console.log(`  profiles      : ${result.profiles}`);
    console.log(`  assignments   : ${result.assignments}`);
    console.log(`  companies     : ${result.companies}`);
    console.log(`  audit events  : ${result.auditEvents}`);
    console.log(`  plans/clients : ${result.clients}`);

    if (dryRun) {
      console.log("\nDry run only — re-run with --apply to delete.");
      return;
    }

    console.log("\nPurged. Re-run the verification battery.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
