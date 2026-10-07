import { OrganizationType } from "@/types/wizard";

/**
 * Organization-type option list for onboarding Step 1.
 *
 * The stable `value` (an `OrganizationType` enum id) is what is STORED — never
 * the `label`/`description`, which are presentation only. Editing the wording
 * here therefore never requires a data migration.
 *
 * Editing rules:
 *  - Descriptions carry NO team-size language. Team size is captured separately
 *    (Step 1's Team Size section) and must not be implied by organization type.
 *  - "Financial Advisor / RIA" is a MERGED segment (the former Independent
 *    Advisor + RIA choices), stored under `financial_advisor_ria`.
 *
 * Legacy ids (`independent`, `ria`, `hybrid`, `broker`, `insurance`,
 * `recordkeeper`, `plan_sponsor`, `peo`, `trust_services`) are folded into the
 * current ids by `normalizeOrganizationType()`, so pre-existing rows keep
 * resolving with no read-time migration.
 */
export interface OrganizationTypeOption {
  value: OrganizationType;
  label: string;
  description: string;
}

export const organizationOptions: OrganizationTypeOption[] = [
  {
    value: OrganizationType.FINANCIAL_ADVISOR_RIA,
    label: "Financial Advisor / RIA",
    description:
      "Independent advisors, retirement plan advisors, wealth management firms, and RIAs.",
  },
  {
    value: OrganizationType.HYBRID_WEALTH_INSURANCE,
    label: "Hybrid Wealth & Insurance",
    description: "Firms offering both investment and insurance services.",
  },
  {
    value: OrganizationType.BROKER_DEALER_NETWORK,
    label: "Broker-Dealer / Advisor Network",
    description:
      "Broker-dealers, advisor networks, and multi-advisor organizations.",
  },
  {
    value: OrganizationType.INSURANCE_BENEFITS,
    label: "Insurance / Benefits Firm",
    description:
      "Insurance agencies, IMOs, and employee benefits brokers or consultants.",
  },
  {
    value: OrganizationType.RECORDKEEPER_TPA,
    label: "Recordkeeper / TPA",
    description: "Retirement plan recordkeeping, testing, and administration.",
  },
  {
    value: OrganizationType.EMPLOYER_PLAN_SPONSOR,
    label: "Employer / Plan Sponsor",
    description: "Employers offering retirement or insurance benefits directly.",
  },
  {
    value: OrganizationType.HR_OUTSOURCING_PEO,
    label: "HR Outsourcing / PEO",
    description: "HR outsourcing firms and PEOs serving many employers.",
  },
  {
    value: OrganizationType.OTHER,
    label: "Other",
    description: "Custom organization type not listed above.",
  },
];

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  organizationOptions.map((o) => [o.value, o.label]),
);

/**
 * Legacy id → current id. Used on READ (form load, summaries, validation) so a
 * row captured before the vocabulary change still resolves to a real option.
 * This is not a substitute for the at-rest migration
 * (`scripts/repair/migrate-org-type-and-team-size-ids.ts`).
 */
const LEGACY_ORGANIZATION_TYPE: Record<string, OrganizationType> = {
  independent: OrganizationType.FINANCIAL_ADVISOR_RIA,
  ria: OrganizationType.FINANCIAL_ADVISOR_RIA,
  hybrid: OrganizationType.HYBRID_WEALTH_INSURANCE,
  insurance: OrganizationType.INSURANCE_BENEFITS,
  broker: OrganizationType.BROKER_DEALER_NETWORK,
  recordkeeper: OrganizationType.RECORDKEEPER_TPA,
  peo: OrganizationType.HR_OUTSOURCING_PEO,
  plan_sponsor: OrganizationType.EMPLOYER_PLAN_SPONSOR,
  trust_services: OrganizationType.OTHER,
};

/**
 * Fold a stored organization-type value into the current id vocabulary. Current
 * ids pass through; legacy ids map to their replacement; anything unrecognised
 * passes through unchanged (so an unknown value is never silently dropped).
 */
export function normalizeOrganizationType(
  value: OrganizationType | string | null | undefined,
): OrganizationType | undefined {
  if (!value) return undefined;
  if (LABEL_BY_VALUE[value]) return value as OrganizationType;
  return LEGACY_ORGANIZATION_TYPE[value] ?? (value as OrganizationType);
}

/**
 * Display label for a stored organization-type value. Legacy values resolve
 * through the merge, so old data still shows the current label.
 */
export function organizationLabel(
  value: OrganizationType | string | null | undefined,
): string {
  if (!value) return "";
  const normalized = normalizeOrganizationType(value) ?? value;
  return LABEL_BY_VALUE[normalized] ?? String(value);
}
