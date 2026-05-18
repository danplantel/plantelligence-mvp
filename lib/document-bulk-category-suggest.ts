import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import type { BenefitsCategory } from "@/types/new-client-wizard";

/** Minimum AI confidence for a document to count toward the majority histogram. */
export const BULK_CATEGORY_SUGGEST_MIN_CONFIDENCE = 55;

export type BulkSuggestInputDoc = {
  id: string;
  category?: string | null;
  categorySuggested?: string | null;
  categoryConfidence?: number | null;
};

export type BulkCategoryAssignmentHint =
  | {
      kind: "strict_majority";
      category: BenefitsCategory;
      displayLabel: string;
      documentIds: string[];
      voteCount: number;
      totalUncategorized: number;
    }
  | {
      kind: "mixed_or_split";
      documentIds: string[];
      lowConfidenceIds: string[];
    };

/**
 * Strict majority over uncategorized rows: count(category) > N/2 where N is the
 * number of documents still missing a category. Only rows with suggestion +
 * confidence ≥ {@link BULK_CATEGORY_SUGGEST_MIN_CONFIDENCE} vote; suggestions
 * are normalized with {@link resolvePersistedDocumentCategory}.
 */
export function computeBulkCategoryAssignmentHint(
  uploadedBatch: BulkSuggestInputDoc[],
): BulkCategoryAssignmentHint | null {
  const uncategorized = uploadedBatch.filter((d) => !d.category?.trim());
  const n = uncategorized.length;
  if (n <= 1) {
    return null;
  }

  const lowConfidenceIds: string[] = [];
  const counts = new Map<string, number>();

  for (const d of uncategorized) {
    const raw = d.categorySuggested?.trim();
    const conf = d.categoryConfidence;
    if (!raw || typeof conf !== "number" || conf < BULK_CATEGORY_SUGGEST_MIN_CONFIDENCE) {
      lowConfidenceIds.push(d.id);
      continue;
    }
    const canonical = resolvePersistedDocumentCategory(
      "Document",
      raw,
    ) as BenefitsCategory;
    counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
  }

  let bestCat: string | null = null;
  let bestCount = 0;
  Array.from(counts.entries()).forEach(([cat, c]) => {
    if (c > bestCount) {
      bestCount = c;
      bestCat = cat;
    }
  });

  const leaders = Array.from(counts.entries()).filter(
    ([, c]) => c === bestCount,
  );
  const strictMajority =
    bestCat != null &&
    leaders.length === 1 &&
    bestCount > n / 2;

  if (strictMajority && bestCat != null) {
    return {
      kind: "strict_majority",
      category: bestCat as BenefitsCategory,
      displayLabel: bestCat,
      documentIds: uncategorized.map((d) => d.id),
      voteCount: bestCount,
      totalUncategorized: n,
    };
  }

  return {
    kind: "mixed_or_split",
    documentIds: uncategorized.map((d) => d.id),
    lowConfidenceIds,
  };
}
