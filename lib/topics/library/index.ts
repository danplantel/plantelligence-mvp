import type {
  TopicCta,
  TopicDisplayMode,
  TopicLocation,
} from "@/types/topic";

/**
 * The shipped topic library (handoff §15, "Default topic library v1").
 *
 * TITLES AND PLACEMENT ONLY — as the handoff says, the copy is written separately
 * and reviewed for compliance. Each entry therefore carries just enough to seed a
 * plan correctly: what it is called, which locations it belongs to, whether it starts
 * as a Featured card or a Quick Answer, and which group that answer sits in. The
 * §16.6 quick answers are added with TF-13's content pass.
 *
 * One entry can belong to more than one location: "Update My Beneficiaries" is
 * written once and placed in both Retirement and Group Life, each with its own
 * placement (and, later, its own CTA).
 *
 * Slugs here are NOT namespaced. `systemTopicSlug()` adds the `sys.` prefix that the
 * `Topic.slug` unique constraint expects.
 */

export const SYSTEM_TOPIC_SLUG_PREFIX = "sys.";

/** `rollovers-distributions` → `sys.rollovers-distributions`. */
export function systemTopicSlug(slug: string): string {
  const clean = (slug || "").trim();
  if (!clean) return "";
  return clean.startsWith(SYSTEM_TOPIC_SLUG_PREFIX)
    ? clean
    : `${SYSTEM_TOPIC_SLUG_PREFIX}${clean}`;
}

/** A Custom-hub starter set, suggested by keyword from the advisor's own hub name. */
export type CustomStarterSetId = "financial_wellness" | "wellness" | "voluntary";

export interface LibraryTopicSeed {
  /** Stable, unprefixed identifier. */
  slug: string;
  title: string;
  summary?: string;
  /** Every location this topic belongs to by default. */
  defaultLocations: TopicLocation[];
  /** Where a plan places it on first seed. */
  displayByDefault: Extract<TopicDisplayMode, "featured" | "quick_answers">;
  /** Quick Answers group name. Required when `displayByDefault` is quick_answers. */
  group?: string;
  /** Cross-category Action Hub, shown with the ↔ badge in the builder (TF-5). */
  isActionHub?: boolean;
  tags?: string[];
  /** Only set on Custom-hub topics: which starter set offers them. */
  starterSet?: CustomStarterSetId;
  /** Prefilled conversion CTA, where the handoff ships one on by default. */
  cta?: TopicCta;
}

/** A Featured topic: a card in "How Can We Help You Today?". */
function featured(
  slug: string,
  title: string,
  locations: TopicLocation[],
  options: Partial<LibraryTopicSeed> = {},
): LibraryTopicSeed {
  return {
    slug,
    title,
    defaultLocations: locations,
    displayByDefault: "featured",
    ...options,
  };
}

/** A Quick Answer: a question in a named group. */
function answer(
  slug: string,
  title: string,
  locations: TopicLocation[],
  group: string,
  options: Partial<LibraryTopicSeed> = {},
): LibraryTopicSeed {
  return {
    slug,
    title,
    defaultLocations: locations,
    displayByDefault: "quick_answers",
    group,
    ...options,
  };
}

// ── Retirement ───────────────────────────────────────────────────────────────

const RETIREMENT: TopicLocation[] = ["retirement"];

