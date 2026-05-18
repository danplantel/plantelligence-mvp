/**
 * Flyer generator modes (3b.3). Stored as strings on MarketingFlyer.mode
 */

export const FLYER_MODES = [
  "hub_promo_general",
  "hub_promo_category",
  "action_beneficiaries",
  "action_rollovers",
  "action_open_enrollment_kickoff",
  "action_open_enrollment_deadline",
  "meetings_invite",
  "meetings_reminder",
  "support_need_help",
] as const;

export type FlyerMode = (typeof FLYER_MODES)[number];

export function isFlyerMode(value: string): value is FlyerMode {
  return (FLYER_MODES as readonly string[]).includes(value);
}

/** Human-readable labels for prompts / logging */
export const FLYER_MODE_LABELS: Record<FlyerMode, string> = {
  hub_promo_general: "Hub promo — general",
  hub_promo_category: "Hub promo — category-specific",
  action_beneficiaries: "Action — beneficiaries",
  action_rollovers: "Action — rollovers",
  action_open_enrollment_kickoff: "Action — open enrollment kickoff",
  action_open_enrollment_deadline: "Action — open enrollment deadline",
  meetings_invite: "Meetings — invite",
  meetings_reminder: "Meetings — reminder",
  support_need_help: "Need help / Contact us",
};
