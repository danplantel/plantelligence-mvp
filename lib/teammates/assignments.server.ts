/**
 * assignments.server — Assignment data access (spec T1 Part B item 3).
 *
 * "Assignment = which plan and categories they're connected to, with what role,
 * and whether they're shown on the hub. One record per person per plan."
 *
 * Two invariants this module owns:
 *  1. One assignment per (profile, plan). The schema enforces it with a compound
 *     unique; `upsertAssignment` is the only writer.
 *  2. The stored `permissionSet` is always the FULL, already-finalized grid —
 *     auto-enforced rules applied, collaborator hard blocks applied. A tampered
 *     request body therefore cannot smuggle a locked permission through.
 *
 * Server-only. Every function takes `organizationId`.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";
import {
  PERMISSION_FUNCTIONS,
  normalizePermissionSet,
  type TeammateAssignmentRole,
  type TeammateCategoryScope,
  type TeammatePermissionSet,
} from "@/types/teammate";
import {
  resolveAssignmentGrid,
  validatePermissionSet,
} from "./permissions";

/**
 * The grid as a plain JSON object for Prisma. A `Record<string, string>` has the
 * index signature Prisma's `InputJsonObject` requires; the mapped type from
 * `types/teammate.ts` does not.
 */
function toPermissionJson(
  set: TeammatePermissionSet,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fn of PERMISSION_FUNCTIONS) out[fn] = set[fn];
  return out;
}

/** Read a stored grid back into the contract type. */
export function getAssignmentPermissionSet(assignment: {
  permissionSet: unknown;
}): TeammatePermissionSet {
  return normalizePermissionSet(assignment.permissionSet);
}

export interface UpsertAssignmentInput {
  organizationId: string;
  profileId: string;
  clientId: string;
  /** The logged-in user making the change. */
  actorUserId: string;
  role: TeammateAssignmentRole;
  /** Required when `role` is `custom`. */
  customPermissionSet?: unknown;
  categoryScope?: TeammateCategoryScope;
  categories?: string[];
  showOnBenefitsHub?: boolean;
  /** Soft-warning codes the user confirmed (spec T2a save-and-audit). */
  warningsConfirmed?: string[] | null;
}

export async function getAssignment({
  profileId,
  clientId,
  organizationId,
}: {
  profileId: string;
  clientId: string;
  organizationId: string;
}) {
  return prisma.planAssignment.findFirst({
    where: { profileId, clientId, organizationId },
  });
}

/**
 * Create or update the single assignment for a person on a plan.
 *
 * Ownership checks run first (profile and plan must both belong to the org), then
 * the grid is finalized, then validated. Only then is anything written.
 */
export async function upsertAssignment(input: UpsertAssignmentInput) {
  const profile = await prisma.teammateProfile.findFirst({
    where: { id: input.profileId, organizationId: input.organizationId },
    select: { id: true, type: true, deactivatedAt: true },
  });
  if (!profile) {
    throw new TeammateDataError(
      "Teammate profile not found in this organization.",
      404,
    );
  }
  if (profile.deactivatedAt) {
    throw new TeammateDataError(
      "This teammate is deactivated. Reactivate them before assigning a plan.",
      409,
      "profile_deactivated",
    );
  }

  await assertPlanInOrganization(input.clientId, input.organizationId);

  const categoryScope: TeammateCategoryScope = input.categoryScope ?? "all";
  const categories =
    categoryScope === "selected" ? uniqueCategories(input.categories ?? []) : [];
  if (categoryScope === "selected" && categories.length === 0) {
    throw new TeammateDataError(
      "Select at least one category, or set the scope to All categories.",
      400,
      "empty_category_scope",
    );
  }

  // Finalize (auto-enforced rules + hard blocks), then assert the result is
  // coherent. A caller that supplied a locked permission is rejected here — the
  // hard block is applied silently for UX, but a direct API call is refused.
  const supplied = resolveAssignmentGrid({
    role: input.role,
    personType: profile.type,
    customSet: input.customPermissionSet,
  });
  const violations = validatePermissionSet(
    input.customPermissionSet ?? supplied,
    profile.type,
  );
  if (violations.length > 0) {
    throw new TeammateDataError(
      violations[0].message,
      400,
      violations[0].code,
    );
  }

  const existing = await getAssignment({
    profileId: input.profileId,
    clientId: input.clientId,
    organizationId: input.organizationId,
  });

  const now = new Date();
  const assignment = await prisma.planAssignment.upsert({
    where: {
      profileId_clientId: {
        profileId: input.profileId,
        clientId: input.clientId,
      },
    },
    create: {
      organizationId: input.organizationId,
      profileId: input.profileId,
      clientId: input.clientId,
      categoryScope,
      categories,
      role: input.role,
      permissionSet: toPermissionJson(supplied),
      showOnBenefitsHub: input.showOnBenefitsHub ?? true,
      invitedByUserId: input.actorUserId,
      invitedAt: now,
      lastChangedByUserId: input.actorUserId,
      lastChangedAt: now,
    },
    update: {
      categoryScope,
      categories,
      role: input.role,
      permissionSet: toPermissionJson(supplied),
      ...(input.showOnBenefitsHub === undefined
        ? {}
        : { showOnBenefitsHub: input.showOnBenefitsHub }),
      lastChangedByUserId: input.actorUserId,
      lastChangedAt: now,
    },
  });

  await recordTeammateAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: !existing
      ? "assignment_created"
      : existing.role !== input.role
        ? "assignment_role_changed"
        : "assignment_updated",
    profileId: input.profileId,
    assignmentId: assignment.id,
    warningsConfirmed: input.warningsConfirmed ?? null,
    details: {
      clientId: input.clientId,
      role: input.role,
      categoryScope,
      categories,
    },
  });

  // Spec T2a Part B item 5 names Custom saves explicitly in the audit trail.
  if (input.role === "custom") {
    await recordTeammateAuditEvent({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "custom_access_set",
      profileId: input.profileId,
      assignmentId: assignment.id,
      warningsConfirmed: input.warningsConfirmed ?? null,
      details: { permissionSet: toPermissionJson(supplied) },
    });
  }

  return assignment;
}

