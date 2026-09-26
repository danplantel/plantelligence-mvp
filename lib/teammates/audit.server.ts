/**
 * audit.server — Teammate audit trail.
 *
 * Backs two spec requirements:
 *  - T2a Part B item 5: "Log who set Custom access, when, and which warnings
 *    were confirmed."
 *  - T6 Part B item 5: "Every change is logged with who and when."
 *
 * Server-only. Always scoped by `organizationId`.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** The mutations this feature can record. */
export type TeammateAuditAction =
  | "profile_created"
  | "profile_updated"
  | "profile_state_changed"
  | "profile_login_linked"
  | "profile_all_plans_changed"
  | "profile_company_changed"
  | "profile_deactivated"
  | "profile_reactivated"
  | "profile_deleted"
  | "company_created"
  | "company_updated"
  | "assignment_created"
  | "assignment_updated"
  | "assignment_role_changed"
  | "assignment_visibility_changed"
  | "assignment_removed"
  | "collaborator_invited"
  | "custom_access_set"
  | "seat_limit_upgrade_confirmed";

export interface RecordTeammateAuditEventInput {
  organizationId: string;
  /** The logged-in user performing the change. */
  actorUserId: string;
  action: TeammateAuditAction;
  profileId?: string | null;
  assignmentId?: string | null;
  /**
   * Soft-warning codes the user confirmed before saving (spec T2a). Only
   * meaningful for Custom-role saves, but harmless to record elsewhere.
   */
  warningsConfirmed?: string[] | null;
  details?: Prisma.InputJsonValue | null;
}

/**
 * Append one audit event.
 *
 * Deliberately NOT swallowed: a teammate change that cannot be recorded is a
 * compliance gap, so the write fails loudly rather than silently diverging from
 * the audit trail. Callers therefore perform the mutation and the audit write in
 * that order, and a failure is surfaced to the API layer.
 */
export async function recordTeammateAuditEvent(
  input: RecordTeammateAuditEventInput,
) {
  return prisma.teammateAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      profileId: input.profileId ?? null,
      assignmentId: input.assignmentId ?? null,
      warningsConfirmed: input.warningsConfirmed ?? undefined,
      details: input.details ?? undefined,
    },
  });
}

/**
 * Most recent audit events for an organization, optionally narrowed to one
 * profile or assignment. Newest first.
 */
export async function listTeammateAuditEvents({
  organizationId,
  profileId,
  assignmentId,
  limit = 50,
}: {
  organizationId: string;
  profileId?: string;
  assignmentId?: string;
  limit?: number;
}) {
  return prisma.teammateAuditEvent.findMany({
    where: {
      organizationId,
      ...(profileId ? { profileId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}
