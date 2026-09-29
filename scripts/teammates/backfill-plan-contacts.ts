/**
 * T7 backfill — project every plan's `keyContacts` onto the teammate layer.
 *
 *   npx tsx scripts/teammates/backfill-plan-contacts.ts [--dry-run]
 *
 * Why this must run BEFORE the hub switches to profile + assignment: existing plans
 * have `keyContacts` rows but no mirrored profiles or assignments, so every hub would
 * render with no contacts until each plan happened to be saved again. This walks every
 * plan once and does that projection.
 *
 * Idempotent, like `teammates:backfill`: safe to re-run, and the remedy for any plan
 * whose contacts were written by a path that did not mirror them.
 *
 * Applies by default (matching `teammates:backfill`), because the operation is additive.
 * The one destructive edge is removing an assignment that is purely a mirror of a
 * contact that no longer exists — which is exactly the drift this repairs.
 * Pass `--dry-run` to count without writing.
 */
import { createPrisma } from "./shared";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import {
  mirrorPlanContacts,
  readPlanContacts,
} from "../../lib/teammates/contact-mirror.server";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    const clients = await prisma.client.findMany({
      select: { id: true, userId: true, organizationId: true, keyContacts: true },
    });

    console.log(DRY_RUN ? "T7 contact backfill — DRY RUN" : "T7 contact backfill");
    console.log(`  plans: ${clients.length}`);

    let withContacts = 0;
    let withoutOrg = 0;
    const totals = {
      profilesCreated: 0,
      profilesUpdated: 0,
      assignmentsCreated: 0,
      assignmentsUpdated: 0,
      assignmentsRemoved: 0,
      skipped: 0,
      skippedOwner: 0,
      ownerProfilesRemoved: 0,
    };

    for (const client of clients) {
      const contacts = readPlanContacts(client.keyContacts);
      if (contacts.length === 0) continue;
      withContacts += 1;

      if (DRY_RUN) {
        // The projection itself is cheap, but a dry run must not write: count the
        // contacts that WOULD be mirrored instead of calling the mirror.
        continue;
      }

      // A plan predating the org stamp is caught up here rather than skipped, which is
      // what would otherwise leave the oldest plans with empty hubs.
      let organizationId = client.organizationId;
      if (!organizationId) {
        organizationId = await getOrCreateOrganizationForUser(client.userId);
        withoutOrg += 1;
      }

      const result = await mirrorPlanContacts({
        organizationId,
        actorUserId: client.userId,
        clientId: client.id,
        keyContacts: client.keyContacts,
      });

      totals.profilesCreated += result.profilesCreated;
      totals.profilesUpdated += result.profilesUpdated;
      totals.assignmentsCreated += result.assignmentsCreated;
      totals.assignmentsUpdated += result.assignmentsUpdated;
      totals.assignmentsRemoved += result.assignmentsRemoved;
      totals.skipped += result.skipped;
      totals.skippedOwner += result.skippedOwner;
      totals.ownerProfilesRemoved += result.ownerProfilesRemoved;
    }

    console.log(`  plans with contacts: ${withContacts}`);
    if (withoutOrg > 0) {
      console.log(`  plans stamped with an organization during this run: ${withoutOrg}`);
    }

    if (DRY_RUN) {
      console.log("");
      console.log("Dry run — nothing written. Re-run without --dry-run to apply.");
      return;
    }

    console.log("");
    console.log("Backfill summary");
    console.log(`  profiles created     : ${totals.profilesCreated}`);
    console.log(`  profiles updated     : ${totals.profilesUpdated}`);
    console.log(`  assignments created  : ${totals.assignmentsCreated}`);
    console.log(`  assignments updated  : ${totals.assignmentsUpdated}`);
    console.log(`  assignments removed  : ${totals.assignmentsRemoved}`);
    console.log(`  contacts skipped     : ${totals.skipped} (no usable email)`);
    console.log(
      `  owner contacts skipped: ${totals.skippedOwner} (the owner is not a teammate)`,
    );
    if (totals.ownerProfilesRemoved > 0) {
      console.log(
        `  owner profiles removed: ${totals.ownerProfilesRemoved} (duplicates of a synthesized owner row)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Contact backfill failed:", error);
  process.exitCode = 1;
});
