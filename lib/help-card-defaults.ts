import { displayCategoryName } from "@/lib/benefit-custom-name";
import type { HelpCardContent } from "@/types/benefit";

/**
 * "How Can We Help You Today?" — the card CATALOG.
 *
 * The advisor configures the LAYOUT (order + which card is primary); the copy is
 * static here and resolved by id, so a card's text is identical on every benefit
 * of that category and can never be edited per plan.
 *
 * There are four catalogs:
 *
 *  - [`RETIREMENT_HELP_CARDS`] — the Retirement page's seeded set: the six
 *    Featured topics from the content handoff, plus the optional Account Access
 *    card. Account Access does not count toward the six.
 *  - [`GROUP_HEALTH_HELP_CARDS`] — the Group Health page's set: the five Featured
 *    topics, plus Account Access.
 *  - [`GROUP_LIFE_HELP_CARDS`] — the Group Life page's set: the five Featured
 *    topics (Disability Benefits among them), plus Account Access.
 *  - [`HELP_CARD_CATALOG`] — the shared fallback used for the Custom hub and for
 *    the editor before a category is known.
 *
 * `[Benefit Category]`, `[Company Name]` and `[Advisor Name]` are merge tokens,
 * resolved at render time by the portal section. Copy that came from the handoff
 * with per-plan `{{tokens}}` is written here in neutral language instead: the
 * plan values do not exist yet (see the handoff's "Before launch" list).
 */

/** `data-help-card` id of the wide Account Access card. */
export const ACCOUNT_ACCESS_CARD_ID = "account-access";

/** True for the Retirement category in every spelling the app stores. */
export function isRetirementHelpCategory(category?: string | null): boolean {
  return (category || "").trim().toLowerCase() === "retirement";
}

/** True for the Group Health category ("Group Health" / "Health Insurance"). */
export function isGroupHealthHelpCategory(category?: string | null): boolean {
  const value = (category || "").trim().toLowerCase();
  return value === "group health" || value === "health insurance";
}

/** True for the Group Life category ("Group Life" / "Life Insurance"). */
export function isGroupLifeHelpCategory(category?: string | null): boolean {
  const value = (category || "").trim().toLowerCase();
  return value === "group life" || value === "life insurance";
}

/**
 * The quick actions printed on the Account Access card.
 *
 * Retirement signs in to a recordkeeper (balances and contributions); every other
 * category in this build still uses the health-carrier phrasing.
 */
export function accountAccessActionsFor(category?: string | null): string[] {
  if (isRetirementHelpCategory(category)) {
    return ["View balances", "Change contributions", "Update beneficiaries"];
  }
  return ["See coverage", "Get ID cards", "Make changes", "Update dependents"];
}

/**
 * Retirement — the six Featured topics from the content handoff, in card order,
 * after the optional Account Access card.
 *
 * Card line lives in `body`; the panel's answer lives in `paragraphs` (the
 * handoff's "Quick Answer"). Steps appear in Quick Answers, not on the card.
 */
