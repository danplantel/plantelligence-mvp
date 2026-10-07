import { organizationLabel } from "@/config/onboarding/organization-types";
import { teamSizeLabel } from "@/config/onboarding/team-sizes";

export interface SummaryUserProfileSectionProps {
  organizationType?: string;
  customOrganization?: string;
  teamSize?: string;
}

/**
 * Display label for a stored organization-type value. Labels live in config and
 * legacy ids resolve through `normalizeOrganizationType`, so this never renders a
 * raw id.
 */
export const getOrganizationTypeLabel = (type: string) => {
  return organizationLabel(type) || type;
};

/**
 * Display label for a stored team-size band. Legacy band ids (`just_me`,
 * `enterprise`) resolve through config so this never renders a raw id.
 */
export const getTeamSizeLabel = (size: string) => {
  return teamSizeLabel(size) || size;
};
