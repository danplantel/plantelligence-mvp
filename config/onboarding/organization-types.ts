import { OrganizationType } from "@/types/wizard";

/**
 * Organization-type option list for onboarding Step 1.
 *
 * The stable `value` (an `OrganizationType` enum id) is what gets STORED — never
 * the `label`/`description`, which are presentation only. Editing the wording
 * here therefore never requires a data migration.
 */
export interface OrganizationTypeOption {
  value: OrganizationType;
  label: string;
  description: string;
}

export const organizationOptions: OrganizationTypeOption[] = [
  {
    value: OrganizationType.INDEPENDENT,
    label: "Independent Advisor",
    description: "Solo or small firm, up to 5 users.",
  },
  {
    value: OrganizationType.RIA,
    label: "RIA or Boutique Firm",
    description: "Advisory-focused firm.",
  },
  {
    value: OrganizationType.HYBRID,
    label: "Hybrid Wealth & Insurance Firm",
    description: "Provides both investment and insurance services.",
  },
  {
    value: OrganizationType.BROKER,
    label: "Broker-Dealer",
    description: "Multi-advisor platform under a broker-dealer structure.",
  },
  {
    value: OrganizationType.INSURANCE,
    label: "Insurance",
    description: "Insurance agencies, professionals, or IMOs.",
  },
  {
    value: OrganizationType.RECORDKEEPER,
    label: "Recordkeeper / TPA",
    description: "Handles plan recordkeeping, testing, and administration.",
  },
  {
    value: OrganizationType.PLAN_SPONSOR,
    label: "Plan Sponsor",
    description: "Employer offering retirement or insurance benefits.",
  },
  {
    value: OrganizationType.TRUST_SERVICES,
    label: "Trust Services",
    description:
      "Organizations providing fiduciary, trustee or custodial services.",
  },
  {
    value: OrganizationType.OTHER,
    label: "Other",
    description: "Custom organization type not listed above.",
  },
];
