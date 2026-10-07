import { TeamSize } from "@/types/wizard";

export interface TeamSizeState {
  selectedSize: TeamSize | null;
}

export interface TeamSizeActions {
  onSizeSelect: (size: TeamSize) => void;
}

// Size bands (ids + labels) and the per-organization allowance live in config,
// so bands can change without editing this component or migrating stored data.
export {
  organizationTeamSizeMap,
  allTeamSizeOptions,
  getTeamSizeOptions,
} from "@/config/onboarding/team-sizes";
