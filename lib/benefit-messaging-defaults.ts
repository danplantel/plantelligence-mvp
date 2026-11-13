/**
 * Seed copy for Create/Edit Benefit → Step 1 → Branding → **Messaging**.
 *
 * These are DEFAULTS, not persisted content: the wizard writes them into the draft
 * only when the advisor has nothing saved for that category, so improving the wording
 * later never rewrites a benefit somebody has edited.
 *
 * WHO IS SPEAKING — this is the part the old defaults got wrong.
 *
 * The Intro Headline and Intro Message are read by PARTICIPANTS on the hub: they are
 * the plan sponsor's words to its own employees. Two rules follow, and both are
 * enforced here rather than at each call site:
 *
 *  1. **The headline names the plan sponsor** — the client/plan `companyName`, never
 *     the advisor's own firm. Whether the advisor lists a category among their
 *     Settings → service categories is an admin preference; it must not decide whose
 *     name the participant is greeted with.
 *  2. **The advisor's firm is named in the MESSAGE**, which is the one place a
 *     participant expects "we were selected by <plan sponsor>" to come from. The
 *     advisor is the party the plan selected, not the portal's host.
 *
 * The copy is also CATEGORY-AWARE. The old message was retirement-only and was seeded
 * into every hub, so a Group Health or Group Life page opened with "…your retirement
 * plan… building toward retirement…". Each benefit now gets sentences about itself.
 */
import { BENEFIT_TITLE_MAX_LENGTH } from "@/lib/benefit-custom-name";

/** Longest Intro Message the field accepts. */
export const INTRO_MESSAGE_MAX_LENGTH = 450;

const GREETING = "Welcome to ";
const HEADLINE_FALLBACK = `${GREETING}Your Benefits Hub!`;

/**
 * "Welcome to <plan sponsor>!"
 *
 * Whitespace is collapsed before measuring, and the trailing "!" is budgeted for, so
 * the result always fits the 35-character Intro Headline field instead of being
 * silently clipped by the input's `maxLength`.
 */
export function buildIntroHeadline(
  companyName: string | null | undefined,
): string {
  const name = (companyName || "").trim().replace(/\s+/g, " ");
  if (!name) return HEADLINE_FALLBACK;
  const maxNameLength = BENEFIT_TITLE_MAX_LENGTH - GREETING.length - 1;
  return `${GREETING}${name.slice(0, maxNameLength)}!`;
}

/** Which family of copy a category reads. */
type MessageFamily = "retirement" | "health" | "life" | "general";

/**
 * Normalise the category spellings in play — the stored labels, the wizard's
 * "Custom", the legacy free-text names — onto one copy family.
 */
function messageFamilyFor(category: string | null | undefined): MessageFamily {
  const value = (category || "").toLowerCase().trim().replace(/\s+/g, " ");
  if (!value) return "general";
  if (value.includes("retire") || value.includes("401")) return "retirement";
  if (value.includes("health") || value.includes("medical")) return "health";
  if (value.includes("life") || value.includes("disab")) return "life";
  // Custom ("Company / Plan Sponsor"), "Other Benefits", wellness programmes and any
  // advisor-named hub all read the general copy.
  return "general";
}

type MessageTemplate = (company: string, org: string) => string;

const MESSAGE_TEMPLATES: Record<MessageFamily, MessageTemplate> = {
  retirement: (company, org) =>
    `We consider it a privilege to have been selected by ${company} to represent you and your retirement plan. ` +
    `Whether you're just beginning your savings journey or already building toward retirement, ` +
    `${org} shares your company's commitment to educating you about the importance and long-term value of ` +
    `participating in this valuable retirement benefit.`,
  health: (company, org) =>
    `We consider it a privilege to have been selected by ${company} to help you get the most from your health benefits. ` +
    `Whether you are choosing coverage for yourself or for your family, ${org} shares your company's commitment ` +
    `to making your medical, dental and vision benefits clear, affordable and easy to use.`,
  life: (company, org) =>
    `We consider it a privilege to have been selected by ${company} to help you understand your life and disability coverage. ` +
    `${org} shares your company's commitment to making these protections easy to understand — ` +
    `so you and your family always know what is covered and how to use it when it matters most.`,
  general: (company, org) =>
    `We consider it a privilege to have been selected by ${company} to help you get the most from the benefits available to you. ` +
    `${org} shares your company's commitment to making each program clear and easy to use, ` +
    `so you can take full advantage of everything offered to you and your family.`,
};

/**
 * The Intro Message a category starts with.
 *
 * `companyName` is the plan sponsor (the client/plan), `orgName` the advisor's firm.
 * Missing values read as plain-language stand-ins rather than "undefined".
 */
export function buildIntroMessage(input: {
  category?: string | null;
  companyName?: string | null;
  orgName?: string | null;
}): string {
  const company = (input.companyName || "").trim() || "your company";
  const org = (input.orgName || "").trim() || "your advisor";
  const template = MESSAGE_TEMPLATES[messageFamilyFor(input.category)];
  return template(company, org).slice(0, INTRO_MESSAGE_MAX_LENGTH);
}
