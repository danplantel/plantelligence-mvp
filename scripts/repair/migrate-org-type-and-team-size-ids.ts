/**
 * Repair — migrate stored org-type and team-size-band values to the current ids.
 *
 *   npx tsx scripts/repair/migrate-org-type-and-team-size-ids.ts          # dry run
 *   npx tsx scripts/repair/migrate-org-type-and-team-size-ids.ts --apply  # write
 *
 * The onboarding vocabularies were renamed (see types/wizard.ts):
 *
 *   organizationType
 *     independent    -> financial_advisor_ria
 *     ria            -> financial_advisor_ria   (merged)
 *     hybrid         -> hybrid_wealth_insurance
 *     insurance      -> insurance_benefits
 *     broker         -> broker_dealer_network
 *     recordkeeper   -> recordkeeper_tpa
 *     peo            -> hr_outsourcing_peo
 *     plan_sponsor   -> employer_plan_sponsor
 *     trust_services -> other
 *
 *   teamSize (team_size_band)
 *     just_me  -> solo
 *     enterprise -> 21_plus
 *     (2_5, 6_20 unchanged)
 *
 * Columns touched:
 *   - `WizardClientProfile.organizationType`
 *   - `User.organizationType`, `User.teamSize`
 *   - `Organization.organizationType`, `Organization.teamSize`
 *   - `WizardTeamSize.teamSize`
 *
 * Idempotent: after the rewrite no row holds a legacy value, so a re-run is a
 * no-op. Defaults to a DRY RUN; pass `--apply` to write.
 *
 * The application also folds legacy ids on READ (normalizeOrganizationType /
 * normalizeTeamSize), so nothing breaks if this is not run — the script exists to
 * rewrite the values at rest.
 */
import { createPrisma } from "../teammates/shared";

const ORG_MAP: Record<string, string> = {
  independent: "financial_advisor_ria",
  ria: "financial_advisor_ria",
  hybrid: "hybrid_wealth_insurance",
  insurance: "insurance_benefits",
  broker: "broker_dealer_network",
  recordkeeper: "recordkeeper_tpa",
  peo: "hr_outsourcing_peo",
  plan_sponsor: "employer_plan_sponsor",
  trust_services: "other",
};

const TEAM_MAP: Record<string, string> = {
  just_me: "solo",
  enterprise: "21_plus",
};

/** Trust Services is retired: it becomes "Other" and keeps its meaning as text. */
const TRUST_SERVICES = "trust_services";
const TRUST_SERVICES_DESCRIPTION = "Trust Services";

function isBlank(value: string | null | undefined): boolean {
  return !(value || "").trim();
}

const ORG_KEYS = Object.keys(ORG_MAP);
const TEAM_KEYS = Object.keys(TEAM_MAP);

interface FieldMigration<TRow extends { id: string }> {
  label: string;
  rows: TRow[];
  read: (row: TRow) => string | null;
  mapping: Record<string, string>;
  update: (ids: string[], value: string) => Promise<number>;
}

