/**
 * Repair — retire the "Trust Services" organization type.
 *
 *   npx tsx scripts/repair/migrate-trust-services-to-other.ts          # dry run
 *   npx tsx scripts/repair/migrate-trust-services-to-other.ts --apply  # write
 *
 * "Trust Services" was removed from the onboarding organization-type list —
 * "Other" covers it (see config/onboarding/organization-types.ts). This rewrites
 * every stored `trust_services` value to `other` across the three places the
 * value lives:
 *
 *   - `WizardClientProfile.organizationType` (onboarding draft)
 *   - `User.organizationType`               (the reader's canonical row)
 *   - `Organization.organizationType`       (the org-level setting)
 *
 * Because "Other" requires a "Describe Your Organization" description, any row
 * whose `customOrganization` is blank is ALSO given "Trust Services", so the
 * retired value's meaning is preserved and the account is not blocked by the
 * now-required description on its next save.
 *
 * Idempotent: after the rewrite no row matches `organizationType = "trust_services"`,
 * so a re-run is a no-op. Defaults to a DRY RUN; pass `--apply` to write.
 *
 * The application does not depend on this script: a legacy `trust_services` value
 * is folded to `other` in-memory on load (see `normalizeOrganizationType`). This is
 * the one-time data migration for accounts that should be rewritten at rest.
 */
import { createPrisma } from "../teammates/shared";

const RETIRED = "trust_services";
const REPLACEMENT = "other";
/** Preserved meaning for a retired row that had no description of its own. */
const LEGACY_DESCRIPTION = "Trust Services";

interface LegacyRow {
  id: string;
  customOrganization: string | null;
}

function isBlank(value: string | null | undefined): boolean {
  return !(value || "").trim();
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes("--apply");
  const prisma = createPrisma();

  try {
    // Read BEFORE any write, so the blank-description rows are still
    // distinguishable from genuine "other" rows that were already correct.
    const wizardDrafts: LegacyRow[] = await prisma.wizardClientProfile.findMany({
      where: { organizationType: RETIRED },
      select: { id: true, customOrganization: true },
    });
    const users: LegacyRow[] = await prisma.user.findMany({
      where: { organizationType: RETIRED },
      select: { id: true, customOrganization: true },
    });
    const orgs: LegacyRow[] = await prisma.organization.findMany({
      where: { organizationType: RETIRED },
      select: { id: true, customOrganization: true },
    });

    const groups = [
      { label: "WizardClientProfile", rows: wizardDrafts },
      { label: "User", rows: users },
      { label: "Organization", rows: orgs },
    ];

    const total = groups.reduce((sum, g) => sum + g.rows.length, 0);

    for (const { label, rows } of groups) {
      const blanks = rows.filter((r) => isBlank(r.customOrganization)).length;
      console.log(
        `${label}: ${rows.length} row(s) to rewrite to "${REPLACEMENT}" (${blanks} missing a description)`,
      );
    }

    if (dryRun) {
      console.log(`\nDRY RUN — no writes. ${total} row(s) would be updated.`);
      console.log("Re-run with --apply to write.");
      return;
    }

    let migrated = 0;
    let descriptionsFilled = 0;

    // WizardClientProfile
    if (wizardDrafts.length > 0) {
      const ids = wizardDrafts.map((r) => r.id);
      const blankIds = wizardDrafts
        .filter((r) => isBlank(r.customOrganization))
        .map((r) => r.id);
      const typeResult = await prisma.wizardClientProfile.updateMany({
        where: { id: { in: ids } },
        data: { organizationType: REPLACEMENT },
      });
      migrated += typeResult.count;
      if (blankIds.length > 0) {
        const descResult = await prisma.wizardClientProfile.updateMany({
          where: { id: { in: blankIds } },
          data: { customOrganization: LEGACY_DESCRIPTION },
        });
        descriptionsFilled += descResult.count;
      }
    }

    // User
    if (users.length > 0) {
      const ids = users.map((r) => r.id);
      const blankIds = users
        .filter((r) => isBlank(r.customOrganization))
        .map((r) => r.id);
      const typeResult = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { organizationType: REPLACEMENT },
      });
      migrated += typeResult.count;
      if (blankIds.length > 0) {
        const descResult = await prisma.user.updateMany({
          where: { id: { in: blankIds } },
          data: { customOrganization: LEGACY_DESCRIPTION },
        });
        descriptionsFilled += descResult.count;
      }
    }

    // Organization
    if (orgs.length > 0) {
      const ids = orgs.map((r) => r.id);
      const blankIds = orgs
        .filter((r) => isBlank(r.customOrganization))
        .map((r) => r.id);
      const typeResult = await prisma.organization.updateMany({
        where: { id: { in: ids } },
        data: { organizationType: REPLACEMENT },
      });
      migrated += typeResult.count;
      if (blankIds.length > 0) {
        const descResult = await prisma.organization.updateMany({
          where: { id: { in: blankIds } },
          data: { customOrganization: LEGACY_DESCRIPTION },
        });
        descriptionsFilled += descResult.count;
      }
    }

    console.log(
      `\nApplied — ${migrated} row(s) moved to "${REPLACEMENT}"; ` +
        `${descriptionsFilled} description(s) filled with "${LEGACY_DESCRIPTION}".`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
