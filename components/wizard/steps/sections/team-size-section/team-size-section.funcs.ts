import { TeamSize } from "@/types/wizard";

export interface TeamSizeState {
  selectedSize: TeamSize | null;
}

export interface TeamSizeActions {
  onSizeSelect: (size: TeamSize) => void;
}

// Every org type shows the SAME four bands — there is no conditional filtering.
// The list lives in config so labels/descriptions can change without a migration.
export { allTeamSizeOptions } from "@/config/onboarding/team-sizes";
