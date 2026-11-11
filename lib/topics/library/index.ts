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
        "For {{plan_year}}, you can contribute up to {{deferral_limit}} from your paycheck. This limit covers pre-tax and Roth contributions combined. Employer contributions don't count toward it.",
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
    cta: {
      label: "Plan My Retirement Income",
      actionType: "external_url",
      // The label has no "book / advisor / talk" word for the renderer's fallback
      // to catch, so the destination must be named: {{advisor_booking_url}}.
      target: "advisor",
    },
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
//
// The content handoff's Group Health page: five Featured topics and 41 Quick
// Answers in seven groups. As with Retirement, per-plan values that Create
// Benefits does not store yet (`{{deductible}}`, `{{qle_window}}`,
// `{{carrier_phone}}`, …) are written in neutral language; only the values the
// portal can actually resolve stay as tokens — the carrier member site
// (`{{recordkeeper_url}}`), the carrier (`{{recordkeeper_name}}`), the advisor
// (`{{advisor_name}}`) and the plan sponsor (`{{plan_sponsor_name}}`).
//
// Topic slugs `understand-coverage`, `find-care-providers`, `add-remove-dependent`,
// `hsa-fsa-resources`, `open-enrollment` and `hsa-vs-fsa` are also addressed by
// `lib/life-events/templates.ts`; they are kept so those deep links still land.

const GROUP_HEALTH: TopicLocation[] = ["group_health"];

/** CTA that signs in to the carrier's member portal. */
function memberPortal(label: string): TopicCta {
  return { label, actionType: "external_url", target: "recordkeeper" };
}

/** CTA handed to the benefits advisor's scheduler. */
function advisorCta(label: string): TopicCta {
  return { label, actionType: "external_url", target: "advisor" };
}

