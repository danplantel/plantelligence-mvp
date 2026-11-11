import type {
  TopicBodyBlock,
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
  /**
   * The card line for a Featured topic. A Quick Answer has no card line — its
   * question is the whole visible label.
   */
  summary?: string;
  /**
   * The answer blocks the topic panel renders (the handoff's Quick Answer,
   * Steps, Docs / Video / Contact). Empty blocks are omitted, so a topic only
   * carries what it actually has.
   */
  bodyBlocks?: TopicBodyBlock[];
  /** Every location this topic belongs to by default. */
  defaultLocations: TopicLocation[];
  /**
   * Where a plan places it on first seed.
   *
   * `hidden` is for a topic the content handoff gates behind a plan setting that
   * Create Benefits does not store yet (Retirement's Employer Match & Vesting
   * shows only when the plan has a match): the topic is seeded and placed, so the
   * advisor can switch it on, but participants do not see it by default.
   */
  displayByDefault: TopicDisplayMode;
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
//
// The content handoff's Retirement page: six Featured topics and 42 Quick
// Answers in six groups. Account Access is not here — it is a help CARD
// (`lib/help-card-defaults.ts`), not a topic, and does not count toward the six.
//
// The handoff marks per-plan fields as `{{token}}` and per-plan switches as
// `[If ...]`. Those plan values and yes/no fields do not exist yet (see the
// handoff's "Before launch" list), so the copy below is written in neutral
// language and every conditional topic is seeded unconditionally for now.

const RETIREMENT: TopicLocation[] = ["retirement"];

/** The topic's Quick Answer — the 2–3 sentences shown first in an answer. */
function qa(text: string): TopicBodyBlock {
  return { type: "quick_answer", text };
}

/** A numbered how-to, shown after the Quick Answer. */
function numbered(...items: string[]): TopicBodyBlock {
  return { type: "steps", steps: items };
}

const RETIREMENT_TOPICS: LibraryTopicSeed[] = [
  // ── Featured 1–6, in card order ──
  featured(
    "enroll-change-contributions",
    "Enroll / Change My Contributions",
    RETIREMENT,
    {
      summary: "Enroll in your plan or adjust how much you're saving.",
      bodyBlocks: [
        qa(
          "Once you're eligible, you can enroll or change how much you save at any time through your plan's recordkeeper. A common starting point is at least enough to get the full employer match.",
        ),
        numbered(
          "Log in to your recordkeeper account.",
          "Go to Contributions or Deferral Rate.",
          "Choose a percentage of pay. If your plan allows Roth, you can split it between pre-tax and Roth.",
          "Pick your investments, or keep the default.",
          "Name or confirm your beneficiary, then save.",
        ),
      ],
      cta: {
        label: "Enroll or Change My Contribution",
        actionType: "external_url",
      },
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
    },
  ),
  featured("employer-match-vesting", "Employer Match & Vesting", RETIREMENT, {
    // "Match = Yes" gate — hidden until the plan setting exists (see the type).
    displayByDefault: "hidden",
    summary:
      "Understand what your employer contributes and when it's yours to keep.",
    bodyBlocks: [
      qa(
        "Your employer matches a formula set by your plan. Your own contributions are always 100% yours. Employer contributions become yours over time on your plan's vesting schedule.",
      ),
      numbered(
        "Log in to your recordkeeper account.",
        "Confirm you're contributing at least the rate your plan requires to get the full match.",
        "Check your vested balance on your account summary.",
      ),
    ],
    cta: { label: "Check My Match", actionType: "external_url" },
    tags: [
      "match",
      "employer contribution",
      "free money",
      "vesting",
      "vested",
      "profit sharing",
    ],
  }),
  featured("manage-investments", "Manage My Investments", RETIREMENT, {
    summary: "Review your investment options or get help making decisions.",
    bodyBlocks: [
      qa(
        "You choose how your account is invested from the plan's fund lineup. If you never made a choice, your money is in the plan's default fund. You can change your investments online at any time.",
      ),
      numbered(
        "Log in to your recordkeeper account.",
        "Go to Investments.",
        "Choose to change future contributions, move your existing balance, or both.",
        "Review your choices and confirm.",
      ),
    ],
    cta: { label: "Get Investment Help", actionType: "external_url" },
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
  }),
  featured("beneficiaries", "Update My Beneficiary", RETIREMENT, {
    summary: "Make sure your account goes to the people you choose.",
    bodyBlocks: [
      qa(
        "Your beneficiary designation decides who receives your account, even if your will says otherwise. If you're married, your spouse is usually your beneficiary unless they give written consent to name someone else. Review it after any marriage, divorce, birth, adoption, or death in the family.",
      ),
      numbered(
        "Log in to your recordkeeper account.",
        "Go to Beneficiaries.",
        "Add primary and contingent beneficiaries, with percentages.",
        "Save. If your spouse is not the primary beneficiary, submit the spousal consent form to HR.",
      ),
    ],
    isActionHub: true,
    tags: [
      "beneficiary",
      "who gets my money",
      "spouse",
      "contingent",
      "married",
      "divorced",
      "new baby",
    ],
  }),
  featured("leaving-retiring", "Leaving or Retiring", RETIREMENT, {
    summary:
      "Explore your options when leaving the company or preparing for retirement.",
    bodyBlocks: [
      qa(
        "Your vested balance stays yours when you leave. You can usually keep it in the plan, roll it to an IRA or a new employer's plan, or cash it out. Cashing out carries tax costs, so review your options before you decide.",
      ),
      numbered(
        "Check your vested balance.",
        "Compare your options in the Quick Answers below.",
        "Talk with your advisor before you choose.",
        "Request your rollover or distribution through your recordkeeper.",
      ),
    ],
    cta: { label: "Talk Through My Options", actionType: "external_url" },
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
  }),
  featured("financial-planning", "Financial Planning", RETIREMENT, {
    summary: "Get help building a financial plan around your goals.",
    bodyBlocks: [
      qa(
        "Your advisor works with employees of your plan sponsor on retirement goals, savings, and the bigger financial picture. Financial planning may be included at no additional cost as part of your benefits. You can meet one-on-one or join an upcoming session.",
      ),
      numbered(
        "Book a time that works for you.",
        "Have your latest account statement handy.",
        "Jot down your goals and questions.",
      ),
    ],
    cta: { label: "Book a Meeting", actionType: "external_url" },
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
  }),

  // ── Quick Answers: Saving & Contributions ──
  answer(
    "how-much-should-i-save",
    "How much should I be saving?",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "Many experts suggest saving 10% to 15% of pay, including your employer match. If that isn't possible yet, start where you can and increase by 1% each year.",
        ),
      ],
      cta: {
        label: "Book a Meeting",
        actionType: "external_url",
        target: "advisor",
      },
      tags: ["how much", "save", "percent", "enough", "on track"],
    },
  ),
  answer(
    "change-contribution-rate",
    "How do I change my contribution rate?",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "Log in, go to Contributions or Deferral Rate, and enter your new percentage. Changes usually take effect within one to two pay periods.",
        ),
        numbered(
          "Log in at {{recordkeeper_url}}.",
          "Select Contributions or Deferral Rate.",
          "Enter your new percentage and save.",
        ),
      ],
      cta: {
        label: "Change My Contribution",
        actionType: "external_url",
        target: "recordkeeper",
      },
      tags: [
        "change",
        "increase",
        "decrease",
        "stop",
        "contribution",
        "deferral",
      ],
    },
  ),
  answer("roth-vs-pre-tax", "Roth vs. Pre-Tax", RETIREMENT, "Saving & Contributions", {
    summary: "Choose when you'd rather pay taxes on your savings.",
    bodyBlocks: [
      qa(
        "Pre-tax contributions lower your taxable income now, and you pay tax when you withdraw in retirement. Roth contributions are taxed now, and qualified withdrawals, including earnings, are tax-free. Which fits better depends on whether you expect your tax rate to be higher now or in retirement, and you can split between both.",
      ),
      { type: "video", videoId: "Roth vs. Pre-Tax" },
    ],
    cta: {
      label: "Talk to an Advisor",
      actionType: "external_url",
      target: "advisor",
    },
    tags: ["Roth", "pre-tax", "traditional", "taxes", "after-tax"],
  }),
  answer("contribution-limits", "Contribution limits", RETIREMENT, "Saving & Contributions", {
    bodyBlocks: [
      qa(
        "Each year the IRS sets the most you can contribute from your paycheck. The limit covers pre-tax and Roth contributions combined, and employer contributions don't count toward it.",
      ),
    ],
    tags: [
      "limit",
      "maximum",
      "max out",
      "IRS limit",
      "how much can I contribute",
    ],
  }),
  answer(
    "catch-up-contributions",
    "Catch-up contributions",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "If you're 50 or older, you can contribute an extra amount each year above the standard limit. If you're 60 to 63, a higher catch-up may apply. Under current rules, if your prior-year wages here were above the threshold, catch-up contributions must be made as Roth.",
        ),
      ],
      tags: [
        "catch-up",
        "over 50",
        "age 60",
        "extra contribution",
        "high earner",
      ],
    },
  ),
  answer("auto-escalation", "Auto-escalation", RETIREMENT, "Saving & Contributions", {
    bodyBlocks: [
      qa(
        "Your plan can raise your contribution a little each year, up to a cap. It's an easy way to save more without having to think about it. You can turn it on or off when you log in.",
      ),
    ],
    cta: { label: "Manage Auto-Increase", actionType: "external_url" },
    tags: [
      "automatic increase",
      "auto-escalation",
      "auto-increase",
      "step up",
    ],
  }),
  answer(
    "how-does-employer-match-work",
    "How does the employer match work?",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "Your employer matches a formula set by your plan, and the match is deposited on the schedule your plan uses. The plan document shows the exact formula and timing.",
        ),
      ],
      tags: ["match", "employer contribution", "free money", "how match works"],
    },
  ),
  answer(
    "am-i-receiving-full-match",
    "Am I receiving the full match?",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "You receive the full match when you contribute at least the rate your plan requires. Log in to check your current rate, and raise it if it's below that level.",
        ),
      ],
      cta: { label: "Check My Rate", actionType: "external_url" },
      tags: ["full match", "missing match", "maximize match"],
    },
  ),
  answer(
    "planning-tool",
    "Is there a tool to see my whole financial picture?",
    RETIREMENT,
    "Saving & Contributions",
    {
      bodyBlocks: [
        qa(
          "Your plan may offer a free planning tool for participants. It brings your accounts, goals, and budget into one view so you can plan at your own pace.",
        ),
      ],
      cta: { label: "Register or Log In", actionType: "external_url" },
      tags: ["planning tool", "budget", "financial picture", "MyBlocks", "goals"],
    },
  ),

  // ── Quick Answers: Employer Contributions & Vesting ──
  answer(
    "what-does-vested-mean",
    "What does vested mean?",
    RETIREMENT,
    "Employer Contributions & Vesting",
    {
      bodyBlocks: [
        qa(
          "Vested money is yours to keep, even if you leave the company. Your own contributions are always 100% vested. Employer contributions vest over time.",
        ),
      ],
      tags: ["vested", "vesting", "ownership", "keep", "mine"],
    },
  ),
  answer(
    "vesting-schedule",
    "What is my vesting schedule?",
    RETIREMENT,
    "Employer Contributions & Vesting",
    {
      bodyBlocks: [
        qa(
          "Employer contributions in your plan vest on a schedule set by the plan, and years of service are counted using the plan's own rule. The Summary Plan Description has the exact schedule.",
        ),
      ],
      tags: ["vesting schedule", "years of service", "cliff", "graded"],
    },
  ),
  answer(
    "view-vested-balance",
    "How do I view my vested balance?",
    RETIREMENT,
    "Employer Contributions & Vesting",
    {
      bodyBlocks: [
        qa(
          "Log in to your account. Your summary shows both your total balance and your vested balance.",
        ),
      ],
      cta: { label: "View My Balance", actionType: "external_url" },
      tags: ["vested balance", "how much is mine"],
    },
  ),
  answer(
    "unvested-money-if-i-leave",
    "What happens to unvested money if I leave?",
    RETIREMENT,
    "Employer Contributions & Vesting",
    {
      bodyBlocks: [
        qa(
          "Employer money that isn't vested is forfeited when you leave and returns to the plan. Your vested balance stays yours.",
        ),
      ],
      tags: ["unvested", "forfeit", "lose money", "leaving"],
    },
  ),

  // ── Quick Answers: Investments ──
  answer("investment-options", "Understanding investment options", RETIREMENT, "Investments", {
    bodyBlocks: [
      qa(
        "Your plan offers a lineup of funds, typically a mix of stock, bond, and stable value options, plus target-date funds. Fund fact sheets explain each fund's strategy, risk, and costs.",
      ),
    ],
    tags: [
      "fund options",
      "lineup",
      "investment choices",
      "what can I invest in",
    ],
  }),
  answer("target-date-funds", "What is a target-date fund?", RETIREMENT, "Investments", {
    bodyBlocks: [
      qa(
        "It's a single fund built around the year you expect to retire. It holds a mix of stocks and bonds and becomes more conservative as that year gets closer. Most people choose the fund closest to their expected retirement year.",
      ),
    ],
    tags: ["target date", "lifecycle", "2050 fund", "one fund"],
  }),
  answer(
    "where-is-my-money-invested",
    "Where is my money currently invested?",
    RETIREMENT,
    "Investments",
    {
      bodyBlocks: [
        qa(
          "Log in to see your current investments. If you never made a choice, your money is in the plan's default fund.",
        ),
      ],
      cta: { label: "View My Investments", actionType: "external_url" },
      tags: ["current investments", "default fund", "where is my money"],
    },
  ),
  answer("how-do-i-change-investments", "How do I change investments?", RETIREMENT, "Investments", {
    bodyBlocks: [
      qa(
        "You can change where future contributions go, move your existing balance, or both.",
      ),
      numbered(
        "Log in to your recordkeeper account.",
        "Go to Investments.",
        "Choose future contributions, existing balance, or both.",
        "Review and confirm.",
      ),
    ],
    cta: { label: "Change My Investments", actionType: "external_url" },
    tags: [
      "change investments",
      "reallocate",
      "rebalance",
      "transfer funds",
    ],
  }),
  answer("investment-performance", "Investment performance", RETIREMENT, "Investments", {
    bodyBlocks: [
      qa(
        "Your personal rate of return is shown when you log in. Each fund's performance history is on its fact sheet. Past performance doesn't guarantee future results.",
      ),
    ],
    tags: ["performance", "returns", "how am I doing", "gains", "losses"],
  }),
  answer("fees-and-expenses", "Fees and expenses", RETIREMENT, "Investments", {
    bodyBlocks: [
      qa(
        "Each fund has an expense ratio, and the plan may have administrative fees. The Participant Fee Disclosure lists every fee and how it's charged. Fees also appear on your quarterly statement.",
      ),
    ],
    tags: ["fees", "expense ratio", "costs", "charges"],
  }),
  answer(
    "review-investments-outside-plan",
    "Review investments outside of the plan",
    RETIREMENT,
    "Investments",
    {
      bodyBlocks: [
        qa(
          "Your advisor can review your IRAs, old 401(k)s, and other accounts alongside this plan so they work together.",
        ),
      ],
      cta: { label: "Book a Review", actionType: "external_url" },
      tags: [
        "IRA",
        "outside accounts",
        "other investments",
        "portfolio review",
        "second opinion",
      ],
    },
  ),
  answer(
    "paying-for-education",
    "How will I pay for my child's education?",
    RETIREMENT,
    "Investments",
    {
      bodyBlocks: [
        qa(
          "A 529 college savings plan lets your savings grow tax-free when used for qualified education costs, such as college or vocational school. Plans vary by state, and some states offer a tax deduction for contributions. Your advisor can help you compare options.",
        ),
      ],
      cta: { label: "Book a Meeting", actionType: "external_url" },
      tags: [
        "529",
        "college savings",
        "education",
        "tuition",
        "kids",
        "vocational school",
      ],
    },
  ),

  // ── Quick Answers: Loans & Withdrawals ──
  answer("401k-loans", "Can I take a loan?", RETIREMENT, "Loans & Withdrawals", {
    bodyBlocks: [
      qa(
        "If your plan allows loans, you can generally borrow up to 50% of your vested balance, up to $50,000. Your plan sets how many loans you can have at a time and whether there is a setup fee.",
      ),
      numbered(
        "Log in to your recordkeeper account.",
        "Review your available loan amount.",
        "Select a loan type.",
        "Review the repayment terms.",
        "Submit your request.",
      ),
    ],
    cta: { label: "Request a Loan", actionType: "external_url" },
    tags: ["loan", "borrow", "how much can I borrow"],
  }),
  answer("loan-repayment", "How is a loan repaid?", RETIREMENT, "Loans & Withdrawals", {
    bodyBlocks: [
      qa(
        "You repay through payroll deductions, and the interest goes back into your own account. General loans are repaid within 5 years. Loans used to buy a primary home may allow longer.",
      ),
    ],
    tags: ["repay", "repayment", "payroll deduction", "interest", "payoff"],
  }),
  answer(
    "loan-if-i-leave",
    "What happens to my loan if I leave?",
    RETIREMENT,
    "Loans & Withdrawals",
    {
      bodyBlocks: [
        qa(
          "Any unpaid balance usually must be repaid soon after you leave. If it isn't, it's treated as a withdrawal and becomes taxable income. You may also owe a 10% penalty if you're under 59½.",
        ),
      ],
      cta: { label: "Talk to an Advisor", actionType: "external_url" },
      tags: ["loan leaving", "default", "outstanding loan", "quit with loan"],
    },
  ),
  answer(
    "hardship-withdrawals",
    "What is a hardship withdrawal?",
    RETIREMENT,
    "Loans & Withdrawals",
    {
      bodyBlocks: [
        qa(
          "It's a withdrawal for an immediate, serious financial need. Examples include medical bills, buying your primary home, tuition, preventing eviction or foreclosure, funeral costs, and certain home repairs. It's taxed, usually carries a 10% penalty if you're under 59½, and can't be paid back.",
        ),
      ],
      cta: { label: "Request a Withdrawal", actionType: "external_url" },
      tags: ["hardship", "emergency", "eviction", "medical bills", "tuition"],
    },
  ),
  answer(
    "early-withdrawal-penalties",
    "Early withdrawal penalties",
    RETIREMENT,
    "Loans & Withdrawals",
    {
      bodyBlocks: [
        qa(
          "Money taken out before age 59½ is generally taxed as income, plus a 10% penalty. Some exceptions apply, such as leaving the company in or after the year you turn 55. Talk with your advisor before withdrawing.",
        ),
      ],
      cta: { label: "Talk to an Advisor", actionType: "external_url" },
      tags: ["penalty", "10%", "early withdrawal", "taxes", "59 1/2"],
    },
  ),
  answer(
    "in-service-withdrawals",
    "In-service withdrawals",
    RETIREMENT,
    "Loans & Withdrawals",
    {
      bodyBlocks: [
        qa(
          "If your plan allows in-service withdrawals, you can withdraw from your account while you're still working here after the plan's stated age. Withdrawals are taxable, and rolling them to an IRA may avoid immediate taxes.",
        ),
      ],
      cta: { label: "Talk to an Advisor", actionType: "external_url" },
      tags: ["in-service", "withdraw while working", "age 59 1/2"],
    },
  ),

  // ── Quick Answers: Leaving / Retirement ──
  answer(
    "what-happens-if-i-leave",
    "What happens to my account if I leave?",
    RETIREMENT,
    "Leaving / Retirement",
    {
      bodyBlocks: [
        qa(
          "Your vested balance stays yours. You can usually leave it in the plan, roll it to an IRA, roll it to a new employer's plan, or cash it out. Small balances may be paid out or moved to an IRA automatically, so act early to choose where your money goes.",
        ),
      ],
      cta: { label: "Talk Through My Options", actionType: "external_url" },
      tags: [
        "leaving",
        "quit",
        "fired",
        "laid off",
        "new job",
        "what happens to my 401k",
      ],
    },
  ),
  answer("roll-over-to-ira", "Roll over to an IRA", RETIREMENT, "Leaving / Retirement", {
    bodyBlocks: [
      qa(
        "A direct rollover moves your money into an IRA without taxes or penalties. An IRA can offer more investment choices and keeps your savings in one place you control.",
      ),
      numbered(
        "Open an IRA, or confirm the one you already have.",
        "Contact your recordkeeper and request a direct rollover.",
        "The funds are sent straight to your IRA, so nothing is withheld for taxes.",
      ),
    ],
    cta: { label: "Get Rollover Help", actionType: "external_url" },
    tags: ["rollover", "IRA", "roll over", "transfer", "move my 401k"],
  }),
  answer(
    "roll-over-to-new-employer-plan",
    "Roll over to another employer plan",
    RETIREMENT,
    "Leaving / Retirement",
    {
      bodyBlocks: [
        qa(
          "If your new employer's plan accepts rollovers, you can move your balance there with a direct rollover. Check the new plan's investment options and fees first.",
        ),
      ],
      cta: { label: "Talk Through My Options", actionType: "external_url" },
      tags: ["new employer", "new 401k", "roll over to new job"],
    },
  ),
  answer("cashing-out", "Cashing out", RETIREMENT, "Leaving / Retirement", {
    bodyBlocks: [
      qa(
        "Cash-outs are taxed as income, and 20% is withheld for federal taxes. If you're under 59½, you may also owe a 10% penalty. There's no penalty if you leave the company in or after the year you turn 55.",
      ),
    ],
    cta: { label: "Talk to an Advisor First", actionType: "external_url" },
    tags: [
      "cash out",
      "lump sum",
      "withdraw everything",
      "taxes on cash out",
    ],
  }),
  answer(
    "consolidate-old-accounts",
    "Consolidating previous employer accounts",
    RETIREMENT,
    "Leaving / Retirement",
    {
      summary: "Bring old 401(k)s and IRAs together in one place.",
      bodyBlocks: [
        qa(
          "Many plans accept rollovers from previous employer accounts. One account means one login, one statement, and a simpler strategy. Compare fees and investment options before you move.",
        ),
        numbered(
          "Ask your old provider for a direct rollover, payable to your current recordkeeper for your benefit.",
          "Complete your plan's incoming rollover form.",
          "Send both to your recordkeeper.",
        ),
      ],
      cta: { label: "Get Help Consolidating", actionType: "external_url" },
      tags: [
        "consolidate",
        "old 401k",
        "roll in",
        "combine accounts",
        "lost account",
      ],
    },
  ),
  answer(
    "required-minimum-distributions",
    "Required Minimum Distributions",
    RETIREMENT,
    "Leaving / Retirement",
    {
      bodyBlocks: [
        qa(
          "Required withdrawals generally begin at age 73, or age 75 if you were born in 1960 or later. If you're still working here and own less than 5% of the company, you can usually wait until you retire.",
        ),
      ],
      cta: { label: "Talk to an Advisor", actionType: "external_url" },
      tags: ["RMD", "required distribution", "age 73", "must withdraw"],
    },
  ),
  answer("social-security", "Social Security", RETIREMENT, "Leaving / Retirement", {
    bodyBlocks: [
      qa(
        "Full retirement age is 67 for anyone born in 1960 or later. You can claim as early as 62, with a permanently reduced benefit. You can see your personal estimate at ssa.gov/myaccount.",
      ),
    ],
    cta: { label: "Plan My Retirement Income", actionType: "external_url" },
    tags: [
      "Social Security",
      "full retirement age",
      "when to claim",
      "benefits estimate",
    ],
  }),
  answer("approaching-retirement", "Approaching retirement", RETIREMENT, "Leaving / Retirement", {
    summary: "Get ready for the years just before you retire.",
    bodyBlocks: [
      qa(
        "In the five years before retirement, review how your savings, Social Security, and health coverage will work together. Key steps include estimating your income, reviewing your investment mix, checking your Medicare timing at 65, and updating your beneficiaries.",
      ),
    ],
    cta: { label: "Book a Retirement Review", actionType: "external_url" },
    tags: [
      "retiring soon",
      "near retirement",
      "retirement checklist",
      "income plan",
    ],
  }),
  answer(
    "leave-money-in-old-plan",
    "Leave the money in your old plan",
    RETIREMENT,
    "Leaving / Retirement",
    {
      bodyBlocks: [
        qa(
          "If your vested balance is above your plan's small-balance threshold, you can usually leave it in the plan after you leave. It keeps growing tax-deferred, but you can't add new contributions, and you'll need to keep your address current. Some plans limit withdrawal options for former employees.",
        ),
      ],
      cta: { label: "Talk Through My Options", actionType: "external_url" },
      tags: [
        "leave money in plan",
        "keep 401k",
        "do nothing",
        "old employer plan",
      ],
    },
  ),

  // ── Quick Answers: Account & Administration ──
  answer("cant-log-in", "I can't log in to my account", RETIREMENT, "Account & Administration", {
    bodyBlocks: [
      qa(
        "Use the \"Forgot username or password\" link on your recordkeeper's login page. If you're locked out, call your recordkeeper. For your security, your employer and your advisor can't reset your login.",
      ),
    ],
    cta: { label: "Go to Login", actionType: "external_url" },
    tags: ["login", "password", "locked out", "forgot username", "register"],
  }),
  answer(
    "update-my-beneficiary",
    "Update my beneficiary",
    RETIREMENT,
    "Account & Administration",
    {
      bodyBlocks: [
        qa(
          "Log in and go to Beneficiaries to add each person's name, relationship, and percentage. If you're married, your spouse is usually your beneficiary unless they give notarized written consent to name someone else. Also name a contingent beneficiary, and review your choices after marriage, divorce, birth, adoption, or a death in the family.",
        ),
        numbered(
          "Log in to your recordkeeper account.",
          "Go to Beneficiaries.",
          "Add primary and contingent beneficiaries with percentages.",
          "Save. If your spouse is not the primary beneficiary, submit the spousal consent form to HR.",
        ),
      ],
      cta: { label: "Update My Beneficiary", actionType: "external_url" },
      tags: [
        "beneficiary",
        "who gets my money",
        "spouse",
        "contingent",
        "married",
        "divorced",
      ],
    },
  ),
  answer("statements", "Statements", RETIREMENT, "Account & Administration", {
    bodyBlocks: [
      qa(
        "Quarterly statements are available in the Statements section after you log in. You can choose online or paper delivery in your account settings.",
      ),
    ],
    cta: { label: "View Statements", actionType: "external_url" },
    tags: [
      "statement",
      "quarterly statement",
      "balance history",
      "paper statement",
    ],
  }),
  answer("tax-forms", "Tax forms", RETIREMENT, "Account & Administration", {
    bodyBlocks: [
      qa(
        "If you took a withdrawal, loan default, or rollover last year, your recordkeeper sends Form 1099-R by January 31. Your contributions appear on your W-2 from your employer. You don't need a tax form for regular contributions alone.",
      ),
    ],
    tags: ["1099-R", "tax form", "W-2", "taxes", "tax document"],
  }),
  answer("plan-materials", "Plan materials", RETIREMENT, "Account & Administration", {
    bodyBlocks: [
      qa(
        "Your plan's guides, notices, and forms are in the Retirement section of Plan Documents. Key documents include the Summary Plan Description, fee disclosure, and fund fact sheets.",
      ),
    ],
    cta: { label: "View Plan Documents", actionType: "external_url" },
    tags: [
      "SPD",
      "plan document",
      "summary plan description",
      "notices",
      "forms",
    ],
  }),
  answer("who-do-i-contact", "Who do I contact?", RETIREMENT, "Account & Administration", {
    bodyBlocks: [
      qa(
        "Account access, balances, and transactions go to your recordkeeper. Eligibility, payroll, and beneficiary consent go to HR. Investment, rollover, and planning questions go to your advisor.",
      ),
    ],
    cta: { label: "Contact Us", actionType: "external_url" },
    tags: ["contact", "phone number", "help", "who to call", "support"],
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
    "Saving & Contributions",
    "Employer Contributions & Vesting",
    "Investments",
    "Loans & Withdrawals",
    "Leaving / Retirement",
    "Account & Administration",
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