export const RETIREMENT_HELP_CARDS: HelpCardContent[] = [
  {
    id: ACCOUNT_ACCESS_CARD_ID,
    title: "[Benefit Category] Account Access",
    paragraphs: [
      "Log in to {{recordkeeper_name}} to see your balance, statements, and account details.",
    ],
    cta: "",
  },
  {
    id: "enroll-change-contributions",
    title: "Enroll / Change My Contributions",
    body: "Enroll in your plan or adjust how much you're saving.",
    paragraphs: [
      "Once you're eligible, you can enroll or change how much you save at any time through your plan's recordkeeper. A common starting point is at least enough to get the full employer match.",
    ],
    // The handoff's "Steps" block. `{{recordkeeper_url}}` is filled at render
    // time from the plan's login URL, with a plain-language fallback when the
    // plan has not set one.
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Go to Contributions or Deferral Rate.",
      "Choose a percentage of pay. You can split it between pre-tax and Roth.",
      "Pick your investments, or keep the default.",
      "Name or confirm your beneficiary, then save.",
    ],
    docs: ["Enrollment Guide", "Summary Plan Description"],
    video: "How Your Retirement Plan Works",
    related: [
      "How much should I be saving?",
      "Roth vs. Pre-Tax",
      "Contribution limits",
      "Auto-escalation",
    ],
    tags: [
      "enroll",
      "sign up",
      "join",
      "contribution",
      "deferral",
      "percentage",
      "paycheck",
      "save more",
    ],
    cta: "Enroll or Change My Contribution",
  },
  {
    id: "employer-match-vesting",
    title: "Employer Match & Vesting",
    body: "Understand what your employer contributes and when it's yours to keep.",
    paragraphs: [
      "Your employer matches a formula set by your plan. Your own contributions are always 100% yours. Employer contributions become yours over time on your plan's vesting schedule.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Confirm you're contributing at least the rate your plan requires to get the full match.",
      "Check your vested balance on your account summary.",
    ],
    // The Safe Harbor Notice is gated on "safe harbor = Yes" in the handoff; that
    // plan field does not exist yet, so only the SPD (always in the plan) is named.
    docs: ["Summary Plan Description"],
    related: [
      "How does the employer match work?",
      "Am I receiving the full match?",
      "What does vested mean?",
      "What happens to unvested money if I leave?",
    ],
    tags: [
      "match",
      "employer contribution",
      "free money",
      "vesting",
      "vested",
      "profit sharing",
    ],
    cta: "Check My Match",
    // The handoff gates this topic on "Match = Yes". Those plan yes/no fields do
    // not exist yet, so it ships hidden: it keeps its place in the Card Layout
    // list (unticked) and stays out of the default portal grid until the advisor
    // turns it on.
    defaultEnabled: false,
  },
  {
    id: "manage-investments",
    title: "Manage My Investments",
    body: "Review your investment options or get help making decisions.",
    paragraphs: [
      "You choose how your account is invested from the plan's fund lineup. If you never made a choice, your money is in the plan's default fund. You can change your investments online at any time.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Go to Investments.",
      "Choose to change future contributions, move your existing balance, or both.",
      "Review your choices and confirm.",
    ],
    docs: ["Fund Fact Sheets", "Participant Fee Disclosure", "QDIA Notice"],
    video: "Understanding Target-Date Funds",
    contact: "{{advisor_name}}",
    related: [
      "What is a target-date fund?",
      "Where is my money currently invested?",
      "Fees and expenses",
      "Review investments outside of the plan",
    ],
    tags: [
      "investments",
      "funds",
      "allocation",
      "target date",
      "portfolio",
      "rebalance",
      "performance",
      "stocks",
      "bonds",
    ],
    cta: "Get Investment Help",
    ctaDestination: "advisor",
  },
  {
    id: "beneficiaries",
    title: "Update My Beneficiary",
    body: "Make sure your account goes to the people you choose.",
    paragraphs: [
      "Your beneficiary designation decides who receives your account, even if your will says otherwise. If you're married, your spouse is usually your beneficiary unless they give written consent to name someone else. Review it after any marriage, divorce, birth, adoption, or death in the family.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Go to Beneficiaries.",
      "Add primary and contingent beneficiaries, with percentages.",
      "Save. If your spouse is not the primary beneficiary, submit the spousal consent form to your HR contact.",
    ],
    docs: ["Beneficiary Designation Form", "Spousal Consent Form"],
    contact: "Your HR contact",
    related: ["Update my beneficiary", "Who do I contact?"],
    tags: [
      "beneficiary",
      "who gets my money",
      "spouse",
      "contingent",
      "married",
      "divorced",
      "new baby",
    ],
    // The Beneficiary Action Hub IS this topic's call to action when the plan has
    // other benefits with beneficiary tools; the generic button only appears when
    // it does not, and then hands the reader to the HR contact card.
    cta: "Update My Beneficiary",
    ctaDestination: "contact",
  },
  {
    id: "leaving-retiring",
    title: "Leaving or Retiring",
    body: "Explore your options when leaving the company or preparing for retirement.",
    paragraphs: [
      "Your vested balance stays yours when you leave. You can usually keep it in the plan, roll it to an IRA or a new employer's plan, or cash it out. Cashing out carries tax costs, so review your options before you decide.",
    ],
    steps: [
      "Check your vested balance.",
      "Compare your options in the Quick Answers below.",
      "Talk with {{advisor_name}} before you choose.",
      "Request your rollover or distribution through {{recordkeeper_name}}.",
    ],
    docs: [
      "Distribution Request Form",
      "Rollover Guide",
      "Summary Plan Description",
    ],
    video: "Your Options When You Leave",
    related: [
      "Roll over to an IRA",
      "Cashing out",
      "Required Minimum Distributions",
      "Approaching retirement",
    ],
    tags: [
      "leaving",
      "quit",
      "terminated",
      "new job",
      "retire",
      "retirement",
      "rollover",
      "cash out",
      "IRA",
    ],
    cta: "Talk Through My Options",
    ctaDestination: "advisor",
  },
  {
    id: "financial-planning",
    title: "Financial Planning",
    body: "Get help building a financial plan around your goals.",
    paragraphs: [
      "{{advisor_name}} of {{advisor_firm}} works with employees of {{plan_sponsor_name}} on retirement goals, savings, and the bigger financial picture. Financial planning may be included at no additional cost as part of your benefits. You can meet one-on-one or join an upcoming session.",
    ],
    steps: [
      "Book a time that works for you.",
      "Have your latest account statement handy.",
      "Jot down your goals and questions.",
    ],
    meetings: "{{upcoming_retirement_meetings}}",
    related: [
      "How much should I be saving?",
      "Social Security",
      "Approaching retirement",
      "Review investments outside of the plan",
    ],
    tags: [
      "advisor",
      "financial plan",
      "planning",
      "on track",
      "meeting",
      "appointment",
      "goals",
      "help",
    ],
    cta: "Book a Meeting",
    ctaDestination: "advisor",
  },
];

