import {
  libraryTopicsForStarterSet,
  type CustomStarterSetId,
  type LibraryTopicSeed,
} from "@/lib/topics/library";

/**
 * "The advisor named the fourth hub — what should it start with?"
 *
 * The handoff gives Other / Custom no fixed defaults: when the advisor names the
 * category, we SUGGEST a starter set by keyword match (Wellness, EAP, Voluntary
 * Benefits, Financial Wellness) and they can always start blank. This module decides
 * which suggestion to offer; it never places anything by itself.
 *
 * Matching is deliberately conservative. A wrong suggestion is noise the advisor has
 * to dismiss, so an unknown name produces `null` rather than a guess.
 */

export interface CustomStarterSetDefinition {
  id: CustomStarterSetId;
  /** The name shown on the suggestion button. */
  label: string;
  /** One line explaining what the set contains. */
  description: string;
  /**
   * Lower-case fragments to look for in the advisor's hub name. Longer phrases are
   * tried first, so "financial wellness" cannot be taken by "wellness".
   */
  keywords: string[];
}

/**
 * Ordered by specificity of intent, not by name. `financial_wellness` claims the
 * "financial" family before `voluntary` can see "long term care".
 */
export const CUSTOM_STARTER_SETS: CustomStarterSetDefinition[] = [
  {
    id: "financial_wellness",
    label: "Financial Wellness",
    description: "Budgeting, debt, credit, and estate basics.",
    keywords: [
      "financial wellness",
      "financial wellbeing",
      "financial well-being",
      "financial literacy",
      "financial",
      "budget",
      "debt",
      "credit",
      "money",
    ],
  },
  {
    id: "voluntary",
    label: "Voluntary Benefits",
    description: "Long-term care, critical illness, accident, pet, and legal plans.",
    keywords: [
      "voluntary benefits",
      "voluntary",
      "critical illness",
      "accident",
      "long term care",
      "long-term care",
      "pet insurance",
      "legal plan",
      "supplemental",
    ],
  },
  {
    id: "wellness",
    label: "Wellness",
    description: "EAP, mental health, and fitness resources.",
    keywords: [
      "wellness",
      "wellbeing",
      "well-being",
      "employee assistance",
      "eap",
      "mental health",
      "fitness",
      "lifestyle",
      "health",
    ],
  },
];

export interface CustomStarterSuggestion {
  setId: CustomStarterSetId;
  label: string;
  description: string;
  /** The fragment that matched, lower-case. Useful in the UI and in tests. */
  matchedKeyword: string;
  /** The library entries the set would offer. */
  topics: LibraryTopicSeed[];
}

/** Lower-case, punctuation flattened — "Wellness & Fitness" → "wellness fitness". */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Suggest a starter set for the advisor's hub name, or `null` when nothing matches.
 *
 * Longest keyword wins before set order does, so a hub named "Financial Wellness"
 * resolves to Financial Wellness rather than Wellness even though "wellness" appears
 * in both.
 */
export function suggestCustomStarterSet(
  customName: string | null | undefined,
): CustomStarterSuggestion | null {
  const name = normalize(customName || "");
  if (!name) return null;

  let best: { set: CustomStarterSetDefinition; keyword: string } | null = null;

  for (const set of CUSTOM_STARTER_SETS) {
    for (const keyword of set.keywords) {
      if (!name.includes(keyword)) continue;
      if (!best || keyword.length > best.keyword.length) {
        best = { set, keyword };
      }
    }
  }

  if (!best) return null;

  return {
    setId: best.set.id,
    label: best.set.label,
    description: best.set.description,
    matchedKeyword: best.keyword,
    topics: libraryTopicsForStarterSet(best.set.id),
  };
}
