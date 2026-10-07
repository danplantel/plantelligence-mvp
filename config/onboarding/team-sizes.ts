import { TeamSize } from "@/types/wizard";

/**
 * Team-size band option list for onboarding Step 1.
 *
 * `value` (a `TeamSize` enum id) is the STORED onboarding ESTIMATE. It is a
 * recommendation only — NEVER an entitlement, a limit, or a seat count. The
 * organization's real seat limit is `Organization.seatsIncluded` (null until a
 * billing surface exists) and its live count is derived from accepted invites;
 * neither is written by this step.
 *
 * `suggestedTier` is the config-driven "starting tier" a band suggests. It is a
 * HINT for a future pricing surface and is not persisted or enforced today.
 *
 * Legacy ids (`just_me`, `enterprise`) are folded by `normalizeTeamSize()`.
 */
export interface TeamSizeOption {
  value: TeamSize;
  label: string;
  description: string;
  /** Advisory only: the tier this band suggests. Never an entitlement or limit. */
  suggestedTier: string;
}

export const allTeamSizeOptions: TeamSizeOption[] = [
  {
    value: TeamSize.SOLO,
    label: "Just me",
    description: "You're the only person in your organization.",
    suggestedTier: "solo",
  },
  {
    value: TeamSize.TWO_FIVE,
    label: "2–5",
    description: "A team of 2 to 5 people.",
    suggestedTier: "small_team",
  },
  {
    value: TeamSize.SIX_TWENTY,
    label: "6–20",
    description: "A team of 6 to 20 people.",
    suggestedTier: "growing_team",
  },
  {
    value: TeamSize.TWENTY_ONE_PLUS,
    label: "21+",
    description: "Larger organization. We'll reach out to help with setup",
    suggestedTier: "enterprise",
  },
];

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  allTeamSizeOptions.map((o) => [o.value, o.label]),
);

/** Legacy band id → current id. Used on READ only. */
const LEGACY_TEAM_SIZE: Record<string, TeamSize> = {
  just_me: TeamSize.SOLO,
  enterprise: TeamSize.TWENTY_ONE_PLUS,
};

/**
 * Fold a stored band value into the current id vocabulary. Current ids pass
 * through; legacy ids map to their replacement; unknown values pass through.
 */
export function normalizeTeamSize(
  value: TeamSize | string | null | undefined,
): TeamSize | undefined {
  if (!value) return undefined;
  if (LABEL_BY_VALUE[value]) return value as TeamSize;
  return LEGACY_TEAM_SIZE[value] ?? (value as TeamSize);
}

/** Display label for a stored band value (legacy ids resolve to the new label). */
export function teamSizeLabel(
  value: TeamSize | string | null | undefined,
): string {
  if (!value) return "";
  const normalized = normalizeTeamSize(value) ?? value;
  return LABEL_BY_VALUE[normalized] ?? String(value);
}

/**
 * The tier a band SUGGESTS — a recommendation for a future pricing surface, not
 * an entitlement or a limit. Unknown / legacy bands return undefined.
 */
export function suggestedTierForBand(
  value: TeamSize | string | null | undefined,
): string | undefined {
  const normalized = normalizeTeamSize(value);
  return allTeamSizeOptions.find((o) => o.value === normalized)?.suggestedTier;
}