/** Every Retirement card id, in its natural order (Account Access first). */
export const RETIREMENT_HELP_CARD_ORDER: string[] = RETIREMENT_HELP_CARDS.map(
  (card) => card.id,
);

/**
 * Group Health — the five Featured topics from the content handoff, after the
 * optional Account Access card.
 *
 * The handoff's carrier member portal is this category's login URL, so the
 * Account Access card, the steps and every member-portal CTA all point at the
 * same place: `{{recordkeeper_url}}`, which the hub fills from the benefit's
 * login URL.
 *
 * All five ship visible. The handoff gates HSA / FSA on "HSA = Yes or FSA = Yes",
 * but those plan fields do not exist yet and the card is part of the page's
 * designed set, so it is drawn like the rest and the advisor can switch it off in
 * Card Layout.
 */
export const GROUP_HEALTH_HELP_CARDS: HelpCardContent[] = [
  {
    id: ACCOUNT_ACCESS_CARD_ID,
    title: "[Benefit Category] Account Access",
    paragraphs: [
      "Log in to {{recordkeeper_name}} to see your ID card, claims, and coverage.",
    ],
    cta: "",
  },
  {
    id: "understand-coverage",
    title: "Understand My Coverage",
    body: "See what's covered and understand how your health plan works.",
    paragraphs: [
      "You're covered through {{recordkeeper_name}}. Your Summary of Benefits and Coverage shows your deductible, copays, coinsurance, and out-of-pocket maximum side by side.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Open your plan details or digital ID card.",
      "Review the Summary of Benefits and Coverage for your costs.",
    ],
    docs: ["Summary of Benefits and Coverage", "Benefits Guide"],
    video: "How Your Health Plan Works",
    related: [
      "What is my deductible?",
      "What is coinsurance?",
      "What is my out-of-pocket maximum?",
      "In-network vs. out-of-network",
    ],
    tags: [
      "coverage",
      "what's covered",
      "health plan",
      "medical plan",
      "benefits",
      "ID card",
    ],
    cta: "View My Coverage",
  },
  {
    id: "find-care-providers",
    title: "Find Care",
    body: "Find doctors, specialists, urgent care, and other in-network providers.",
    paragraphs: [
      "Staying in network keeps your costs lowest. Use {{recordkeeper_name}}'s provider search to find doctors, specialists, hospitals, and urgent care near you. For quick visits, your plan may also offer care by phone or video.",
    ],
    steps: [
      "Open Find Care on {{recordkeeper_url}}.",
      "Select your plan's network.",
      "Search by specialty, name, or location.",
      "Call the office to confirm they're in network before your visit.",
    ],
    video: "Finding In-Network Care",
    related: [
      "Find a specialist",
      "Urgent care vs. emergency room",
      "Telehealth",
      "Mental health resources",
    ],
    tags: [
      "find a doctor",
      "provider",
      "in network",
      "specialist",
      "urgent care",
      "primary care",
      "near me",
    ],
    cta: "Find a Doctor",
  },
  {
    id: "claims-bills-costs",
    title: "Claims, Bills & Costs",
    body: "Get help understanding claims, bills, deductibles, and out-of-pocket costs.",
    paragraphs: [
      "After a visit, {{recordkeeper_name}} sends an Explanation of Benefits (EOB) showing what the plan paid and what you may owe. Compare your bill to the EOB before you pay. If they don't match, call the provider's billing office or {{recordkeeper_name}}.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Open Claims to see each EOB.",
      "Match the amount you may owe to your bill.",
      "Call the carrier if something doesn't match.",
    ],
    docs: ["Summary of Benefits and Coverage"],
    video: "Reading Your EOB",
    related: [
      "Understanding an EOB",
      "Denied claims",
      "Medical bill questions",
      "What is my out-of-pocket maximum?",
    ],
    tags: [
      "claim",
      "bill",
      "EOB",
      "cost",
      "owe",
      "charge",
      "billing",
      "statement",
    ],
    cta: "View My Claims",
  },
  {
    id: "add-remove-dependent",
    title: "Add or Remove a Dependent",
    body: "Make coverage changes after marriage, birth, divorce, or another qualifying event.",
    paragraphs: [
      "Outside Open Enrollment, you can change coverage only after a qualifying life event, such as marriage, birth, adoption, divorce, or losing other coverage. You must request the change within your plan's change window after the event.",
    ],
    steps: [
      "Gather proof of the event, such as a marriage or birth certificate.",
      "Log in at {{recordkeeper_url}} or contact your HR department.",
      "Add or remove the dependent and upload your documents.",
      "Confirm the change and your new payroll deduction.",
    ],
    docs: ["Benefits Guide", "Dependent Verification Requirements"],
    contact: "Your HR contact",
    related: [
      "Qualifying life events",
      "Add a newborn or adopted child",
      "Add a spouse",
      "Divorce or legal separation",
    ],
    tags: [
      "add dependent",
      "spouse",
      "baby",
      "newborn",
      "marriage",
      "divorce",
      "remove dependent",
      "life event",
    ],
    // The Dependent Action Hub is the handoff's CTA; until that panel exists the
    // button hands the reader to the plan's HR contact card.
    cta: "Make a Coverage Change",
    ctaDestination: "contact",
  },
  {
    id: "hsa-fsa-resources",
    title: "HSA / FSA",
    body: "Learn how a Health Savings Account (HSA) or a Flexible Spending Account (FSA) works.",
    paragraphs: [
      "An HSA (Health Savings Account) lets you save pre-tax money for medical costs while you're enrolled in a high-deductible health plan, and the money is yours to keep, even if you leave. An FSA (Flexible Spending Account) lets you set aside pre-tax money for eligible expenses during the plan year, but most unused funds don't roll over.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Check your balance and contribution amount.",
      "Pay with your benefits card, or submit a reimbursement with your receipt.",
    ],
    docs: ["HSA/FSA Guide", "Eligible Expenses List"],
    video: "HSA vs. FSA",
    related: [
      "HSA vs. FSA",
      "Eligible expenses",
      "Contribution limits",
      "What happens to unused funds?",
    ],
    tags: [
      "HSA",
      "FSA",
      "health savings",
      "flexible spending",
      "pre-tax",
      "benefits card",
      "reimbursement",
    ],
    cta: "Go to My Account",
  },
];

