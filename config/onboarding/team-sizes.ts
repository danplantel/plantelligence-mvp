import { TeamSize, OrganizationType } from "@/types/wizard";

/**
 * Team-size bands for onboarding Step 1.
 *
 * The stable `value` (a `TeamSize` enum id) is STORED; `label`/`description` are
 * presentation only, so re-wording a band here needs no migration.
 */
export interface TeamSizeOption {
  value: TeamSize;
  label: string;
  description: string;
}

/**
 * Which bands each organization type may choose. Sizes are ids, not labels, so
 * this map is safe to edit without touching stored data.
 */
export const organizationTeamSizeMap: Record<OrganizationType, TeamSize[]> = {
  [OrganizationType.INDEPENDENT]: [TeamSize.JUST_ME, TeamSize.TWO_FIVE],
  [OrganizationType.RIA]: [
    TeamSize.JUST_ME,
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
  [OrganizationType.HYBRID]: [
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
  [OrganizationType.BROKER]: [
    TeamSize.JUST_ME,
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
  [OrganizationType.INSURANCE]: [
    TeamSize.JUST_ME,
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
  [OrganizationType.RECORDKEEPER]: [TeamSize.ENTERPRISE],
  [OrganizationType.PLAN_SPONSOR]: [TeamSize.JUST_ME, TeamSize.TWO_FIVE],
  [OrganizationType.TRUST_SERVICES]: [
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
  [OrganizationType.OTHER]: [
    TeamSize.JUST_ME,
    TeamSize.TWO_FIVE,
    TeamSize.SIX_TWENTY,
    TeamSize.ENTERPRISE,
  ],
};

export const allTeamSizeOptions: TeamSizeOption[] = [
  {
    value: TeamSize.JUST_ME,
    label: "Just me",
    description: "Individual onboarding, single-user role set",
  },
  {
    value: TeamSize.TWO_FIVE,
    label: "2–5",
    description: "Small firm setup, simple permissions",
  },
  {
    value: TeamSize.SIX_TWENTY,
    label: "6–20",
    description: "Mid-tier firms with advisor groups",
  },
  {
    value: TeamSize.ENTERPRISE,
    label: "21+",
    description:
      "Enterprise-level controls, advanced permissions, SSO/SCIM, multi-portal support",
  },
];

export const getTeamSizeOptions = (
  organizationType: OrganizationType | null,
) => {
  if (!organizationType) return [];

  const allowedSizes = organizationTeamSizeMap[organizationType] || [];
  return allTeamSizeOptions.filter((option) =>
    allowedSizes.includes(option.value),
  );
};
