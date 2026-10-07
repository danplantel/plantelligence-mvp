import { organizationLabel } from "@/config/onboarding/organization-types";

export interface SummaryUserProfileSectionProps {
  organizationType?: string;
  customOrganization?: string;
  teamSize?: string;
}

/**
 * Display label for a stored organization-type value. Labels live in config and
 * legacy ids (e.g. "ria") resolve through the merge, so this never renders a raw
 * id.
 */
export const getOrganizationTypeLabel = (type: string) => {
  return organizationLabel(type) || type;
};

export const getTeamSizeLabel = (size: string) => {
  const sizes = {
    just_me: "Just me",
    "2_5": "2–5",
    "6_20": "6–20",
    enterprise: "21+",
  };
  return sizes[size as keyof typeof sizes] || size;
};