const RETIREMENT_TOPICS: LibraryTopicSeed[] = [
  // Featured (default), in card order.
  featured("financial-planning", "Financial Planning", RETIREMENT, {
    summary:
      "A step-by-step planning process built around your goals, included with your plan.",
    cta: {
      label: "Schedule a planning call",
      actionType: "external_url",
    },
    tags: ["planning", "goals"],
  }),
  featured("rollovers-distributions", "Rollovers & Distributions", RETIREMENT, {
    summary: "Changing jobs? Compare your 4 options side by side.",
    cta: { label: "Talk through my options", actionType: "external_url" },
    tags: ["leaving", "options", "distribution"],
  }),
  featured("beneficiaries", "Update My Beneficiaries", RETIREMENT, {
    summary: "Update your 401(k) and life insurance beneficiaries in one place.",
    isActionHub: true,
    tags: ["beneficiaries", "life events"],
  }),
  featured("plan-materials", "Plan Materials", RETIREMENT, {
    summary: "Your plan documents, notices, and investment information.",
    tags: ["documents"],
  }),

  // Contributions & Saving.
  answer(
    "how-much-should-i-save",
    "How much should I be saving?",
    RETIREMENT,
    "Contributions & Saving",
    { cta: { label: "Check my savings rate", actionType: "external_url" }, tags: ["saving"] },
  ),
  answer("change-contribution-rate", "Change my contribution rate", RETIREMENT, "Contributions & Saving"),
  answer("roth-vs-pre-tax", "Roth vs. Pre-Tax", RETIREMENT, "Contributions & Saving", {
    tags: ["roth", "tax"],
  }),
  answer("catch-up-contributions", "Catch-up contributions", RETIREMENT, "Contributions & Saving", {
    tags: ["50+", "saving"],
  }),
  answer("employer-match", "Employer match", RETIREMENT, "Contributions & Saving", {
    tags: ["match", "saving"],
  }),

  // Investing.
  answer("investment-options", "Understanding investment options", RETIREMENT, "Investing"),
  answer("target-date-funds", "Target date funds", RETIREMENT, "Investing"),
  answer(
    "review-investments-outside-plan",
    "Review investments outside the plan",
    RETIREMENT,
    "Investing",
    { cta: { label: "Get a second opinion", actionType: "external_url" } },
  ),

  // Taking Money Out.
  answer("401k-loans", "401(k) loans", RETIREMENT, "Taking Money Out", {
    tags: ["loan"],
  }),
  answer("hardship-withdrawals", "Hardship withdrawals", RETIREMENT, "Taking Money Out"),
  answer(
    "required-minimum-distributions",
    "Required minimum distributions",
    RETIREMENT,
    "Taking Money Out",
    { tags: ["rmd", "distribution"] },
  ),
  answer("previous-employer-plans", "Previous employer plans", RETIREMENT, "Taking Money Out", {
    tags: ["rollover", "leaving"],
  }),

  // Planning Ahead.
  answer("understanding-vesting", "Understanding vesting", RETIREMENT, "Planning Ahead"),
  answer("social-security", "Social Security", RETIREMENT, "Planning Ahead", {
    tags: ["retirement income"],
  }),
  answer("college-savings", "College savings", RETIREMENT, "Planning Ahead", {
    tags: ["529"],
  }),
  answer("what-if-i-leave", "What happens if I leave?", RETIREMENT, "Planning Ahead", {
    tags: ["leaving"],
  }),
];

// ── Group Health ─────────────────────────────────────────────────────────────

const GROUP_HEALTH: TopicLocation[] = ["group_health"];

const GROUP_HEALTH_TOPICS: LibraryTopicSeed[] = [
  featured("access-health-account", "Access My Health Account", GROUP_HEALTH, {
    summary: "Sign in to see coverage, ID cards, claims, and spending accounts.",
    tags: ["login", "account"],
  }),
  featured("find-care-providers", "Find Care & Providers", GROUP_HEALTH, {
    summary: "Search your plan's network for doctors, hospitals, and specialists.",
    tags: ["network", "provider"],
  }),
  featured("understand-coverage", "Understand My Coverage", GROUP_HEALTH, {
    summary: "What your plan pays, what you pay, and when.",
    tags: ["coverage"],
  }),
  featured("hsa-fsa-resources", "HSA / FSA Resources", GROUP_HEALTH, {
    summary: "How your spending accounts work and what they cover.",
    tags: ["hsa", "fsa"],
  }),

  // Understanding Coverage.
  answer(
    "deductibles-copays-coinsurance",
    "Deductibles, copays & coinsurance",
    GROUP_HEALTH,
    "Understanding Coverage",
  ),
  answer("prescription-coverage", "Prescription coverage", GROUP_HEALTH, "Understanding Coverage"),
  answer("preventive-care", "Preventive care", GROUP_HEALTH, "Understanding Coverage"),
  answer("dental-vision", "Dental & vision", GROUP_HEALTH, "Understanding Coverage"),

  // Using Your Plan.
  answer("telehealth", "Telehealth", GROUP_HEALTH, "Using Your Plan"),
  answer("id-cards", "ID cards", GROUP_HEALTH, "Using Your Plan"),
  answer("claims-billing", "Claims & billing", GROUP_HEALTH, "Using Your Plan"),
  answer("urgent-care-vs-er", "Urgent care vs. ER", GROUP_HEALTH, "Using Your Plan"),

  // Changes.
  answer("add-remove-dependent", "Add or remove a dependent", GROUP_HEALTH, "Changes", {
    isActionHub: true,
    tags: ["life event", "dependent"],
  }),
  answer("qualifying-life-events", "Qualifying life events", GROUP_HEALTH, "Changes", {
    tags: ["life event"],
  }),
  answer("open-enrollment", "Open enrollment", GROUP_HEALTH, "Changes"),

  // Accounts.
  answer("hsa-vs-fsa", "HSA vs. FSA", GROUP_HEALTH, "Accounts", { tags: ["hsa", "fsa"] }),
  answer("eligible-expenses", "Eligible expenses", GROUP_HEALTH, "Accounts"),
  answer("contribution-limits", "Contribution limits", GROUP_HEALTH, "Accounts"),
];