/** Every Group Health card id, in its natural order (Account Access first). */
export const GROUP_HEALTH_HELP_CARD_ORDER: string[] =
  GROUP_HEALTH_HELP_CARDS.map((card) => card.id);

/**
 * Group Life — the five Featured topics from the content handoff, after the
 * optional Account Access card.
 *
 * Disability Benefits is the handoff's fifth card, shown when the employer offers
 * STD or LTD. Those plan fields do not exist yet and the card is part of the
 * designed set, so it ships visible and the advisor can switch it off.
 *
 * The carrier's member portal is this category's login URL, so Account Access, the
 * steps and every carrier CTA point at `{{recordkeeper_url}}`, filled by the hub
 * from the benefit's login URL.
 */
export const GROUP_LIFE_HELP_CARDS: HelpCardContent[] = [
  {
    id: ACCOUNT_ACCESS_CARD_ID,
    title: "[Benefit Category] Account Access",
    paragraphs: [
      "Log in to {{recordkeeper_name}} to see your coverage and beneficiaries.",
    ],
    cta: "",
  },
  {
    id: "review-my-coverage",
    title: "Review My Coverage",
    body: "See your current life and disability coverage.",
    paragraphs: [
      "{{plan_sponsor_name}} provides basic life insurance. Check your benefits summary for the amount and what it costs you. It may include matching accidental death and dismemberment (AD&D) coverage, and you may also have added voluntary coverage for yourself or your family.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Open Life Insurance.",
      "Review your coverage amounts for yourself, your spouse, and your children.",
    ],
    docs: ["Life Insurance Certificate", "Benefits Guide"],
    related: [
      "Basic vs. voluntary life insurance",
      "How much coverage do I have?",
      "AD&D",
      "Why is there life insurance income on my pay stub?",
    ],
    tags: [
      "life insurance",
      "coverage amount",
      "how much",
      "basic life",
      "AD&D",
      "death benefit",
    ],
    cta: "View My Coverage",
  },
  {
    id: "beneficiaries",
    title: "Update My Beneficiary",
    body: "Review or update who receives your life insurance benefit.",
    paragraphs: [
      "Your life insurance beneficiary is separate from your retirement plan beneficiary, so update both. Review your choices after any marriage, divorce, birth, adoption, or death in the family. Minor children can't receive the money directly, so consider a trust or custodian.",
    ],
    steps: [
      "Log in at {{recordkeeper_url}}.",
      "Go to Beneficiaries.",
      "Add primary and contingent beneficiaries, with percentages.",
      "Save and confirm.",
    ],
    docs: ["Beneficiary Designation Form"],
    contact: "Your HR contact",
    related: [
      "Primary vs. contingent beneficiaries",
      "Naming a minor",
      "Naming a trust",
      "When should I review my beneficiary?",
    ],
    tags: [
      "beneficiary",
      "who gets my life insurance",
      "spouse",
      "children",
      "contingent",
      "divorced",
      "married",
    ],
    // The Beneficiary Action Hub is the handoff's CTA; until that panel exists
    // the button hands the reader to the plan's HR contact card.
    cta: "Update My Beneficiary",
    ctaDestination: "contact",
  },
  {
    id: "change-or-add-coverage",
    title: "Change or Add Coverage",
    body: "Explore voluntary coverage for yourself and eligible family members.",
    paragraphs: [
      "You can buy additional life insurance for yourself, your spouse, and your children through payroll deduction. Amounts up to the plan's guaranteed issue amount are guaranteed when you first enroll. Higher amounts, or enrolling later, may require Evidence of Insurability, which means answering health questions.",
    ],
    steps: [
      "Check that you're in an enrollment window: new hire, Open Enrollment, or a qualifying life event.",
      "Log in at {{recordkeeper_url}}.",
      "Choose your coverage amounts and review the cost per paycheck.",
      "Complete Evidence of Insurability if prompted.",
    ],
    docs: ["Voluntary Life Rates", "Benefits Guide"],
    video: "How Much Life Insurance Do I Need?",
    related: [
      "How much coverage do I need?",
      "Evidence of insurability",
      "Spouse coverage",
      "When can I change coverage?",
    ],
    tags: [
      "add life insurance",
      "voluntary life",
      "supplemental life",
      "more coverage",
      "spouse life",
      "child life",
    ],
    cta: "Add Coverage",
  },
  {
    id: "file-a-claim",
    title: "File a Claim / Get Help",
    body: "Find claim information and connect with the right person.",
    paragraphs: [
      "To file a life insurance claim, contact your HR department first. HR completes the employer section, and the beneficiary sends a claim form and certified death certificate to {{recordkeeper_name}}. We know this can be a difficult time, and your HR contact can walk you through each step.",
    ],
    steps: [
      "Notify your HR department.",
      "The beneficiary completes the claim form.",
      "Send the claim form and a certified death certificate to {{recordkeeper_name}}.",
      "{{recordkeeper_name}} reviews the claim and pays the benefit once approved.",
    ],
    docs: ["Life Claim Form"],
    contact: "{{recordkeeper_name}}",
    related: [
      "What documentation is required?",
      "Who should I contact?",
      "What happens after a claim is submitted?",
    ],
    tags: [
      "claim",
      "death",
      "passed away",
      "file a claim",
      "death certificate",
      "beneficiary claim",
    ],
    cta: "Start a Claim",
  },
  {
    id: "disability-benefits",
    title: "Disability Benefits",
    body: "Understand your income protection if you can't work because of illness or injury.",
    paragraphs: [
      "Short-term disability replaces part of your pay after a waiting period, for up to a set duration. Long-term disability replaces part of your pay after an elimination period, for longer illnesses or injuries. Your plan's certificate has the exact percentages and timing.",
    ],
    steps: [
      "Tell your manager and your HR department as soon as you know you'll be out.",
      "File a claim with the disability carrier.",
      "Ask your doctor to complete the medical section.",
      "Stay in touch with your claim manager until you return to work.",
    ],
    docs: ["Disability Certificate", "Disability Claim Form"],
    contact: "Your disability carrier",
    related: [
      "Short-term disability",
      "Long-term disability",
      "Waiting periods",
      "How to file a disability claim",
    ],
    tags: [
      "disability",
      "short-term disability",
      "long-term disability",
      "STD",
      "LTD",
      "can't work",
      "surgery",
      "maternity leave",
      "injury",
    ],
    cta: "File a Disability Claim",
  },
];

