import type { TopicLocation } from "@/types/topic";

/**
 * Life Event templates (TF-8, handoff §7a + §16.5).
 *
 * A Life Event is NOT new content: it is an ordered checklist of topic placements the
 * plan already has, pulled from any location. That is why every step names a
 * `location` + `topicSlug` pair rather than carrying copy — the label is the topic's
 * own title unless the advisor overrides it.
 *
 * Keys match §16.5's eight defaults, and the same eight the hub-home strip already
 * shows ("Something Changed? Start Here."). Deadlines are the handoff's defaults; a
 * step whose topic is not placed on the plan simply does not appear, and a step whose
 * location is switched off drops out (see `resolve.ts`).
 */

export type LifeEventKey =
  | "having_a_baby"
  | "getting_married"
  | "moving"
  | "leaving_the_company"
  | "approaching_retirement"
  | "losing_a_loved_one"
  | "divorce"
  | "going_on_leave";

export interface LifeEventStepSeed {
  location: TopicLocation;
  /** The library slug (unprefixed), which is what the library and tests speak. */
  topicSlug: string;
  /** Shown in the checklist when the topic's own title is too long or too vague. */
  label: string;
}

export interface LifeEventTemplate {
  key: LifeEventKey;
  /** The hub-home strip's label, so the two lists can never disagree. */
  title: string;
  /** Days in the qualifying-event window, or `null` for "no banner". */
  deadlineDays: number | null;
  /** Shown on the deadline banner, when there is one. */
  deadlineLabel?: string;
  /** The checklist footer's conversion CTA, from §16.5. */
  ctaLabel: string;
  steps: LifeEventStepSeed[];
}

