import { OrganizationType } from "@/types/wizard";

/**
 * Organization-type option list for onboarding Step 1.
 *
 * The stable `value` (an `OrganizationType` enum id) is what gets STORED — never
 * the `label`/`description`, which are presentation only. Editing the wording
 * here therefore never requires a data migration.
 *
 * Two things to keep in mind when editing this list:
 *  - Descriptions carry NO team-size language. Team size is captured separately
 *    (Step 1's Team Size section) and must not be implied by organization type.
 *  - "Independent Advisor" and "RIA or Boutique Firm" were MERGED into a single
 *    "Financial Advisor / RIA" choice, stored under the `INDEPENDENT` id. Legacy
 *    `RIA` answers are folded into it by `normalizeOrganizationType()`.
 *  - "Trust Services" was RETIRED — such organizations are covered by "Other".
 *    Legacy `TRUST_SERVICES` answers are folded into `OTHER` by
 *    `normalizeOrganizationType()`.
 */
export interface OrganizationTypeOption {
  value: OrganizationType;
  label: string;
  description: string;
}

export const organizationOptions: OrganizationTypeOption[] = [
  {
    value: OrganizationType.INDEPENDENT,
    label: "Financial Advisor / RIA",
    description:
      "Independent advisors, retirement plan advisors, wealth management firms, and RIAs.",
  },
  {
    value: OrganizationType.HYBRID,
    label: "Hybrid Wealth & Insurance",
    description: "Firms offering both investment and insurance services.",
  },
  {
    value: OrganizationType.BROKER,
    label: "Broker-Dealer / Advisor Network",
    description:
      "Broker-dealers, advisor networks, and multi-advisor organizations.",
  },
  {
    value: OrganizationType.INSURANCE,
    label: "Insurance / Benefits Firm",
    description:
      "Insurance agencies, IMOs, and employee benefits brokers or consultants.",
  },
  {
    value: OrganizationType.RECORDKEEPER,
    label: "Recordkeeper / TPA",
    description: "Retirement plan recordkeeping, testing, and administration.",
  },
  {
    value: OrganizationType.PLAN_SPONSOR,
    label: "Employer / Plan Sponsor",
    description: "Companies managing benefits for their own employees.",
  },
  {
    value: OrganizationType.PEO,
    label: "HR Outsourcing / PEO",
    description: "Firms managing HR and benefits for multiple employers.",
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
 * Fold legacy organization types into the current option set. The only merge so
 * far is `RIA` → `INDEPENDENT` ("Independent Advisor" + "RIA or Boutique Firm" →
 * "Financial Advisor / RIA"). Current ids pass through unchanged.
 */
export function normalizeOrganizationType(
  value: OrganizationType | string | null | undefined,
): OrganizationType | undefined {
  if (!value) return undefined;
  if (value === OrganizationType.RIA) return OrganizationType.INDEPENDENT;
  // Retired: "Trust Services" is covered by "Other".
  if (value === OrganizationType.TRUST_SERVICES) return OrganizationType.OTHER;
  return value as OrganizationType;
}

/**
 * Display label for a stored organization-type value. Legacy values (e.g. "ria")
 * resolve through the merge, so old data still shows the merged label.
 */
export function organizationLabel(
  value: OrganizationType | string | null | undefined,
): string {
  if (!value) return "";
  const normalized = normalizeOrganizationType(value) ?? value;
  return LABEL_BY_VALUE[normalized] ?? String(value);
}