/** Every Group Life card id, in its natural order (Account Access first). */
export const GROUP_LIFE_HELP_CARD_ORDER: string[] =
  GROUP_LIFE_HELP_CARDS.map((card) => card.id);

/** The shared fallback set, used until a category has its own catalog. */
export const HELP_CARD_CATALOG: HelpCardContent[] = [
  {
    id: ACCOUNT_ACCESS_CARD_ID,
    title: "[Benefit Category] Account Access",
    paragraphs: [
      "View your balances, plan documents, and investment details in one place.",
      "Take charge of your account and stay on top of your progress anytime.",
    ],
    cta: "",
  },
  {
    id: "rollovers-distributions",
    title: "Rollovers & Distributions",
    body: "Changing jobs? Compare your 4 options side by side.",
    introBold: "Transitioning to a new employer?",
    paragraphs: [
      "Understand your options for managing the savings you have already built. The decision you make now can have a lasting impact on your retirement lifestyle.",
    ],
    cta: "",
  },
  {
    id: "beneficiaries",
    title: "Update My Beneficiaries",
    body: "Update your 401(k) and life insurance beneficiaries in one place.",
    paragraphs: [
      "Keep your beneficiary designations current so your benefits go to the people you intend.",
    ],
    cta: "",
  },
  {
    id: "financial-planning",
    title: "Financial Planning",
    body: "Exclusive benefits for [Company Name] plan participants.",
    paragraphs: [
      "Exclusive benefits for [Company Name] plan participants.",
      "Elevate your financial journey with personalized planning through [Advisor Name], integrated with your benefits.",
    ],
    cta: "",
  },
  {
    id: "social-security",
    title: "When to Claim Social Security",
    body: "See how your claiming age changes your monthly benefit.",
    paragraphs: [
      "See how your claiming age changes your monthly benefit, and what to weigh before you file.",
    ],
    cta: "",
  },
  {
    id: "medicare",
    title: "Turning 65: Medicare",
    body: "How Medicare works with your employer coverage, and when to enroll.",
    paragraphs: [
      "Understand how Medicare works with your employer coverage and when to enroll so there are no gaps or penalties.",
    ],
    cta: "",
  },
  {
    id: "savings",
    title: "How Much Should I Save?",
    body: "See how your contribution rate shapes your retirement income.",
    paragraphs: [
      "Find out how your contribution rate today shapes your income in retirement — and how to close the gap.",
    ],
    cta: "",
  },
];