export const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  {
    key: "having_a_baby",
    title: "Having a baby",
    deadlineDays: 30,
    deadlineLabel: "days to add your child to your health plan",
    ctaLabel: "Talk to my benefits team",
    steps: [
      {
        location: "group_health",
        topicSlug: "add-remove-dependent",
        label: "Add your child to your health plan",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Update your beneficiaries",
      },
      {
        location: "group_life",
        topicSlug: "how-much-coverage",
        label: "Review your life insurance coverage",
      },
      {
        location: "employee_resources",
        topicSlug: "parental-leave",
        label: "Learn about parental leave",
      },
      {
        location: "employee_resources",
        topicSlug: "tax-withholding",
        label: "Update your tax withholding",
      },
      {
        location: "group_health",
        topicSlug: "hsa-fsa-resources",
        label: "Adjust your FSA or HSA",
      },
      {
        location: "retirement",
        topicSlug: "college-savings",
        label: "Start saving for education",
      },
    ],
  },
  {
    key: "getting_married",
    title: "Getting married",
    deadlineDays: 30,
    deadlineLabel: "days to add your spouse to your health plan",
    ctaLabel: "Plan our finances together",
    steps: [
      {
        location: "group_health",
        topicSlug: "add-remove-dependent",
        label: "Add your spouse to health, dental, and vision",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Update your beneficiaries",
      },
      {
        location: "employee_resources",
        topicSlug: "name-change",
        label: "Change your name, if applicable",
      },
      {
        location: "employee_resources",
        topicSlug: "change-my-address",
        label: "Update your address, if moving",
      },
      {
        location: "group_life",
        topicSlug: "review-my-coverage",
        label: "Review life insurance for both of you",
      },
      {
        location: "employee_resources",
        topicSlug: "tax-withholding",
        label: "Update tax withholding",
      },
      {
        location: "retirement",
        topicSlug: "financial-planning",
        label: "Coordinate retirement savings as a couple",
      },
    ],
  },
  {
    key: "moving",
    title: "Moving",
    deadlineDays: null,
    ctaLabel: "Talk to my benefits team",
    steps: [
      {
        location: "employee_resources",
        topicSlug: "change-my-address",
        label: "Change your address everywhere",
      },
      {
        location: "group_health",
        topicSlug: "find-care-providers",
        label: "Check whether your health plan network covers your new area",
      },
      {
        location: "employee_resources",
        topicSlug: "tax-withholding",
        label: "Update state tax withholding",
      },
      {
        location: "retirement",
        topicSlug: "plan-materials",
        label: "Confirm your retirement account mail and email are current",
      },
    ],
  },
  {
    key: "leaving_the_company",
    title: "Leaving the company",
    deadlineDays: 60,
    deadlineLabel: "days to elect COBRA",
    ctaLabel: "Talk through my options",
    steps: [
      {
        location: "retirement",
        topicSlug: "rollovers-distributions",
        label: "Decide what to do with your retirement account",
      },
      {
        location: "retirement",
        topicSlug: "401k-loans",
        label: "Check for an outstanding 401(k) loan",
      },
      {
        location: "group_health",
        topicSlug: "open-enrollment",
        label: "Choose health coverage: COBRA vs. Marketplace",
      },
      {
        location: "group_life",
        topicSlug: "portability",
        label: "Continue life insurance: portability vs. conversion",
      },
      {
        location: "group_health",
        topicSlug: "hsa-fsa-resources",
        label: "Spend down your FSA before coverage ends",
      },
      {
        location: "group_health",
        topicSlug: "hsa-vs-fsa",
        label: "Keep your HSA; it's yours",
      },
      {
        location: "employee_resources",
        topicSlug: "change-my-address",
        label: "Update your address with every account",
      },
      {
        location: "employee_resources",
        topicSlug: "offboarding-cobra",
        label: "Final pay, PTO payout, and W-2 delivery",
      },
    ],
  },
  {
    key: "approaching_retirement",
    title: "Approaching Retirement",
    deadlineDays: null,
    ctaLabel: "Build my retirement income plan",
    steps: [
      {
        location: "retirement",
        topicSlug: "financial-planning",
        label: "Build a retirement income plan",
      },
      {
        location: "retirement",
        topicSlug: "social-security",
        label: "Decide when to claim Social Security",
      },
      {
        location: "group_health",
        topicSlug: "deductibles-copays-coinsurance",
        label: "Plan for Medicare",
      },
      {
        location: "retirement",
        topicSlug: "rollovers-distributions",
        label: "Choose what to do with your 401(k)",
      },
      {
        location: "retirement",
        topicSlug: "required-minimum-distributions",
        label: "Understand required minimum distributions",
      },
      {
        location: "group_life",
        topicSlug: "conversion",
        label: "Continue or convert life insurance",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Review beneficiaries and estate basics",
      },
    ],
  },
  {
    key: "losing_a_loved_one",
    title: "Losing a Loved One",
    deadlineDays: null,
    ctaLabel: "Get help from my benefits team",
    steps: [
      {
        location: "employee_resources",
        topicSlug: "time-off-leave",
        label: "Let HR know and ask about bereavement leave",
      },
      {
        location: "group_life",
        topicSlug: "file-a-claim",
        label: "File a life insurance claim, if they were covered",
      },
      {
        location: "retirement",
        topicSlug: "social-security",
        label: "Ask about Social Security survivor benefits",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Understand inherited retirement accounts",
      },
      {
        location: "group_health",
        topicSlug: "add-remove-dependent",
        label: "Update your own coverage and dependents",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Update your beneficiaries",
      },
      {
        location: "custom",
        topicSlug: "eap",
        label: "Reach out to your EAP for support",
      },
    ],
  },
  {
    key: "divorce",
    title: "Divorce",
    deadlineDays: 30,
    deadlineLabel: "days to change health coverage",
    ctaLabel: "Talk through my options",
    steps: [
      {
        location: "group_health",
        topicSlug: "add-remove-dependent",
        label: "Remove or change dependents on your health plan",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Understand how retirement accounts are divided (QDRO)",
      },
      {
        location: "retirement",
        topicSlug: "beneficiaries",
        label: "Update your beneficiaries",
      },
      {
        location: "employee_resources",
        topicSlug: "name-change",
        label: "Change your name, if applicable",
      },
      {
        location: "employee_resources",
        topicSlug: "tax-withholding",
        label: "Update tax withholding",
      },
      {
        location: "retirement",
        topicSlug: "financial-planning",
        label: "Rebuild your financial plan",
      },
    ],
  },
  {
    key: "going_on_leave",
    title: "Going on Leave",
    deadlineDays: 30,
    deadlineLabel: "days ahead to request leave",
    ctaLabel: "Talk to my benefits team",
    steps: [
      {
        location: "employee_resources",
        topicSlug: "fmla",
        label: "Understand your leave options (FMLA, parental, medical)",
      },
      {
        location: "group_life",
        topicSlug: "disability-coverage",
        label: "File a short-term disability claim, if applicable",
      },
      {
        location: "group_health",
        topicSlug: "understand-coverage",
        label: "Keep your benefits active while on leave",
      },
      {
        location: "retirement",
        topicSlug: "401k-loans",
        label: "401(k) contributions and loan payments while on leave",
      },
      {
        location: "employee_resources",
        topicSlug: "time-off-leave",
        label: "Plan your return to work",
      },
    ],
  },
];

/** Lookup by key — the seeded row stores the key, not the template. */
export function lifeEventTemplate(key: string): LifeEventTemplate | undefined {
  return LIFE_EVENT_TEMPLATES.find((template) => template.key === key);
}
