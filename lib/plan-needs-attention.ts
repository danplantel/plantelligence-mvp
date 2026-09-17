import {
  getBenefitCompleteness,
  getBenefitsArrayFromPortalPreview,
  normalizeBenefitsCategoryForCompleteness,
} from "@/lib/benefit-completeness";
import { isDocumentCategoryUnresolved } from "@/lib/document-category";
import {
  getCategoryPortalVisibility,
  isCategoryVisibleInPortal,
} from "@/lib/portal-category-visibility";
import type { BenefitsCategory, DisclaimersData } from "@/types/new-client-wizard";

/**
 * A plan "needs attention" when any of its visible benefit categories is incomplete, when
 * it holds documents that were never categorized, or when no disclaimer content has been
 * configured.
 *
 * This module is pure — it reads a plan object and returns a verdict. The Prisma-backed
 * count/list live in `lib/plan-needs-attention.server.ts` so this file stays importable
 * from anywhere.
 */

interface DocumentLike {
  type?: string | null;
  category?: string | null;
  storageKey?: string | null;
  archivedAt?: Date | string | null;
}

/** The subset of a plan this evaluation reads. Matches the server select. */
export interface PlanAttentionInput {
  employeePortalPreview?: unknown;
  keyContacts?: unknown;
  categoryPortalVisibility?: unknown;
  disclaimers?: unknown;
  documents?: DocumentLike[] | null;
}

export type PlanAttentionIssueKind =
  | "incomplete-benefit"
  | "uncategorized-documents"
  | "missing-disclaimers";

/**
 * A single reason a plan needs attention, structured rather than pre-formatted so the
 * dashboard can route each one to the surface that fixes it — an incomplete benefit goes
 * to Create Benefits for that category, not to the generic plan editor.
 */
export interface PlanAttentionIssue {
  kind: PlanAttentionIssueKind;
  /** Chip text, e.g. "Incomplete benefit: Retirement". */
  label: string;
  /** Benefit category this issue is scoped to, when the issue is category-specific. */
  category?: string;
  /** Specific fields still to be completed, when the issue is a completeness failure. */
  missing?: string[];
  /** Affected document count, when the issue is document-scoped. */
  count?: number;
}

export interface PlanAttentionResult {
  needsAttention: boolean;
  issues: PlanAttentionIssue[];
  /** Visible benefit categories that failed the completeness check. */
  incompleteCategories: string[];
  uncategorizedDocumentCount: number;
  hasDisclaimerContent: boolean;
}

const hasDisclaimerText = (value: unknown): boolean => {
  const text = (value as { text?: unknown } | null)?.text;
  return typeof text === "string" && text.trim() !== "";
};

/**
 * True when the plan actually renders disclaimers on its portal.
 *
 * Note this is not literally an "acknowledgment": the attestation dialogs in the publish
 * and disclaimer-update flows are UI-only and persist nothing per plan, so there is no
 * acknowledgement record to read. The closest durable signal is whether any disclaimer
 * content was ever configured — `useDefaultDisclosures` counts, because the portal
 * renders the universal disclaimer when it is set.
 */
export function hasDisclaimerContent(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;

  const data = raw as DisclaimersData;
  if (data.useDefaultDisclosures === true) return true;
  if (
    typeof data.disclosuresText === "string" &&
    data.disclosuresText.trim() !== ""
  ) {
    return true;
  }
  if (Object.values(data.byCategory ?? {}).some(hasDisclaimerText)) return true;
  if (Array.isArray(data.disclaimers) && data.disclaimers.some(hasDisclaimerText)) {
    return true;
  }
  return false;
}

/**
 * Non-archived documents that were never explicitly categorized and carry nothing in
 * their type or R2 path to derive one from.
 *
 * Archived documents are skipped to match `getBenefitCompleteness`, which ignores them.
 */
export function countUncategorizedDocuments(
  documents: readonly DocumentLike[] | null | undefined,
): number {
  if (!Array.isArray(documents)) return 0;

  return documents.reduce((total, document) => {
    if (document?.archivedAt) return total;
    return (
      total +
      (isDocumentCategoryUnresolved(
        document.type,
        document.category,
        document.storageKey,
      )
        ? 1
        : 0)
    );
  }, 0);
}

export interface IncompleteBenefit {
  category: string;
  /** The specific fields `getBenefitCompleteness` reported as missing. */
  missing: string[];
}

/**
 * Visible benefit categories whose hub content is not complete, each paired with what is
 * missing so the dashboard can say what still needs doing rather than only which
 * category failed.
 *
 * Categories come from the plan's own benefit cards, so only the tabs this plan actually
 * publishes are judged. Cards hidden via `categoryPortalVisibility` are skipped, which
 * keeps a deliberately hidden hub from counting against the plan.
 */
export function findIncompleteBenefits(
  plan: PlanAttentionInput,
): IncompleteBenefit[] {
  const cards = getBenefitsArrayFromPortalPreview(plan);
  const visibility = getCategoryPortalVisibility(plan.categoryPortalVisibility);

  const categories = new Set<string>();
  for (const card of cards) {
    const raw = String(card?.category ?? card?.title ?? "").trim();
    if (!raw) continue;

    const canonical = normalizeBenefitsCategoryForCompleteness(raw);
    if (!canonical) continue;
    if (!isCategoryVisibleInPortal(canonical, visibility)) continue;

    categories.add(canonical);
  }

  const incomplete: IncompleteBenefit[] = [];
  for (const category of categories) {
    const completeness = getBenefitCompleteness(
      category as BenefitsCategory,
      plan,
    );
    if (completeness.isComplete) continue;
    incomplete.push({ category, missing: completeness.missingInfo });
  }

  return incomplete;
}

export function evaluatePlanAttention(
  plan: PlanAttentionInput,
): PlanAttentionResult {
  const incompleteBenefits = findIncompleteBenefits(plan);
  const incompleteCategories = incompleteBenefits.map(
    (benefit) => benefit.category,
  );
  const uncategorizedDocumentCount = countUncategorizedDocuments(plan.documents);
  const disclaimerContentPresent = hasDisclaimerContent(plan.disclaimers);

  const issues: PlanAttentionIssue[] = [];

  // One issue per incomplete category, carrying both the category (for the deep link)
  // and the specific fields that failed (so the chip can name what is missing).
  for (const { category, missing } of incompleteBenefits) {
    issues.push({
      kind: "incomplete-benefit",
      category,
      missing,
      label: `Incomplete benefit: ${category}`,
    });
  }

  if (uncategorizedDocumentCount > 0) {
    issues.push({
      kind: "uncategorized-documents",
      count: uncategorizedDocumentCount,
      label:
        uncategorizedDocumentCount === 1
          ? "1 uncategorized document"
          : `${uncategorizedDocumentCount} uncategorized documents`,
    });
  }

  if (!disclaimerContentPresent) {
    issues.push({
      kind: "missing-disclaimers",
      label: "No disclaimers configured",
    });
  }

  return {
    needsAttention: issues.length > 0,
    issues,
    incompleteCategories,
    uncategorizedDocumentCount,
    hasDisclaimerContent: disclaimerContentPresent,
  };
}