/** Every id in the fallback catalog, in its natural order. */
export const HELP_CARD_ORDER: string[] = HELP_CARD_CATALOG.map(
  (card) => card.id,
);

/** The catalog for a benefit category. */
export function helpCardCatalogFor(category?: string | null): HelpCardContent[] {
  if (isRetirementHelpCategory(category)) return RETIREMENT_HELP_CARDS;
  if (isGroupHealthHelpCategory(category)) return GROUP_HEALTH_HELP_CARDS;
  if (isGroupLifeHelpCategory(category)) return GROUP_LIFE_HELP_CARDS;
  return HELP_CARD_CATALOG;
}

/** The static copy for a card id, or undefined when the id is unknown. */
export function getHelpCardContent(
  id: string,
  catalog: HelpCardContent[] = HELP_CARD_CATALOG,
): HelpCardContent | undefined {
  return catalog.find((card) => card.id === id);
}

/** Merge token in the catalog copy, replaced by the benefit category. */
export const BENEFIT_CATEGORY_TOKEN = "[Benefit Category]";

/**
 * Replace the `[Benefit Category]` token. With no category known the token is
 * removed (and the leftover spacing tidied) so nobody ever sees a placeholder —
 * neither a participant on the live hub nor the advisor in the Editing Panel.
 */
export function fillHelpCardTokens(
  text: string,
  category?: string | null,
): string {
  if (!text || !text.includes(BENEFIT_CATEGORY_TOKEN)) return text;
  const label = (category || "").trim();
  if (label) return text.split(BENEFIT_CATEGORY_TOKEN).join(label);
  return text
    .split(BENEFIT_CATEGORY_TOKEN)
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The value to put in `[Benefit Category]` for the benefit being created/edited.
 *
 * That is the category itself ("Retirement", "Group Health", …) and, for the
 * Custom hub, the advisor's own name for the benefit (`displayCategoryName`
 * falls back to "Custom" while there is no name yet). The Editing Panel, the
 * Portal Preview and the live Custom hub therefore read the same label.
 */
export function helpCardCategoryLabel(
  category?: string | null,
  benefitTitle?: string | null,
): string | undefined {
  const label = displayCategoryName(category, benefitTitle).trim();
  return label || undefined;
}