// ── Group Life ───────────────────────────────────────────────────────────────

const GROUP_LIFE: TopicLocation[] = ["group_life"];

const GROUP_LIFE_TOPICS: LibraryTopicSeed[] = [
  featured("review-my-coverage", "Review My Coverage", GROUP_LIFE, {
    summary: "See what your employer provides and what you can add.",
    tags: ["coverage"],
  }),
  featured("beneficiaries", "Update My Beneficiaries", GROUP_LIFE, {
    summary: "Keep your life insurance beneficiaries current.",
    isActionHub: true,
    tags: ["beneficiaries", "life events"],
  }),
  featured("file-a-claim", "File a Claim / Get Support", GROUP_LIFE, {
    summary: "Start a claim or find the right person to help.",
    tags: ["claim"],
  }),
  featured("understand-my-options", "Understand My Options", GROUP_LIFE, {
    summary: "Basic, voluntary, and what happens when coverage ends.",
    tags: ["options"],
  }),

  // Coverage Types.
  answer("basic-vs-voluntary-life", "Basic vs. voluntary life", GROUP_LIFE, "Coverage Types"),
  answer("spouse-dependent-coverage", "Spouse & dependent coverage", GROUP_LIFE, "Coverage Types"),
  answer("ad-d", "AD&D", GROUP_LIFE, "Coverage Types"),
  answer("disability-coverage", "Disability coverage", GROUP_LIFE, "Coverage Types", {
    tags: ["disability"],
  }),

  // Enrollment.
  answer("evidence-of-insurability", "Evidence of insurability", GROUP_LIFE, "Enrollment", {
    tags: ["eoi", "enrollment"],
  }),
  answer("how-much-coverage", "How much coverage do I need?", GROUP_LIFE, "Enrollment", {
    cta: { label: "Review my coverage gap", actionType: "external_url" },
  }),

  // Leaving or Retiring.
  answer("portability", "Portability", GROUP_LIFE, "Leaving or Retiring", {
    tags: ["leaving"],
  }),
  answer("conversion", "Conversion", GROUP_LIFE, "Leaving or Retiring", {
    tags: ["leaving"],
  }),

  // Beneficiaries.
  answer("beneficiary-questions", "Beneficiary questions", GROUP_LIFE, "Beneficiaries"),
  answer("naming-minor-or-trust", "Naming a minor or trust", GROUP_LIFE, "Beneficiaries"),
];

// ── Other / Custom (suggested starter sets, never seeded blindly) ────────────
//
// The handoff gives Custom no fixed defaults: when the advisor names the hub, we
// SUGGEST a starter set by keyword and they can always start blank. Every entry here
// is tagged with its `starterSet`, so `lib/topics/library-keywords.ts` can offer the
// matching one without a second copy of these titles.

const CUSTOM: TopicLocation[] = ["custom"];

