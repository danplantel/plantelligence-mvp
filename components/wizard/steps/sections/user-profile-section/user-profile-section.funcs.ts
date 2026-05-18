import { OrganizationType } from "@/types/wizard";

export interface UserProfileState {
  selectedType: OrganizationType | null;
  customOrganization: string;
}

export interface UserProfileActions {
  onTypeSelect: (type: OrganizationType) => void;
  onCustomChange: (value: string) => void;
}

export const organizationOptions = [
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
    description: "Organizations providing fiduciary, trustee or custodial services.",
  },
  {
    value: OrganizationType.OTHER,
    label: "Other",
    description: "Custom organization type not listed above.",
  },
];
