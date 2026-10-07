import { OrganizationType } from "@/types/wizard";

export interface UserProfileState {
  selectedType: OrganizationType | null;
  customOrganization: string;
}

export interface UserProfileActions {
  onTypeSelect: (type: OrganizationType) => void;
  onCustomChange: (value: string) => void;
}

// The option list (and its labels) lives in config so it can change without
// editing this component or migrating stored data — answers store the id.
export { organizationOptions } from "@/config/onboarding/organization-types";
