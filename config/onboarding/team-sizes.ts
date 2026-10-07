import { TeamSize } from "@/types/wizard";

/**
 * Team-size bands for onboarding Step 1.
 *
 * The stable `value` (a `TeamSize` enum id) is STORED; `label`/`description` are
 * presentation only, so re-wording a band here needs no migration.
 *
 * Sizes are deliberately NOT filtered by organization type: the SAME four bands
 * are shown for every org type, so a solo hybrid advisor (or a solo
 * trust-services firm) can answer accurately. There is intentionally no
 * org-type → bands map — do not re-introduce conditional filtering here.
 */
export interface TeamSizeOption {
  value: TeamSize;
  label: string;
  description: string;
}

export const allTeamSizeOptions: TeamSizeOption[] = [
  {
    value: TeamSize.JUST_ME,
    label: "Just me",
    description: "Only you will use PlanTelligence.",
  },
  {
    value: TeamSize.TWO_FIVE,
    label: "2–5",
    description: "Small team.",
  },
  {
    value: TeamSize.SIX_TWENTY,
    label: "6–20",
    description: "Growing team.",
  },
  {
    value: TeamSize.ENTERPRISE,
    label: "21+",
    description: "Larger organization. We'll reach out to help with setup",
  },
];