const GROUP_HEALTH_TOPICS: LibraryTopicSeed[] = [
  // Featured 1.
  featured("understand-coverage", "Understand My Coverage", GROUP_HEALTH, {
    summary: "See what's covered and understand how your health plan works.",
    bodyBlocks: [
      qa(
        "You're covered through {{recordkeeper_name}}. Your Summary of Benefits and Coverage shows your deductible, copays, coinsurance, and out-of-pocket maximum side by side.",
      ),
      numbered(
        "Log in at {{recordkeeper_url}}.",
        "Open your plan details or digital ID card.",
        "Review the Summary of Benefits and Coverage for your costs.",
      ),
    ],
    tags: [
      "coverage",
      "what's covered",
      "health plan",
      "medical plan",
      "benefits",
      "ID card",
    ],
    cta: memberPortal("View My Coverage"),
  }),

  // Featured 2.
  featured("find-care-providers", "Find Care", GROUP_HEALTH, {
    summary: "Find doctors, specialists, urgent care, and other in-network providers.",
    bodyBlocks: [
      qa(
        "Staying in network keeps your costs lowest. Use {{recordkeeper_name}}'s provider search to find doctors, specialists, hospitals, and urgent care near you. For quick visits, your plan may also offer care by phone or video.",
      ),
      numbered(
        "Open Find Care on {{recordkeeper_url}}.",
        "Select your plan's network.",
        "Search by specialty, name, or location.",
        "Call the office to confirm they're in network before your visit.",
      ),
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
    cta: memberPortal("Find a Doctor"),
  }),

  // Featured 3.
  featured("claims-bills-costs", "Claims, Bills & Costs", GROUP_HEALTH, {
    summary:
      "Get help understanding claims, bills, deductibles, and out-of-pocket costs.",
    bodyBlocks: [
      qa(
        "After a visit, {{recordkeeper_name}} sends an Explanation of Benefits (EOB) showing what the plan paid and what you may owe. Compare your bill to the EOB before you pay. If they don't match, call the provider's billing office or {{recordkeeper_name}}.",
      ),
      numbered(
        "Log in at {{recordkeeper_url}}.",
        "Open Claims to see each EOB.",
        "Match the amount you may owe to your bill.",
        "Call the carrier if something doesn't match.",
      ),
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
    cta: memberPortal("View My Claims"),
  }),

  // Featured 4 — the Dependent Action Hub is the handoff's CTA; until that panel
  // exists the button hands the reader to the plan's HR contact card.
  featured("add-remove-dependent", "Add or Remove a Dependent", GROUP_HEALTH, {
    summary:
      "Make coverage changes after marriage, birth, divorce, or another qualifying event.",
    bodyBlocks: [
      qa(
        "Outside Open Enrollment, you can change coverage only after a qualifying life event, such as marriage, birth, adoption, divorce, or losing other coverage. You must request the change within your plan's change window after the event.",
      ),
      numbered(
        "Gather proof of the event, such as a marriage or birth certificate.",
        "Log in at {{recordkeeper_url}} or contact your HR department.",
        "Add or remove the dependent and upload your documents.",
        "Confirm the change and your new payroll deduction.",
      ),
    ],
    isActionHub: true,
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
    cta: { label: "Make a Coverage Change", actionType: "external_url", target: "contact" },
  }),

  // Featured 5 — the handoff gates this on HSA = Yes or FSA = Yes. Those plan
  // fields do not exist yet and the card is part of the designed five, so it is
  // seeded as a normal Featured card and the advisor can take it off the page.
  featured("hsa-fsa-resources", "HSA / FSA", GROUP_HEALTH, {
    summary:
      "Learn how a Health Savings Account (HSA) or a Flexible Spending Account (FSA) works.",
    bodyBlocks: [
      qa(
        "An HSA (Health Savings Account) lets you save pre-tax money for medical costs while you're enrolled in a high-deductible health plan, and the money is yours to keep, even if you leave. An FSA (Flexible Spending Account) lets you set aside pre-tax money for eligible expenses during the plan year, but most unused funds don't roll over.",
      ),
      numbered(
        "Log in at {{recordkeeper_url}}.",
        "Check your balance and contribution amount.",
        "Pay with your benefits card, or submit a reimbursement with your receipt.",
      ),
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
    cta: memberPortal("Go to My Account"),
  }),

  // ── Quick Answers: Understanding Coverage ──
  answer("what-is-my-deductible", "What is my deductible?", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "Your deductible is the amount you pay for covered care each plan year before the plan starts paying its share. Preventive care is usually covered before you meet it. Your plan's deductible is on your Summary of Benefits and Coverage.",
      ),
    ],
    tags: ["deductible", "how much do I pay first", "meet my deductible"],
  }),
  answer("what-is-a-copay", "What is a copay?", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "A copay is a flat fee you pay for a covered service, such as a set amount for a primary care visit or for a specialist. Your plan's copays are listed on your Summary of Benefits and Coverage.",
      ),
    ],
    tags: ["copay", "office visit cost", "flat fee"],
  }),
  answer("what-is-coinsurance", "What is coinsurance?", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "Coinsurance is your share of the cost, as a percentage, after you meet your deductible. For example, with 20% coinsurance on a $1,000 bill, you pay $200 and the plan pays $800. Your plan's coinsurance is on your Summary of Benefits and Coverage.",
      ),
    ],
    tags: ["coinsurance", "percentage", "80/20", "my share"],
  }),
  answer(
    "out-of-pocket-maximum",
    "What is my out-of-pocket maximum?",
    GROUP_HEALTH,
    "Understanding Coverage",
    {
      bodyBlocks: [
        qa(
          "It's the most you'll pay for covered in-network care in a plan year. After you reach it, the plan pays 100% of covered costs for the rest of the year. Your premiums don't count toward it. Your plan's out-of-pocket maximum is on your Summary of Benefits and Coverage.",
        ),
      ],
      tags: ["out-of-pocket maximum", "OOP max", "most I'll pay", "cap"],
    },
  ),
  answer("preventive-care", "Preventive care", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "In-network preventive care, such as annual checkups, recommended screenings, and most vaccines, is covered at no cost to you. If you discuss a new health problem during the visit, that part may be billed separately.",
      ),
    ],
    tags: ["preventive", "annual physical", "checkup", "screening", "vaccine", "free care"],
  }),
  answer(
    "in-network-vs-out-of-network",
    "In-network vs. out-of-network",
    GROUP_HEALTH,
    "Understanding Coverage",
    {
      bodyBlocks: [
        qa(
          "In-network providers have agreed to lower rates with {{recordkeeper_name}}, so you pay less. Out-of-network care costs more, and usually isn't covered except in emergencies. Out-of-network providers may also bill you for the difference between their charge and what the plan pays.",
        ),
      ],
      tags: ["in network", "out of network", "network", "balance billing"],
      cta: memberPortal("Find a Doctor"),
    },
  ),
  answer("dental-coverage", "Dental coverage", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "Your dental plan covers preventive, basic, and major care at different levels. Cleanings and exams are usually covered at the highest level. See the dental summary for your costs.",
      ),
    ],
    tags: ["dental", "dentist", "cleaning", "teeth", "orthodontics"],
    cta: memberPortal("Go to Dental"),
  }),
  answer("vision-coverage", "Vision coverage", GROUP_HEALTH, "Understanding Coverage", {
    bodyBlocks: [
      qa(
        "Your vision plan covers eye exams and gives you an allowance toward glasses or contacts. See the vision summary for your costs and allowances.",
      ),
    ],
    tags: ["vision", "eye exam", "glasses", "contacts", "optometrist"],
    cta: memberPortal("Go to Vision"),
  }),

  // ── Quick Answers: Getting Care ──
  answer("find-a-doctor", "Find a doctor", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Search {{recordkeeper_name}}'s directory for in-network primary care doctors near you. Your plan may require you to choose a primary care doctor.",
      ),
    ],
    tags: ["find a doctor", "primary care", "PCP", "new doctor"],
    cta: memberPortal("Find a Doctor"),
  }),
  answer("find-a-specialist", "Find a specialist", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Search the provider directory by specialty to find in-network specialists. Some plans require a referral from your primary care doctor before your visit.",
      ),
    ],
    tags: ["specialist", "referral", "dermatologist", "cardiologist", "orthopedic"],
    cta: memberPortal("Find a Specialist"),
  }),
  answer("urgent-care-vs-er", "Urgent care vs. emergency room", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Urgent care is for problems that need quick attention but aren't life-threatening, such as sprains, fevers, or minor cuts, and it costs much less. Go to the ER for chest pain, trouble breathing, severe bleeding, or signs of a stroke. In an emergency, call 911.",
      ),
    ],
    tags: ["urgent care", "emergency room", "ER", "where should I go", "after hours"],
  }),
  answer("telehealth", "Telehealth", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Your plan may offer care by phone or video for common illnesses, prescription refills, and more. Check your plan materials for what's included and what a visit costs.",
      ),
    ],
    tags: ["telehealth", "virtual visit", "video doctor", "online doctor"],
    cta: memberPortal("Start a Virtual Visit"),
  }),
  // A different slug from the Custom hub's "mental-health-resources": slugs are
  // unique across every location, and the Custom starter set owns that one.
  answer("mental-health-care", "Mental health resources", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Your plan covers mental health and substance use care, including therapy and counseling. Your plan may also offer an employee assistance program (EAP) with free, confidential counseling sessions. If you're in crisis, call or text 988 any time.",
      ),
    ],
    tags: [
      "mental health",
      "therapy",
      "counseling",
      "anxiety",
      "depression",
      "EAP",
      "988",
    ],
    cta: memberPortal("Find Mental Health Care"),
  }),
  answer("second-opinions", "Second opinions", GROUP_HEALTH, "Getting Care", {
    bodyBlocks: [
      qa(
        "Many plans cover a second opinion before major surgery or after a serious diagnosis. Your plan may offer an expert-review service at no cost. Call {{recordkeeper_name}} to confirm coverage.",
      ),
    ],
    tags: ["second opinion", "surgery", "diagnosis", "expert review"],
  }),

  // ── Quick Answers: Claims & Billing ──
  answer("understanding-an-eob", "Understanding an EOB", GROUP_HEALTH, "Claims & Billing", {
    bodyBlocks: [
      qa(
        "An Explanation of Benefits (EOB) is not a bill. It shows what the provider charged, the discount from your plan, what the plan paid, and what you may owe. Use it to check the bill you get from your provider.",
      ),
      { type: "video", videoId: "Reading Your EOB" },
    ],
    tags: ["EOB", "explanation of benefits", "is this a bill"],
  }),
  answer("checking-claim-status", "Checking claim status", GROUP_HEALTH, "Claims & Billing", {
    bodyBlocks: [
      qa(
        "Log in to see every claim and where it stands. Providers usually submit claims within a few weeks of your visit.",
      ),
    ],
    tags: ["claim status", "pending claim", "processed"],
    cta: memberPortal("View My Claims"),
  }),
  answer("denied-claims", "Denied claims", GROUP_HEALTH, "Claims & Billing", {
    bodyBlocks: [
      qa(
        "Call {{recordkeeper_name}} to find out why. Denials are often caused by a coding error or missing information that can be fixed. You have the right to appeal, generally within 180 days of the denial. If the internal appeal is denied, you can request an independent external review.",
      ),
    ],
    tags: ["denied", "denial", "appeal", "rejected claim", "not covered"],
  }),
  answer("medical-bill-questions", "Medical bill questions", GROUP_HEALTH, "Claims & Billing", {
    bodyBlocks: [
      qa(
        "Compare the bill to your EOB, and ask the provider for an itemized bill if anything is unclear. Many providers offer payment plans. Federal law protects you from most surprise out-of-network bills for emergency care and for certain care at in-network hospitals.",
      ),
    ],
    tags: ["medical bill", "surprise bill", "itemized bill", "payment plan", "overcharged"],
  }),
  answer("prior-authorization", "Prior authorization", GROUP_HEALTH, "Claims & Billing", {
    bodyBlocks: [
      qa(
        "Some services, such as MRIs, surgeries, and certain treatments, need approval from {{recordkeeper_name}} before you receive them. Your doctor usually requests it. Without it, the claim may be denied.",
      ),
    ],
    tags: ["prior authorization", "pre-approval", "precertification", "MRI", "surgery"],
  }),

  // ── Quick Answers: Prescriptions ──
  answer("prescription-coverage", "Prescription coverage", GROUP_HEALTH, "Prescriptions", {
    bodyBlocks: [
      qa(
        "Your prescription benefits are managed by your plan's pharmacy benefit manager. Medications are grouped into tiers on the plan's drug list, and lower tiers cost less. Check your drug list to see your cost before you fill.",
      ),
    ],
    tags: ["prescription", "drug list", "formulary", "tier", "medication cost"],
    cta: memberPortal("Check My Drug Costs"),
  }),
  answer("pharmacy-network", "Pharmacy network", GROUP_HEALTH, "Prescriptions", {
    bodyBlocks: [
      qa(
        "Fill prescriptions at an in-network pharmacy to pay the lowest cost. Find in-network pharmacies near you through your pharmacy benefit manager's website.",
      ),
    ],
    tags: ["pharmacy", "CVS", "Walgreens", "where to fill"],
    cta: memberPortal("Find a Pharmacy"),
  }),
  answer(
    "generic-vs-brand-medications",
    "Generic vs. brand-name medications",
    GROUP_HEALTH,
    "Prescriptions",
    {
      bodyBlocks: [
        qa(
          "Generic medications have the same active ingredients as brand-name drugs, meet the same FDA standards, and usually cost much less. Ask your doctor or pharmacist whether a generic is available.",
        ),
      ],
      tags: ["generic", "brand name", "cheaper medication", "save on prescriptions"],
    },
  ),
  answer("mail-order-pharmacy", "Mail-order pharmacy", GROUP_HEALTH, "Prescriptions", {
    bodyBlocks: [
      qa(
        "For medications you take regularly, your plan's mail-order pharmacy can deliver a 90-day supply to your home, often at a lower cost.",
      ),
    ],
    tags: ["mail order", "home delivery", "90-day supply", "maintenance medication"],
    cta: memberPortal("Set Up Mail Order"),
  }),
  answer(
    "medication-prior-authorization",
    "Prior authorization for medications",
    GROUP_HEALTH,
    "Prescriptions",
    {
      bodyBlocks: [
        qa(
          "Some medications need approval before the plan will cover them, or require you to try a lower-cost drug first. Your doctor submits the request. If it's denied, you can appeal.",
        ),
      ],
      tags: [
        "prior authorization",
        "step therapy",
        "medication not covered",
        "drug approval",
      ],
    },
  ),

  // ── Quick Answers: Changes to Coverage ──
  answer(
    "qualifying-life-events",
    "Qualifying life events",
    GROUP_HEALTH,
    "Changes to Coverage",
    {
      bodyBlocks: [
        qa(
          "Outside Open Enrollment, you can change your coverage only after a qualifying life event. Examples include marriage, birth or adoption, divorce, a dependent's death, losing other coverage, or moving out of your plan's service area. Request the change within your plan's change window, and make sure the change matches the event.",
        ),
      ],
      tags: [
        "life event",
        "qualifying event",
        "change coverage mid-year",
        "special enrollment",
      ],
      cta: { label: "Make a Coverage Change", actionType: "external_url", target: "contact" },
    },
  ),
  answer("add-a-spouse", "Add a spouse", GROUP_HEALTH, "Changes to Coverage", {
    bodyBlocks: [
      qa(
        "You can add your spouse within your plan's change window of your marriage, or of your spouse losing other coverage. You'll need a copy of your marriage certificate.",
      ),
    ],
    tags: ["add spouse", "got married", "wife", "husband", "marriage"],
    cta: { label: "Add My Spouse", actionType: "external_url", target: "contact" },
  }),
  answer(
    "add-a-newborn-or-adopted-child",
    "Add a newborn or adopted child",
    GROUP_HEALTH,
    "Changes to Coverage",
    {
      bodyBlocks: [
        qa(
          "Coverage can start on the date of birth or adoption if you enroll your child within your plan's newborn window. You'll need a birth certificate or adoption paperwork. This is also a good time to update your beneficiaries and review your life insurance.",
        ),
      ],
      tags: ["baby", "newborn", "birth", "adoption", "add child", "having a baby"],
      cta: { label: "Add My Child", actionType: "external_url", target: "contact" },
    },
  ),
  answer("remove-a-dependent", "Remove a dependent", GROUP_HEALTH, "Changes to Coverage", {
    bodyBlocks: [
      qa(
        "You can remove a dependent after a qualifying event, such as divorce or the dependent gaining other coverage. Removing someone outside a qualifying event usually has to wait until Open Enrollment.",
      ),
    ],
    tags: ["remove dependent", "drop coverage", "take off plan"],
  }),
  answer(
    "divorce-or-legal-separation",
    "Divorce or legal separation",
    GROUP_HEALTH,
    "Changes to Coverage",
    {
      bodyBlocks: [
        qa(
          "Remove your former spouse within your plan's change window of the divorce. Your former spouse may be able to continue coverage through COBRA if the plan is notified within 60 days. Remember to update your retirement and life insurance beneficiaries, too.",
        ),
      ],
      tags: ["divorce", "separation", "ex-spouse", "remove spouse", "COBRA"],
    },
  ),
  answer("open-enrollment", "Open Enrollment", GROUP_HEALTH, "Changes to Coverage", {
    bodyBlocks: [
      qa(
        "Once a year, during your plan's Open Enrollment window, you can change plans, add or drop dependents, and enroll in an HSA or FSA without a qualifying event. FSA elections must be made again every year.",
      ),
    ],
    tags: [
      "open enrollment",
      "annual enrollment",
      "change plans",
      "enrollment deadline",
    ],
    cta: memberPortal("Enroll Now"),
  }),
  answer("dependent-age-limit", "Dependent age limit", GROUP_HEALTH, "Changes to Coverage", {
    bodyBlocks: [
      qa(
        "Children can stay on your medical plan until age 26, whether or not they're married, in school, or living with you. Check your plan materials for exactly when a child's coverage ends.",
      ),
    ],
    tags: ["age 26", "adult child", "kids on plan", "dependent age"],
  }),

  // ── Quick Answers: HSA / FSA ──
  answer("hsa-vs-fsa", "HSA vs. FSA", GROUP_HEALTH, "HSA / FSA", {
    bodyBlocks: [
      qa(
        "An HSA (Health Savings Account) is available only with a high-deductible health plan. The money is yours to keep, carries over every year, and can be invested. An FSA (Flexible Spending Account) works with any plan, but you generally must use the money within the plan year. A separate Dependent Care FSA covers child care and adult day care.",
      ),
      { type: "video", videoId: "HSA vs. FSA" },
    ],
    tags: ["HSA vs FSA", "difference", "which account", "dependent care"],
  }),
  answer("eligible-expenses", "Eligible expenses", GROUP_HEALTH, "HSA / FSA", {
    bodyBlocks: [
      qa(
        "You can use these accounts for deductibles, copays, prescriptions, dental and vision care, and many over-the-counter items. Keep your receipts in case you're asked to verify a purchase.",
      ),
    ],
    tags: ["eligible expenses", "what can I buy", "qualified expenses", "receipts"],
  }),
  // A different slug from Retirement's `contribution-limits`: the two answers say
  // different things, and a Topic row is shared by every location.
  answer(
    "hsa-fsa-contribution-limits",
    "Contribution limits",
    GROUP_HEALTH,
    "HSA / FSA",
    {
      bodyBlocks: [
        qa(
          "Each year the IRS sets how much you can contribute to an HSA (Health Savings Account) and a health FSA (Flexible Spending Account). The limits differ for self-only and family coverage, and an HSA allows an extra catch-up amount from age 55. Your plan materials list this year's limits.",
        ),
      ],
      tags: [
        "HSA limit",
        "FSA limit",
        "how much can I contribute",
        "max contribution",
      ],
    },
  ),
  answer("hsa-fsa-reimbursements", "Reimbursements", GROUP_HEALTH, "HSA / FSA", {
    bodyBlocks: [
      qa(
        "Pay with your benefits card at the point of purchase, or pay out of pocket and submit a claim with your receipt. FSA claims for the plan year must be submitted by your plan's run-out deadline.",
      ),
    ],
    tags: ["reimbursement", "submit receipt", "get paid back", "benefits card"],
    cta: memberPortal("Submit a Claim"),
  }),
  answer("unused-funds", "What happens to unused funds?", GROUP_HEALTH, "HSA / FSA", {
    bodyBlocks: [
      qa(
        "HSA money rolls over every year and stays yours, even if you leave the company. FSA money is generally use-it-or-lose-it, though your plan may allow a carryover or a grace period. Check your plan materials for which applies.",
      ),
    ],
    tags: ["unused funds", "rollover", "carryover", "lose my money", "use it or lose it"],
  }),

  // ── Quick Answers: Leaving / Aging ──
  answer("cobra", "COBRA", GROUP_HEALTH, "Leaving / Aging", {
    bodyBlocks: [
      qa(
        "COBRA lets you keep the same group health coverage after you leave, generally for up to 18 months. You'll receive an election notice and have 60 days to sign up, and coverage is retroactive once you elect it. You pay the full premium plus up to a 2% administrative fee.",
      ),
    ],
    tags: ["COBRA", "keep my insurance", "after I leave", "continuation coverage"],
  }),
  answer("marketplace-coverage", "Marketplace coverage", GROUP_HEALTH, "Leaving / Aging", {
    bodyBlocks: [
      qa(
        "Losing job-based coverage opens a 60-day special enrollment period on HealthCare.gov or your state's marketplace. Depending on your income, you may qualify for savings that make it cost less than COBRA. Compare both before you decide.",
      ),
    ],
    tags: ["marketplace", "Obamacare", "ACA", "HealthCare.gov", "individual insurance"],
  }),
  answer("leaving-the-company", "Leaving the company", GROUP_HEALTH, "Leaving / Aging", {
    bodyBlocks: [
      qa(
        "Your health coverage usually ends when your employment ends or at the end of that month. Before your last day, confirm your end date, compare COBRA, Marketplace, and a spouse's plan, and spend any FSA balance. Your HSA stays yours.",
      ),
    ],
    tags: ["leaving", "last day", "quit", "coverage end date", "termination"],
    cta: { label: "Contact HR", actionType: "external_url", target: "contact" },
  }),
  answer("turning-65", "Turning 65", GROUP_HEALTH, "Leaving / Aging", {
    bodyBlocks: [
      qa(
        "Your Medicare Initial Enrollment Period lasts 7 months: the 3 months before, the month of, and the 3 months after your 65th birthday month. If you're still working here and covered by this plan, you may be able to delay Part B without a penalty, depending on the size of your employer. Talk with an advisor before you decide.",
      ),
    ],
    tags: ["turning 65", "Medicare enrollment", "Part B", "still working at 65"],
    cta: advisorCta("Talk to a Medicare Advisor"),
  }),
  answer("medicare", "Medicare", GROUP_HEALTH, "Leaving / Aging", {
    bodyBlocks: [
      qa(
        "Medicare includes Part A (hospital), Part B (medical), and Part D (prescriptions), with Medicare Advantage and Medigap as additional options. If you have an HSA, stop contributing before your Medicare coverage starts, because Part A can be backdated up to 6 months.",
      ),
    ],
    tags: ["Medicare", "Part A", "Part B", "Part D", "Medigap", "Medicare Advantage"],
    cta: advisorCta("Talk to a Medicare Advisor"),
  }),
];