async function migrateField<TRow extends { id: string }>(
  { label, rows, read, mapping, update }: FieldMigration<TRow>,
  dryRun: boolean,
): Promise<number> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const current = read(row);
    if (!current) continue;
    const next = mapping[current];
    if (!next) continue;
    const list = groups.get(next) ?? [];
    list.push(row.id);
    groups.set(next, list);
  }

  if (groups.size === 0) {
    console.log(`${label}: 0 row(s) to change`);
    return 0;
  }

  let total = 0;
  for (const [next, ids] of groups) {
    total += ids.length;
    if (dryRun) {
      console.log(`${label}: ${ids.length} row(s) -> "${next}"`);
    } else {
      const count = await update(ids, next);
      console.log(`${label}: ${count} row(s) -> "${next}"`);
    }
  }
  return total;
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes("--apply");
  const prisma = createPrisma();

  try {
    const wizardProfiles = await prisma.wizardClientProfile.findMany({
      where: { organizationType: { in: ORG_KEYS } },
      select: { id: true, organizationType: true },
    });
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { organizationType: { in: ORG_KEYS } },
          { teamSize: { in: TEAM_KEYS } },
        ],
      },
      select: { id: true, organizationType: true, teamSize: true },
    });
    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { organizationType: { in: ORG_KEYS } },
          { teamSize: { in: TEAM_KEYS } },
        ],
      },
      select: { id: true, organizationType: true, teamSize: true },
    });
    const wizardTeamSizes = await prisma.wizardTeamSize.findMany({
      where: { teamSize: { in: TEAM_KEYS } },
      select: { id: true, teamSize: true },
    });

    // Trust Services rows are captured BEFORE the type rewrite, so the blank
    // descriptions can still be identified after they become "other".
    const trustWizardProfiles = await prisma.wizardClientProfile.findMany({
      where: { organizationType: TRUST_SERVICES },
      select: { id: true, customOrganization: true },
    });
    const trustUsers = await prisma.user.findMany({
      where: { organizationType: TRUST_SERVICES },
      select: { id: true, customOrganization: true },
    });
    const trustOrganizations = await prisma.organization.findMany({
      where: { organizationType: TRUST_SERVICES },
      select: { id: true, customOrganization: true },
    });

    console.log(dryRun ? "DRY RUN — no writes.\n" : "Applying…\n");

    let total = 0;

    total += await migrateField(
      {
        label: "WizardClientProfile.organizationType",
        rows: wizardProfiles,
        read: (r) => r.organizationType,
        mapping: ORG_MAP,
        update: async (ids, value) => {
          const res = await prisma.wizardClientProfile.updateMany({
            where: { id: { in: ids } },
            data: { organizationType: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    total += await migrateField(
      {
        label: "User.organizationType",
        rows: users,
        read: (r) => r.organizationType,
        mapping: ORG_MAP,
        update: async (ids, value) => {
          const res = await prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { organizationType: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    total += await migrateField(
      {
        label: "User.teamSize",
        rows: users,
        read: (r) => r.teamSize,
        mapping: TEAM_MAP,
        update: async (ids, value) => {
          const res = await prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { teamSize: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    total += await migrateField(
      {
        label: "Organization.organizationType",
        rows: organizations,
        read: (r) => r.organizationType,
        mapping: ORG_MAP,
        update: async (ids, value) => {
          const res = await prisma.organization.updateMany({
            where: { id: { in: ids } },
            data: { organizationType: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    total += await migrateField(
      {
        label: "Organization.teamSize",
        rows: organizations,
        read: (r) => r.teamSize,
        mapping: TEAM_MAP,
        update: async (ids, value) => {
          const res = await prisma.organization.updateMany({
            where: { id: { in: ids } },
            data: { teamSize: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    total += await migrateField(
      {
        label: "WizardTeamSize.teamSize",
        rows: wizardTeamSizes,
        read: (r) => r.teamSize,
        mapping: TEAM_MAP,
        update: async (ids, value) => {
          const res = await prisma.wizardTeamSize.updateMany({
            where: { id: { in: ids } },
            data: { teamSize: value },
          });
          return res.count;
        },
      },
      dryRun,
    );

    // Retired "Trust Services": fill the now-required description when blank.
    const trustGroups = [
      {
        label: "WizardClientProfile",
        rows: trustWizardProfiles,
        update: (ids: string[]) =>
          prisma.wizardClientProfile.updateMany({
            where: { id: { in: ids } },
            data: { customOrganization: TRUST_SERVICES_DESCRIPTION },
          }),
      },
      {
        label: "User",
        rows: trustUsers,
        update: (ids: string[]) =>
          prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { customOrganization: TRUST_SERVICES_DESCRIPTION },
          }),
      },
      {
        label: "Organization",
        rows: trustOrganizations,
        update: (ids: string[]) =>
          prisma.organization.updateMany({
            where: { id: { in: ids } },
            data: { customOrganization: TRUST_SERVICES_DESCRIPTION },
          }),
      },
    ];

    for (const group of trustGroups) {
      const blankIds = group.rows
        .filter((r) => isBlank(r.customOrganization))
        .map((r) => r.id);
      if (blankIds.length === 0) continue;
      if (dryRun) {
        console.log(
          `${group.label}.customOrganization: ${blankIds.length} row(s) -> "${TRUST_SERVICES_DESCRIPTION}"`,
        );
      } else {
        const res = await group.update(blankIds);
        console.log(
          `${group.label}.customOrganization: ${res.count} row(s) -> "${TRUST_SERVICES_DESCRIPTION}"`,
        );
      }
      total += blankIds.length;
    }

    console.log(
      dryRun
        ? `\nDRY RUN complete — ${total} row(s) would be updated. Re-run with --apply to write.`
        : `\nApplied — ${total} row(s) updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