/** Every assignment on a plan. */
export async function listAssignmentsForPlan(
  clientId: string,
  organizationId: string,
) {
  return prisma.planAssignment.findMany({
    where: { clientId, organizationId },
    orderBy: { createdAt: "asc" },
  });
}

/** Every assignment a person holds, across plans. */
export async function listAssignmentsForProfile(
  profileId: string,
  organizationId: string,
) {
  return prisma.planAssignment.findMany({
    where: { profileId, organizationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function countAssignmentsForProfile(
  profileId: string,
  organizationId: string,
) {
  return prisma.planAssignment.count({
    where: { profileId, organizationId },
  });
}

/**
 * Assignment + profile pairs for a plan, which is what the Benefits Hub needs to
 * render a team (spec T7). Profiles are fetched in one query rather than via a
 * relation, because the teammate collections deliberately carry no `@relation`.
 *
 * Orphaned assignments (profile deleted out from under the row) are dropped
 * rather than rendered.
 */
export async function listAssignedProfilesForPlan(
  clientId: string,
  organizationId: string,
  options?: { showOnHubOnly?: boolean },
) {
  const assignments = await prisma.planAssignment.findMany({
    where: {
      clientId,
      organizationId,
      ...(options?.showOnHubOnly ? { showOnBenefitsHub: true } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (assignments.length === 0) return [];

  const profiles = await prisma.teammateProfile.findMany({
    where: {
      organizationId,
      id: { in: assignments.map((a) => a.profileId) },
    },
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return assignments.flatMap((assignment) => {
    const profile = byId.get(assignment.profileId);
    if (!profile) return [];
    return [{ assignment, profile }];
  });
}

/** Spec T7 Part B item 2: display off keeps admin access, hides from the hub. */
export async function setAssignmentShowOnBenefitsHub({
  assignmentId,
  organizationId,
  actorUserId,
  showOnBenefitsHub,
}: {
  assignmentId: string;
  organizationId: string;
  actorUserId: string;
  showOnBenefitsHub: boolean;
}) {
  const existing = await prisma.planAssignment.findFirst({
    where: { id: assignmentId, organizationId },
  });
  if (!existing) {
    throw new TeammateDataError("Assignment not found.", 404);
  }

  const updated = await prisma.planAssignment.update({
    where: { id: assignmentId },
    data: {
      showOnBenefitsHub,
      lastChangedByUserId: actorUserId,
      lastChangedAt: new Date(),
    },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "assignment_visibility_changed",
    profileId: existing.profileId,
    assignmentId,
    details: { showOnBenefitsHub },
  });

  return updated;
}

/**
 * Spec T6 Part B item 1: "Remove Assignment: access to that plan or category
 * ends immediately." Content the person created is never deleted.
 */
export async function removeAssignment({
  assignmentId,
  organizationId,
  actorUserId,
}: {
  assignmentId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await prisma.planAssignment.findFirst({
    where: { id: assignmentId, organizationId },
  });
  if (!existing) {
    throw new TeammateDataError("Assignment not found.", 404);
  }

  await prisma.planAssignment.delete({ where: { id: assignmentId } });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "assignment_removed",
    profileId: existing.profileId,
    details: { clientId: existing.clientId, role: existing.role },
  });

  return { id: assignmentId };
}

/**
 * The plan must belong to the organization. A plan that predates the T1
 * backfill may still have a null `organizationId`, so fall back to comparing the
 * plan's legacy owner against the organization's owner.
 */
async function assertPlanInOrganization(
  clientId: string,
  organizationId: string,
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { id: true, organizationId: true, userId: true },
  });
  if (!client) {
    throw new TeammateDataError("Plan not found.", 404);
  }
  if (client.organizationId) {
    if (client.organizationId !== organizationId) {
      throw new TeammateDataError(
        "That plan belongs to a different organization.",
        403,
        "plan_not_in_organization",
      );
    }
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  if (!org || org.ownerUserId !== client.userId) {
    throw new TeammateDataError(
      "That plan belongs to a different organization.",
      403,
      "plan_not_in_organization",
    );
  }
}

function uniqueCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of categories) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Re-exported so callers don't need a second import for the JSON shape. */
export type AssignmentJson = Prisma.InputJsonValue;
