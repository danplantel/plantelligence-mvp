import type { PlanAttentionIssueKind } from "@/lib/plan-needs-attention";

/**
 * Types for the dashboard task list. Client-safe — the Prisma-backed derivation lives in
 * `lib/dashboard-tasks.server.ts`.
 */

/** A task derived from plan state on every read rather than stored anywhere. */
export interface SystemTask {
  /** Synthetic, and stable for as long as the underlying issue exists. */
  id: string;
  title: string;
  /** Plan the task belongs to, shown as context on the row. */
  planName: string;
  /** Page that resolves it. */
  href: string;
  kind: PlanAttentionIssueKind | "ready-to-publish";
  /**
   * The plan it belongs to, as an id.
   *
   * The synthetic `id` encodes this, but not SAFELY: a normalized category key contains hyphens, so
   * nothing can take `system-incomplete-benefit-{planId}-{category}` apart again. Consumers that
   * need the parts — the assignment picker scoping its offer to one plan, and the dashboard matching
   * a stored assignment against the derived row it stands in for — read them here instead.
   */
  clientId: string;
  /** The benefit category a category-scoped issue belongs to; null for a plan-wide one. */
  category: string | null;
}

/** An advisor-authored task, stored in the `Task` model. */
export interface ManualTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  /** Optional plan the task relates to. */
  clientId: string | null;
  planName: string | null;
  /**
   * Who handed this over, when it came from a comment thread. Null for the reader's own task.
   *
   * An assigned row is still the reader's row — they complete it, it is theirs on this dashboard —
   * but where it came from is part of what it is, and hiding that would make the list lie about why
   * the work is there.
   */
  assignedByUserId: string | null;
  assignedByName: string | null;
  /**
   * The DERIVED task this stands in for, when it was assigned from one, and the page that resolves
   * it. Carried so the row can keep the automated task's icon and link even though the derived row
   * itself is suppressed for this reader — see `derivedTaskKey`.
   */
  derivedKind: string | null;
  href: string | null;
}

/**
 * What to call a derived task's kind in a sentence.
 *
 * Here rather than in one of the two components that need it — the dashboard row and the comment card
 * — because the same work must not be called "Incomplete benefit" in a conversation and something
 * else on the dashboard. Wording, but shared wording, exactly like the role labels.
 */
export const DERIVED_TASK_LABELS: Record<string, string> = {
  "incomplete-benefit": "Incomplete benefit",
  "uncategorized-documents": "Uncategorized documents",
  "missing-disclaimers": "Missing disclaimers",
};

/**
 * The identity of a DERIVED task, as `(plan, kind, category)`.
 *
 * This is the de-duplication key, and it is a function rather than an inline template so the writer
 * (which stores the parts) and the reader (which suppresses on them) cannot disagree about what
 * "the same task" means. It mirrors the synthetic id `listSystemTasks` builds — deliberately, since
 * that id IS those three things — without either side having to parse the string.
 */
export function derivedTaskKey(
  clientId: string,
  kind: string,
  category: string | null,
): string {
  return `${clientId}|${kind}|${category ?? ""}`;
}

export interface DashboardTasksResponse {
  success: boolean;
  data: {
    system: SystemTask[];
    manual: ManualTask[];
  };
}
