import { displayCategoryName } from "@/lib/benefit-custom-name";
import type { HelpCardContent } from "@/types/benefit";

/**
 * "How Can We Help You Today?" — the card CATALOG.
 *
 * The advisor configures the LAYOUT (order + which card is primary); the copy is
 * static here and resolved by id, so a card's text is identical on every benefit
 * and can never be edited per plan. Adding a per-category set later means
 * returning a different catalog from `helpCardCatalogFor` — the layout entries
 * keep referencing ids.
 *
 * `[Benefit Category]`, `[Company Name]` and `[Advisor Name]` are merge tokens,
 * resolved at render time by the portal section.
 */

/** `data-help-card` id of the wide Account Access card. */
export const ACCOUNT_ACCESS_CARD_ID = "account-access";

/** The current (and, for now, only) benefit-hub card set. */
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

/** Every id in the default catalog, in its natural order. */
export const HELP_CARD_ORDER: string[] = HELP_CARD_CATALOG.map(
  (card) => card.id,
);

/** The catalog for a benefit category (one shared set for now). */
export function helpCardCatalogFor(_category?: string | null): HelpCardContent[] {
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