const CUSTOM_TOPICS: LibraryTopicSeed[] = [
  // Financial Wellness.
  featured("budgeting-emergency-savings", "Budgeting & Emergency Savings", CUSTOM, {
    starterSet: "financial_wellness",
    tags: ["financial wellness", "budget", "savings"],
  }),
  featured("paying-down-debt", "Paying Down Debt", CUSTOM, {
    starterSet: "financial_wellness",
    tags: ["financial wellness", "debt"],
  }),
  featured("estate-basics", "Estate Basics: Wills, Trusts, Beneficiaries", CUSTOM, {
    starterSet: "financial_wellness",
    tags: ["financial wellness", "estate"],
  }),
  featured("credit-scores", "Credit Scores", CUSTOM, {
    starterSet: "financial_wellness",
    tags: ["financial wellness", "credit"],
  }),

  // Wellness.
  featured("eap", "EAP", CUSTOM, {
    summary: "Confidential counseling and support, at no cost to you.",
    starterSet: "wellness",
    tags: ["wellness", "eap", "counseling"],
  }),
  featured("mental-health-resources", "Mental Health Resources", CUSTOM, {
    starterSet: "wellness",
    tags: ["wellness", "mental health"],
  }),
  featured("fitness-benefits", "Fitness Benefits", CUSTOM, {
    starterSet: "wellness",
    tags: ["wellness", "fitness"],
  }),

  // Voluntary Benefits.
  featured("long-term-care", "Long-Term Care", CUSTOM, {
    starterSet: "voluntary",
    tags: ["voluntary", "long term care"],
  }),
  featured("critical-illness-accident", "Critical Illness & Accident", CUSTOM, {
    starterSet: "voluntary",
    tags: ["voluntary", "critical illness", "accident"],
  }),
  featured("pet-insurance", "Pet Insurance", CUSTOM, {
    starterSet: "voluntary",
    tags: ["voluntary", "pet"],
  }),
  featured("legal-plans", "Legal Plans", CUSTOM, {
    starterSet: "voluntary",
    tags: ["voluntary", "legal"],
  }),
];

// ── Employee Resources (TF-6) ────────────────────────────────────────────────
//
// The fifth location. It is NOT a benefit category: it has no Benefit row, does not
// count toward the 1–4 limit, and sits after the categories in navigation. The titles
// and groups below are the handoff's §8 builder example and §7b defaults — the HR
// topics a participant asks about, which no carrier owns.

const EMPLOYEE_RESOURCES: TopicLocation[] = ["employee_resources"];

