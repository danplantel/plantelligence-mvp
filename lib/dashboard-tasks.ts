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
}

export interface DashboardTasksResponse {
  success: boolean;
  data: {
    system: SystemTask[];
    manual: ManualTask[];
  };
}