// ── Group Life ───────────────────────────────────────────────────────────────
//
// The content handoff's Group Life page: five Featured topics (the fifth,
// Disability Benefits, only when the employer offers STD or LTD) and 30 Quick
// Answers in six groups. Per-plan values Create Benefits does not store yet
// (`{{basic_life_amount}}`, `{{guaranteed_issue_amount}}`, `{{life_carrier_phone}}`,
// …) are written in neutral language; the carrier portal and name stay as tokens.
//
// `review-my-coverage`, `how-much-coverage`, `portability`, `conversion` and
// `file-a-claim` are also addressed by `lib/life-events/templates.ts`.

const GROUP_LIFE: TopicLocation[] = ["group_life"];

const GROUP_LIFE_TOPICS: LibraryTopicSeed[] = [
  // Featured 1.
  featured("review-my-coverage", "Review My Coverage", GROUP_LIFE, {
    summary: "See your current life and disability coverage.",
    bodyBlocks: [
      qa(
        "{{plan_sponsor_name}} provides basic life insurance. Check your benefits summary for the amount and what it costs you. It may include matching accidental death and dismemberment (AD&D) coverage, and you may also have added voluntary coverage for yourself or your family.",
      ),
      numbered(
        "Log in at {{recordkeeper_url}}.",
        "Open Life Insurance.",
        "Review your coverage amounts for yourself, your spouse, and your children.",
      ),
    ],
    tags: [
      "life insurance",
      "coverage amount",
      "how much",
      "basic life",
      "AD&D",
      "death benefit",
    ],
    cta: memberPortal("View My Coverage"),
  }),

  // Featured 2 — the Beneficiary Action Hub is the handoff's CTA; until that
  // panel exists the button hands the reader to the plan's HR contact card.
  featured("beneficiaries", "Update My Beneficiary", GROUP_LIFE, {
    summary: "Review or update who receives your life insurance benefit.",
    bodyBlocks: [
      qa(
        "Your life insurance beneficiary is separate from your retirement plan beneficiary, so update both. Review your choices after any marriage, divorce, birth, adoption, or death in the family. Minor children can't receive the money directly, so consider a trust or custodian.",
      ),
      numbered(
        "Log in at {{recordkeeper_url}}.",
        "Go to Beneficiaries.",
        "Add primary and contingent beneficiaries, with percentages.",
        "Save and confirm.",
      ),
    ],
    isActionHub: true,
    tags: [
      "beneficiary",
      "who gets my life insurance",
      "spouse",
      "children",
      "contingent",
      "divorced",
      "married",
    ],
    cta: { label: "Update My Beneficiary", actionType: "external_url", target: "contact" },
  }),

  // Featured 3 — gated on "voluntary life = Yes". That plan field does not exist
  // yet and the card is part of the designed set, so it ships visible.
  featured("change-or-add-coverage", "Change or Add Coverage", GROUP_LIFE, {
    summary: "Explore voluntary coverage for yourself and eligible family members.",
    bodyBlocks: [
      qa(
        "You can buy additional life insurance for yourself, your spouse, and your children through payroll deduction. Amounts up to the plan's guaranteed issue amount are guaranteed when you first enroll. Higher amounts, or enrolling later, may require Evidence of Insurability, which means answering health questions.",
      ),
      numbered(
        "Check that you're in an enrollment window: new hire, Open Enrollment, or a qualifying life event.",
        "Log in at {{recordkeeper_url}}.",
        "Choose your coverage amounts and review the cost per paycheck.",
        "Complete Evidence of Insurability if prompted.",
      ),
    ],
    tags: [
      "add life insurance",
      "voluntary life",
      "supplemental life",
      "more coverage",
      "spouse life",
      "child life",
    ],
    cta: memberPortal("Add Coverage"),
  }),

  // Featured 4.
  featured("file-a-claim", "File a Claim / Get Help", GROUP_LIFE, {
    summary: "Find claim information and connect with the right person.",
    bodyBlocks: [
      qa(
        "To file a life insurance claim, contact your HR department first. HR completes the employer section, and the beneficiary sends a claim form and certified death certificate to {{recordkeeper_name}}. We know this can be a difficult time, and your HR contact can walk you through each step.",
      ),
      numbered(
        "Notify your HR department.",
        "The beneficiary completes the claim form.",
        "Send the claim form and a certified death certificate to {{recordkeeper_name}}.",
        "{{recordkeeper_name}} reviews the claim and pays the benefit once approved.",
      ),
    ],
    tags: [
      "claim",
      "death",
      "passed away",
      "file a claim",
      "death certificate",
      "beneficiary claim",
    ],
    cta: memberPortal("Start a Claim"),
  }),

  // Featured 5 — gated on "STD = Yes or LTD = Yes". Those plan fields do not
  // exist yet, so it ships like the rest and the advisor can remove it.
  featured("disability-benefits", "Disability Benefits", GROUP_LIFE, {
    summary:
      "Understand your income protection if you can't work because of illness or injury.",
    bodyBlocks: [
      qa(
        "Short-term disability replaces part of your pay after a waiting period, for up to a set duration. Long-term disability replaces part of your pay after an elimination period, for longer illnesses or injuries. Your plan's certificate has the exact percentages and timing.",
      ),
      numbered(
        "Tell your manager and your HR department as soon as you know you'll be out.",
        "File a claim with the disability carrier.",
        "Ask your doctor to complete the medical section.",
        "Stay in touch with your claim manager until you return to work.",
      ),
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
    cta: memberPortal("File a Disability Claim"),
  }),

  // ── Quick Answers: Coverage ──
  answer("basic-vs-voluntary-life", "Basic vs. voluntary life insurance", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "Basic life insurance is provided by {{plan_sponsor_name}}, often at no cost to you. Voluntary life insurance is extra coverage you can buy for yourself and your family through payroll deduction.",
      ),
    ],
    tags: ["basic life", "voluntary life", "supplemental", "employer paid", "difference"],
  }),
  answer("how-much-coverage-do-i-have", "How much coverage do I have?", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "Your basic life coverage is set by your plan. Any voluntary coverage you elected is added on top. Log in to see your exact amounts.",
      ),
    ],
    tags: ["how much life insurance", "coverage amount", "death benefit"],
    cta: memberPortal("View My Coverage"),
  }),
  answer("how-much-coverage", "How much coverage do I need?", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "It depends on who relies on your income and what they would need to cover: everyday living costs, a mortgage or debts, children's education, and final expenses. Many people find employer coverage alone isn't enough. {{advisor_name}} can help you work out the right amount.",
      ),
      { type: "video", videoId: "How Much Life Insurance Do I Need?" },
    ],
    tags: [
      "how much do I need",
      "enough coverage",
      "income replacement",
      "family protection",
    ],
    cta: advisorCta("Get a Coverage Review"),
  }),
  answer(
    "review-my-personal-life-insurance",
    "Review my personal life insurance",
    GROUP_LIFE,
    "Coverage",
    {
      bodyBlocks: [
        qa(
          "Life insurance needs change over time. If you have a policy outside work, or think your current policy costs too much, {{advisor_name}} can review it alongside your employer coverage and help you decide what fits your family now.",
        ),
      ],
      tags: [
        "personal life insurance",
        "outside policy",
        "too expensive",
        "review my policy",
        "term vs whole",
      ],
      cta: advisorCta("Book a Coverage Review"),
    },
  ),
  answer("ad-d", "AD&D", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "Accidental death and dismemberment (AD&D) insurance pays an extra benefit if you die or suffer certain serious injuries, such as the loss of a limb or eyesight, in an accident. It doesn't cover death from illness.",
      ),
    ],
    tags: ["AD&D", "accidental death", "dismemberment", "accident"],
  }),
  answer("spouse-coverage", "Spouse coverage", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "You can buy coverage for your spouse up to the plan's spouse maximum. Spouse coverage is usually limited to a share of your own coverage, and higher amounts may require Evidence of Insurability.",
      ),
    ],
    tags: ["spouse life insurance", "husband", "wife", "partner coverage"],
  }),
  answer("dependent-child-coverage", "Dependent child coverage", GROUP_LIFE, "Coverage", {
    bodyBlocks: [
      qa(
        "You can buy coverage for each eligible child, from the plan's minimum age until the maximum age. One premium usually covers all of your children.",
      ),
    ],
    tags: ["child life insurance", "kids coverage", "dependent life"],
  }),
  answer(
    "imputed-income",
    "Why is there life insurance income on my pay stub?",
    GROUP_LIFE,
    "Coverage",
    {
      bodyBlocks: [
        qa(
          "IRS rules treat the cost of employer-paid group life coverage above $50,000 as taxable income. That small amount, called imputed income, appears on your pay stub and W-2. It's normal and doesn't mean you were paid extra.",
        ),
      ],
      tags: ["imputed income", "GTL", "taxable life insurance", "pay stub", "W-2"],
    },
  ),

  // ── Quick Answers: Beneficiaries ──
  answer("life-update-beneficiary", "How do I update my beneficiary?", GROUP_LIFE, "Beneficiaries", {
    bodyBlocks: [
      qa(
        "Log in at {{recordkeeper_url}}, go to Beneficiaries, and add each person's name, relationship, and percentage. Your life insurance beneficiary is separate from your retirement plan beneficiary, so update both.",
      ),
    ],
    tags: ["update beneficiary", "change beneficiary", "who gets my money"],
    cta: { label: "Update My Beneficiary", actionType: "external_url", target: "contact" },
  }),
  answer(
    "primary-vs-contingent-beneficiaries",
    "Primary vs. contingent beneficiaries",
    GROUP_LIFE,
    "Beneficiaries",
    {
      bodyBlocks: [
        qa(
          "Your primary beneficiary receives the benefit first. A contingent beneficiary receives it only if your primary beneficiary has died before you. Naming both helps avoid delays.",
        ),
      ],
      tags: ["primary beneficiary", "contingent beneficiary", "backup beneficiary"],
    },
  ),
  answer("naming-a-minor", "Naming a minor", GROUP_LIFE, "Beneficiaries", {
    bodyBlocks: [
      qa(
        "Insurance companies generally can't pay a benefit directly to a child. If a minor is named, a court may need to appoint someone to manage the money. Naming a trust, or a custodian under your state's laws, can avoid that. Talk with an estate attorney or {{advisor_name}}.",
      ),
    ],
    tags: ["minor beneficiary", "child beneficiary", "guardian", "custodian"],
    cta: advisorCta("Talk to an Advisor"),
  }),
  answer("naming-a-trust", "Naming a trust", GROUP_LIFE, "Beneficiaries", {
    bodyBlocks: [
      qa(
        "You can name a trust as your beneficiary by entering the trust's full name, date, and trustee. A trust lets you control how and when the money is used. An estate attorney can help you set one up.",
      ),
    ],
    tags: ["trust", "trust beneficiary", "estate planning", "trustee"],
  }),
  answer("review-beneficiary", "When should I review my beneficiary?", GROUP_LIFE, "Beneficiaries", {
    bodyBlocks: [
      qa(
        "Review it after any marriage, divorce, birth, adoption, or death in the family, and at least every few years. An outdated designation can send money to the wrong person.",
      ),
    ],
    tags: ["review beneficiary", "life event", "outdated beneficiary", "marriage", "divorce"],
  }),

  // ── Quick Answers: Enrollment ──
  answer("add-coverage", "How do I add coverage?", GROUP_LIFE, "Enrollment", {
    bodyBlocks: [
      qa(
        "Log in at {{recordkeeper_url}} during an enrollment window, choose your coverage amounts, and review the cost per paycheck. Your plan materials list when coverage starts.",
      ),
    ],
    tags: ["add coverage", "buy life insurance", "enroll in life"],
    cta: memberPortal("Add Coverage"),
  }),
  answer("evidence-of-insurability", "Evidence of insurability", GROUP_LIFE, "Enrollment", {
    bodyBlocks: [
      qa(
        "Evidence of Insurability (EOI) is a health questionnaire, sometimes with a short exam. It's usually required for amounts above the plan's guaranteed issue amount or when you enroll after your first opportunity. Coverage above the guaranteed amount starts only after {{recordkeeper_name}} approves it.",
      ),
    ],
    tags: [
      "EOI",
      "evidence of insurability",
      "health questions",
      "medical underwriting",
      "guaranteed issue",
    ],
  }),
  answer("when-can-i-change-coverage", "When can I change coverage?", GROUP_LIFE, "Enrollment", {
    bodyBlocks: [
      qa(
        "You can add or change coverage when you're first hired, during Open Enrollment, or within your plan's change window after a qualifying life event such as marriage or a new child.",
      ),
    ],
    tags: ["change coverage", "when can I enroll", "enrollment window", "life event"],
  }),
  answer("life-open-enrollment", "Open Enrollment", GROUP_LIFE, "Enrollment", {
    bodyBlocks: [
      qa(
        "Open Enrollment is the yearly chance to add or increase life coverage for yourself and your family, though higher amounts may require EOI. Check your plan materials for this year's dates.",
      ),
    ],
    tags: ["open enrollment", "annual enrollment", "enrollment deadline"],
    cta: memberPortal("Enroll Now"),
  }),

  // ── Quick Answers: Claims ──
  answer("file-a-life-claim", "How do I file a claim?", GROUP_LIFE, "Claims", {
    bodyBlocks: [
      qa(
        "Contact your HR department first. HR completes the employer section, and the beneficiary sends the claim form and required documents to {{recordkeeper_name}}.",
      ),
    ],
    tags: ["file a claim", "death claim", "how to claim life insurance"],
    cta: memberPortal("Start a Claim"),
  }),
  answer("claim-documentation", "What documentation is required?", GROUP_LIFE, "Claims", {
    bodyBlocks: [
      qa(
        "Typically you'll need the completed claim form, a certified death certificate, and the beneficiary's identification. AD&D claims may also need an accident or police report.",
      ),
    ],
    tags: ["death certificate", "claim documents", "paperwork", "what do I need"],
  }),
  answer("claim-contacts", "Who should I contact?", GROUP_LIFE, "Claims", {
    bodyBlocks: [
      qa(
        "Start with your HR department, who can confirm coverage and start the claim. For claim status, contact {{recordkeeper_name}}.",
      ),
    ],
    tags: ["contact", "who to call", "help with claim"],
    cta: { label: "Contact HR", actionType: "external_url", target: "contact" },
  }),
  answer(
    "after-a-claim-is-submitted",
    "What happens after a claim is submitted?",
    GROUP_LIFE,
    "Claims",
    {
      bodyBlocks: [
        qa(
          "{{recordkeeper_name}} reviews the claim and may ask for more information. Most complete claims are paid within a few weeks of approval. The carrier may also offer grief counseling and financial or legal guidance for beneficiaries.",
        ),
      ],
      tags: ["claim status", "how long", "payout", "after filing"],
    },
  ),

  // ── Quick Answers: Leaving the Company ──
  answer("portability", "Portability", GROUP_LIFE, "Leaving the Company", {
    bodyBlocks: [
      qa(
        "Portability lets you keep your group term life coverage after you leave, usually at group rates, by paying the premium directly to {{recordkeeper_name}}. You must apply within your plan's portability window of your coverage ending.",
      ),
    ],
    tags: ["portability", "keep life insurance", "port coverage", "after I leave"],
    cta: { label: "Contact the Carrier", actionType: "external_url", target: "contact" },
  }),
  answer("conversion", "Conversion", GROUP_LIFE, "Leaving the Company", {
    bodyBlocks: [
      qa(
        "Conversion lets you turn your group coverage into an individual permanent life policy without answering health questions. It usually costs more than group coverage. You must apply within your plan's conversion window of your coverage ending.",
      ),
    ],
    tags: ["conversion", "convert life insurance", "individual policy", "whole life"],
  }),
  answer(
    "coverage-when-employment-ends",
    "What happens to my coverage when employment ends?",
    GROUP_LIFE,
    "Leaving the Company",
    {
      bodyBlocks: [
        qa(
          "Your group life coverage usually ends when your employment ends. Before then, compare portability, conversion, and an individual policy. {{advisor_name}} can help you decide.",
        ),
      ],
      tags: [
        "leaving",
        "coverage ends",
        "quit",
        "retire",
        "life insurance after job",
      ],
      cta: advisorCta("Talk to an Advisor"),
    },
  ),

  // ── Quick Answers: Disability ──
  answer("short-term-disability", "Short-term disability", GROUP_LIFE, "Disability", {
    bodyBlocks: [
      qa(
        "Short-term disability replaces part of your pay if an illness, injury, surgery, or childbirth keeps you from working. Benefits start after your plan's waiting period and last up to the plan's maximum duration.",
      ),
    ],
    tags: ["short-term disability", "STD", "surgery", "maternity", "out of work"],
  }),
  answer("long-term-disability", "Long-term disability", GROUP_LIFE, "Disability", {
    bodyBlocks: [
      qa(
        "Long-term disability replaces part of your pay for longer illnesses or injuries. Benefits start after your plan's elimination period and can continue for an extended period, as defined in your certificate.",
      ),
    ],
    tags: ["long-term disability", "LTD", "can't work", "extended illness"],
  }),
  answer("disability-waiting-periods", "Waiting periods", GROUP_LIFE, "Disability", {
    bodyBlocks: [
      qa(
        "Benefits don't start the day you stop working. Short-term and long-term disability each begin after their own waiting period. You may be able to use paid time off or sick time during the waiting period.",
      ),
    ],
    tags: ["waiting period", "elimination period", "when do benefits start"],
  }),
  answer(
    "how-to-file-a-disability-claim",
    "How to file a disability claim",
    GROUP_LIFE,
    "Disability",
    {
      bodyBlocks: [
        qa(
          "File as soon as you know you'll be out. For a planned surgery or birth, you can often start the claim before your leave begins.",
        ),
        numbered(
          "Tell your manager and your HR department.",
          "File with the disability carrier.",
          "Ask your doctor to complete the medical section.",
          "Respond quickly to any requests from your claim manager.",
        ),
      ],
      tags: ["file disability", "disability claim", "how to apply", "leave of absence"],
      cta: memberPortal("File a Disability Claim"),
    },
  ),
  answer("return-to-work-questions", "Return-to-work questions", GROUP_LIFE, "Disability", {
    bodyBlocks: [
      qa(
        "You'll need a release from your doctor to return. If you can only work part-time at first, partial disability benefits may continue. Talk with your HR department about any workplace accommodations.",
      ),
    ],
    tags: ["return to work", "doctor's release", "part-time", "accommodations"],
  }),
  answer(
    "disability-benefits-taxable",
    "Are disability benefits taxable?",
    GROUP_LIFE,
    "Disability",
    {
      bodyBlocks: [
        qa(
          "It depends on who pays the premium. If {{plan_sponsor_name}} pays, benefits are generally taxable. If you pay with after-tax dollars, benefits are generally tax-free. Some states also have their own disability programs, which may work alongside this coverage.",
        ),
      ],
      tags: ["taxable", "disability taxes", "state disability", "SDI"],
    },
  ),
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
    "Getting Care",
    "Claims & Billing",
    "Prescriptions",
    "Changes to Coverage",
    "HSA / FSA",
    "Leaving / Aging",
  ],
  group_life: [
    "Coverage",
    "Beneficiaries",
    "Enrollment",
    "Claims",
    "Leaving the Company",
    "Disability",
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