const EMPLOYEE_RESOURCES_TOPICS: LibraryTopicSeed[] = [
  // Featured (default), in card order.
  featured("change-my-address", "Change My Address", EMPLOYEE_RESOURCES, {
    summary: "Update your address with payroll and every benefit carrier.",
    isActionHub: true,
    tags: ["address", "life event", "personal details"],
  }),
  featured("pay-stubs-direct-deposit", "Pay Stubs & Direct Deposit", EMPLOYEE_RESOURCES, {
    summary: "See your pay history and where your paycheck is sent.",
    tags: ["payroll", "pay stub", "direct deposit"],
  }),
  featured("time-off-leave", "Time Off & Leave", EMPLOYEE_RESOURCES, {
    summary: "PTO balances, holidays, and the leave options available to you.",
    tags: ["pto", "fmla", "parental leave"],
  }),
  featured("who-do-i-contact", "Who Do I Contact?", EMPLOYEE_RESOURCES, {
    summary: "The right person for payroll, benefits, and HR questions.",
    tags: ["contact", "hr"],
  }),

  // Pay & Taxes.
  answer("pay-stubs", "Pay stubs", EMPLOYEE_RESOURCES, "Pay & Taxes", {
    tags: ["payroll"],
  }),
  answer("w2-tax-forms", "W-2 & tax forms", EMPLOYEE_RESOURCES, "Pay & Taxes", {
    tags: ["w-2", "tax"],
  }),
  answer("direct-deposit", "Direct deposit", EMPLOYEE_RESOURCES, "Pay & Taxes", {
    tags: ["payroll"],
  }),
  answer("tax-withholding", "Tax withholding", EMPLOYEE_RESOURCES, "Pay & Taxes", {
    tags: ["tax", "w-4"],
  }),

  // Time Off & Leave.
  answer("pto-policy", "PTO policy", EMPLOYEE_RESOURCES, "Time Off & Leave", {
    tags: ["pto"],
  }),
  answer("fmla", "FMLA", EMPLOYEE_RESOURCES, "Time Off & Leave", {
    tags: ["leave"],
  }),
  answer("parental-leave", "Parental leave", EMPLOYEE_RESOURCES, "Time Off & Leave", {
    tags: ["leave", "life event"],
  }),
  answer("holidays", "Holidays", EMPLOYEE_RESOURCES, "Time Off & Leave", {
    tags: ["holiday", "calendar"],
  }),

  // Policies.
  answer("employee-handbook", "Employee handbook", EMPLOYEE_RESOURCES, "Policies", {
    tags: ["handbook"],
  }),
  answer("code-of-conduct", "Code of conduct", EMPLOYEE_RESOURCES, "Policies", {
    tags: ["policy"],
  }),
  answer(
    "reporting-concerns",
    "Reporting concerns",
    EMPLOYEE_RESOURCES,
    "Policies",
    { tags: ["policy", "compliance"] },
  ),

  // Employment.
  answer(
    "verification-of-employment",
    "Verification of employment",
    EMPLOYEE_RESOURCES,
    "Employment",
    { tags: ["employment", "letter"] },
  ),
  answer("name-change", "Change my name", EMPLOYEE_RESOURCES, "Employment", {
    isActionHub: true,
    tags: ["name change", "life event", "personal details"],
  }),
  answer("onboarding", "Onboarding", EMPLOYEE_RESOURCES, "Employment", {
    tags: ["new hire"],
  }),
  answer("offboarding-cobra", "Offboarding & COBRA", EMPLOYEE_RESOURCES, "Employment", {
    tags: ["leaving", "cobra"],
  }),
];

/** Every shipped topic, in library order. */
export const TOPIC_LIBRARY: LibraryTopicSeed[] = [
  ...RETIREMENT_TOPICS,
  ...GROUP_HEALTH_TOPICS,
  ...GROUP_LIFE_TOPICS,
  ...CUSTOM_TOPICS,
  ...EMPLOYEE_RESOURCES_TOPICS,
];

/**
 * The default Quick Answers group order per location (§15). Groups are seeded in this
 * order, so a plan's group list reads the same way the handoff documents it. A group
 * missing here (an advisor's own, or a future addition) sorts after these by name.
 */
export const DEFAULT_QUICK_ANSWER_GROUPS: Partial<Record<TopicLocation, string[]>> = {
  retirement: [
    "Contributions & Saving",
    "Investing",
    "Taking Money Out",
    "Planning Ahead",
  ],
  group_health: [
    "Understanding Coverage",
    "Using Your Plan",
    "Changes",
    "Accounts",
  ],
  group_life: [
    "Coverage Types",
    "Enrollment",
    "Leaving or Retiring",
    "Beneficiaries",
  ],
  // Employee Resources (TF-6) — the handoff's §8 groups.
  employee_resources: ["Pay & Taxes", "Time Off & Leave", "Policies", "Employment"],
};

/** The library entries that belong to one location, in order. */
export function libraryTopicsForLocation(
  location: TopicLocation,
): LibraryTopicSeed[] {
  return TOPIC_LIBRARY.filter((topic) => topic.defaultLocations.includes(location));
}

/**
 * Custom-hub entries for one starter set. Custom is never seeded automatically — the
 * advisor accepts a suggestion or starts blank — so this is only read when they do.
 */
export function libraryTopicsForStarterSet(
  setId: CustomStarterSetId,
): LibraryTopicSeed[] {
  return TOPIC_LIBRARY.filter((topic) => topic.starterSet === setId);
}

/** Lookup by unprefixed slug. */
export function libraryTopicBySlug(
  slug: string,
): LibraryTopicSeed | undefined {
  const clean = (slug || "").trim().replace(/^sys\./, "");
  return TOPIC_LIBRARY.find((topic) => topic.slug === clean);
}
