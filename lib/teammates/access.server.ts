/**
 * access.server — the T2 permission enforcement layer.
 *
 * Source: Team_Collaborator_Access_Developer_Spec (1).pdf, ticket T2.
 *
 * Spec Part B:
 *  1. "Every read and write is checked at the API layer, not only in the UI.
 *      Each request is validated against plan, category, and the assignment's
 *      permission set."
 *  2. "Collaborators never publish, delete, invite, view billing or org settings,
 *      or see unassigned plans. This is a hard rule, including for Custom roles."
 *  3. "Signed URLs for documents and media check the assignment before they're
 *      issued."
 *  4. "At least one Owner must always exist on an organization."
 *
 * This module is the single place that answers "may this actor do this to this
 * plan?". Routes must not re-implement ownership checks ad hoc — that is exactly
 * how the pre-T1 codebase ended up with hundreds of copies of
 * `client.findFirst({ where: { id, userId } })`, every one of which a teammate
 * would fail.
 *
 * Design rules:
 *  - Owner detection is legacy-safe: `Client.userId` is checked first, so an
 *    owner whose Organization row does not exist yet is never locked out of
 *    their own plans.
 *  - Teammate access is derived from `TeammateProfile.loginUserId` → the
 *    assignment for that plan. No assignment means no access, which is what
 *    implements "collaborators never see unassigned plans".
 *  - Collaborator hard blocks are re-applied on top of the stored grid, so a
 *    Custom grid that somehow carries Publish/Invite/Delete/Org Settings/Billing
 *    still cannot be exercised by a collaborator.
 *  - The teammate collections carry no Prisma relations by design (see the T1
 *    notes in prisma/schema.prisma), so NOTHING here uses a relation filter.
 *  - `deactivatedAt` is always evaluated in JS rather than with
 *    `deactivatedAt: null`, because on this Prisma+MongoDB pairing a `null`
 *    filter matches only explicit nulls and would silently hide absent fields.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { TeammateDataError } from "./errors";
import { applyHardBlocks } from "./permissions";
import {
  permissionAllows,
  type RequiredLevel,
} from "./permission-levels";
// Re-exported so existing importers (e.g. the benefits route) keep working, and
// so `RequiredLevel` has one definition. `permissionAllows` lives in the pure
// module because client components need it too.
export { permissionAllows, type RequiredLevel };
import {
  normalizePermissionSet,
  type PermissionFunction,
  type TeammateAssignmentRole,
  type TeammatePermissionSet,
  type TeammatePersonType,
} from "@/types/teammate";

/**
 * The copy the spec requires for a restricted page (T2 Part A item 2):
 * "You don't have access to this plan/section" with a link back to the dashboard.
 */
export const NO_ACCESS_MESSAGE = "You don't have access to this plan/section";


/* ───────────────────────────── Results ───────────────────────────── */

export type PlanAccessDenialReason =
  | "plan_not_found"
  | "not_assigned"
  | "profile_deactivated"
  | "category_not_assigned"
  | "permission_denied";

export interface OwnerPlanGrant {
  allowed: true;
  kind: "owner";
  userId: string;
  clientId: string;
  organizationId: string | null;
  /** Owners hold every permission; there is no grid to consult. */
  permissionSet: null;
}

export interface TeammatePlanGrant {
  allowed: true;
  kind: "teammate";
  userId: string;
  clientId: string;
  organizationId: string;
  profileId: string;
  personType: TeammatePersonType;
  role: TeammateAssignmentRole;
  /** `"all"`, or the explicit category labels the assignment covers. */
  categories: "all" | string[];
  permissionSet: TeammatePermissionSet;
  showOnBenefitsHub: boolean;
}

export type PlanAccessGrant = OwnerPlanGrant | TeammatePlanGrant;

export interface PlanAccessDenial {
  allowed: false;
  reason: PlanAccessDenialReason;
  /** Always the spec's copy, so no caller can drift from it. */
  message: string;
  clientId?: string;
}

export type PlanAccessResult = PlanAccessGrant | PlanAccessDenial;

/* ───────────────────────────── Helpers ───────────────────────────── */

/**
 * Case/whitespace-insensitive category comparison, with the same alias mapping
 * the contacts resolver uses (lib/benefit-contacts.ts): the wizard's "Custom"
 * hub is the stored "Company / Plan Sponsor", and the legacy portal page names
 * map onto the canonical categories. Without this, an assignment scoped to
 * "Company / Plan Sponsor" would wrongly deny a request for "Custom".
 */
function normalizeCategory(category: string): string {
  const value = (category ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (value === "custom") return "company / plan sponsor";
  if (value === "health insurance") return "group health";
  if (value === "life insurance") return "group life";
  if (value === "wellness programs") return "other";
  return value;
}

function isLive(profile: { deactivatedAt: Date | null }): boolean {
  return !profile.deactivatedAt;
}

/**
 * The grid actually in force for a person: the stored grid with collaborator
 * hard blocks re-applied. Exported so the UI can render what the API will
 * enforce rather than trusting the raw row.
 */
export function effectivePermissionSet(
  raw: unknown,
  personType: TeammatePersonType,
): TeammatePermissionSet {
  return applyHardBlocks(normalizePermissionSet(raw), personType);
}

/* ─────────────────────────── Owner detection ─────────────────────────── */

/**
 * Is this user the owner of the organization that owns this plan?
 *
 * Two independent routes, deliberately:
 *  - `Client.userId` — the pre-T1 anchor every existing plan carries.
 *  - `Organization.ownerUserId` — the T1 anchor, for plans created later.
 *
 * Checking the legacy field first is what keeps an un-backfilled owner working.
 */
export async function isPlanOwner({
  userId,
  plan,
}: {
  userId: string;
  plan: { userId: string; organizationId: string | null };
}): Promise<boolean> {
  if (plan.userId === userId) return true;
  if (!plan.organizationId) return false;
  const organization = await prisma.organization.findUnique({
    where: { id: plan.organizationId },
    select: { ownerUserId: true },
  });
  return organization?.ownerUserId === userId;
}

/* ─────────────────────── Plan access resolution ─────────────────────── */

/** The minimum a plan row must expose to be authorized. */
export interface PlanRow {
  id: string;
  slug: string | null;
  userId: string;
  organizationId: string | null;
}

/**
 * Resolve a plan by ObjectId or slug, with no authorization applied.
 *
 * Exported so `plan-guard.server.ts` can authorize against a row a route has
 * already loaded (or is about to return) instead of querying twice.
 */
export async function loadPlanRow(
  clientIdOrSlug: string,
): Promise<PlanRow | null> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(clientIdOrSlug);
  return (
    (await prisma.client.findFirst({
      where: isObjectId
        ? { OR: [{ id: clientIdOrSlug }, { slug: clientIdOrSlug }] }
        : { slug: clientIdOrSlug },
      select: { id: true, slug: true, userId: true, organizationId: true },
    })) ?? null
  );
}

export interface ResolvePlanAccessInput {
  userId: string;
  /** Plan ObjectId or slug. */
  clientIdOrSlug: string;
  /** Optional category the request targets (e.g. "Group Health"). */
  category?: string | null;
  /** Optional function row the request exercises. */
  permission?: PermissionFunction;
  /** Defaults to `view`. */
  level?: RequiredLevel;
}

/** The same input minus the plan reference, for callers that already have it. */
export type PlanAccessInput = Omit<ResolvePlanAccessInput, "clientIdOrSlug">;

/**
 * The single read/write authorization check. Returns a discriminated result so
 * UI code can render the right refusal while API code maps it to a status.
 */
export async function resolvePlanAccess(
  input: ResolvePlanAccessInput,
): Promise<PlanAccessResult> {
  const plan = await loadPlanRow(input.clientIdOrSlug);
  if (!plan) {
    return {
      allowed: false,
      reason: "plan_not_found",
      message: NO_ACCESS_MESSAGE,
    };
  }
  return resolvePlanAccessForPlan(plan, input);
}

/**
 * The same authorization, against an ALREADY-LOADED plan row.
 *
 * Exists so a route that must load the full Client anyway (to read fields for its
 * own response) can authorize without a second lookup — while keeping the
 * decision logic in exactly one place. Anything satisfying `PlanRow` works, so a
 * full Prisma `Client` row can be passed straight in.
 */
export async function resolvePlanAccessForPlan(
  plan: PlanRow,
  input: PlanAccessInput,
): Promise<PlanAccessResult> {
  // 1. Owner — full access, never partially restricted.
  if (await isPlanOwner({ userId: input.userId, plan })) {
    return {
      allowed: true,
      kind: "owner",
      userId: input.userId,
      clientId: plan.id,
      organizationId: plan.organizationId,
      permissionSet: null,
    };
  }

  // 2. Teammate — needs a profile in the plan's organization AND an assignment
  //    for this exact plan. Either missing means "unassigned plan".
  const organizationId = plan.organizationId;
  if (!organizationId) {
    return {
      allowed: false,
      reason: "not_assigned",
      message: NO_ACCESS_MESSAGE,
      clientId: plan.id,
    };
  }

  const profile = await prisma.teammateProfile.findFirst({
    where: { organizationId, loginUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!profile) {
    return {
      allowed: false,
      reason: "not_assigned",
      message: NO_ACCESS_MESSAGE,
      clientId: plan.id,
    };
  }
  if (!isLive(profile)) {
    return {
      allowed: false,
      reason: "profile_deactivated",
      message: NO_ACCESS_MESSAGE,
      clientId: plan.id,
    };
  }

  const assignment = await prisma.planAssignment.findFirst({
    where: { profileId: profile.id, clientId: plan.id, organizationId },
  });
  if (!assignment) {
    return {
      allowed: false,
      reason: "not_assigned",
      message: NO_ACCESS_MESSAGE,
      clientId: plan.id,
    };
  }

  // 3. Category scope.
  const categories: "all" | string[] =
    assignment.categoryScope === "selected"
      ? (assignment.categories ?? [])
      : "all";

  if (input.category && categories !== "all") {
    const wanted = normalizeCategory(input.category);
    const covered = categories.some((c) => normalizeCategory(c) === wanted);
    if (!covered) {
      return {
        allowed: false,
        reason: "category_not_assigned",
        message: NO_ACCESS_MESSAGE,
        clientId: plan.id,
      };
    }
  }

  // 4. Function-level permission. Hard blocks are re-applied on top of the
  //    stored grid: T2 makes this a rule that holds even for Custom roles, so
  //    the row alone is never trusted.
  const permissionSet = effectivePermissionSet(
    assignment.permissionSet,
    profile.type,
  );

  if (input.permission) {
    const level: RequiredLevel = input.level ?? "view";
    if (!permissionAllows(permissionSet, input.permission, level)) {
      return {
        allowed: false,
        reason: "permission_denied",
        message: NO_ACCESS_MESSAGE,
        clientId: plan.id,
      };
    }
  }

  return {
    allowed: true,
    kind: "teammate",
    userId: input.userId,
    clientId: plan.id,
    organizationId,
    profileId: profile.id,
    personType: profile.type,
    role: assignment.role,
    categories,
    permissionSet,
    showOnBenefitsHub: assignment.showOnBenefitsHub,
  };
}

/**
 * Throwing form for route handlers.
 *
 * `plan_not_found` maps to 404 so an unassigned plan never leaks its existence;
 * every other denial is 403 carrying the spec's copy.
 */
export async function requirePlanAccess(
  input: ResolvePlanAccessInput,
): Promise<PlanAccessGrant> {
  const result = await resolvePlanAccess(input);
  if (result.allowed) return result;
  const notFound = result.reason === "plan_not_found";
  throw new TeammateDataError(
    result.message,
    notFound ? 404 : 403,
    result.reason,
  );
}

/* ───────────────── Organization-level permissions ───────────────── */

export interface ResolveOrganizationPermissionInput {
  userId: string;
  organizationId: string;
  permission: PermissionFunction;
  level?: RequiredLevel;
}

/**
 * Org-settings / billing style checks.
 *
 * Owners pass. A Team Member passes when ANY of their assignments in that
 * organization grants the function — their preset is what encodes org-level
 * rights, and presets are written onto every assignment.
 *
 * Collaborators can never pass: `applyHardBlocks` forces those rows to
 * No Access / Not Allowed before the check, so T2's hard rule holds even for a
 * Custom grid.
 */
export async function resolveOrganizationPermission(
  input: ResolveOrganizationPermissionInput,
): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { ownerUserId: true },
  });
  if (organization?.ownerUserId === input.userId) return true;

  const profile = await prisma.teammateProfile.findFirst({
    where: {
      organizationId: input.organizationId,
      loginUserId: input.userId,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!profile || !isLive(profile)) return false;

  const assignments = await prisma.planAssignment.findMany({
    where: { profileId: profile.id, organizationId: input.organizationId },
    select: { permissionSet: true },
  });

  const level: RequiredLevel = input.level ?? "view";
  return assignments.some((assignment) =>
    permissionAllows(
      effectivePermissionSet(assignment.permissionSet, profile.type),
      input.permission,
      level,
    ),
  );
}

export async function requireOrganizationPermission(
  input: ResolveOrganizationPermissionInput,
): Promise<void> {
  if (!(await resolveOrganizationPermission(input))) {
    throw new TeammateDataError(NO_ACCESS_MESSAGE, 403, input.permission);
  }
}

/* ─────────── Visible plans: unassigned plans are invisible ─────────── */

/**
 * Every plan id this user may see at all.
 *
 * Implements spec Part B item 2 for collaborators: "never … see unassigned
 * plans". Plan lists and selectors should filter through this instead of
 * querying `Client` directly.
 *
 * Owners see every plan they own (legacy `userId` or `Organization.ownerUserId`).
 * A Team Member with All Plans sees every plan in their organization. Everyone
 * else sees exactly their assignments.
 */
export async function listAccessiblePlanIds(userId: string): Promise<string[]> {
  const [ownedOrganizations, profiles] = await Promise.all([
    prisma.organization.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    }),
    prisma.teammateProfile.findMany({
      // No relation filters here: the teammate models carry no relations, and
      // deactivation is evaluated in JS (see the module header).
      where: { loginUserId: userId },
      select: { id: true, organizationId: true, allPlans: true, deactivatedAt: true },
    }),
  ]);

  const liveProfiles = profiles.filter(isLive);
  const ownedOrgIds = ownedOrganizations.map((org) => org.id);
  const profileIds = liveProfiles.map((profile) => profile.id);
  const allPlansOrgIds = liveProfiles
    .filter((profile) => profile.allPlans)
    .map((profile) => profile.organizationId);

  const [ownedPlans, assignedPlans, allPlansClients] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { userId },
          ...(ownedOrgIds.length > 0
            ? [{ organizationId: { in: ownedOrgIds } }]
            : []),
        ],
      },
      select: { id: true },
    }),
    profileIds.length > 0
      ? prisma.planAssignment.findMany({
          where: { profileId: { in: profileIds } },
          select: { clientId: true },
        })
      : Promise.resolve([] as { clientId: string }[]),
    allPlansOrgIds.length > 0
      ? prisma.client.findMany({
          where: { organizationId: { in: allPlansOrgIds } },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
  ]);

  const ids = new Set<string>();
  for (const plan of ownedPlans) ids.add(plan.id);
  for (const row of assignedPlans) ids.add(row.clientId);
  for (const plan of allPlansClients) ids.add(plan.id);
  return [...ids];
}

/* ─────────────── At least one Owner (Part B item 4) ─────────────── */

/**
 * How many owners an organization has right now.
 *
 * The Organization's `ownerUserId` counts only while that User still exists.
 * Checking existence (rather than just a non-empty id) matters: we already hit
 * the case once where a User was deleted and left plans and an Organization
 * behind, and an organization whose owner is gone genuinely has no owner. Team
 * Members holding the Owner preset add to the count, while they remain active.
 */
export async function countOrganizationOwners(
  organizationId: string,
  options?: { excludingAssignmentIds?: string[] },
): Promise<number> {
  const excluded = new Set(options?.excludingAssignmentIds ?? []);

  const [organization, ownerAssignments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerUserId: true },
    }),
    prisma.planAssignment.findMany({
      where: { organizationId, role: "owner" },
      select: { id: true, profileId: true },
    }),
  ]);

  const ownerProfileIds = [
    ...new Set(
      ownerAssignments
        .filter((assignment) => !excluded.has(assignment.id))
        .map((assignment) => assignment.profileId),
    ),
  ];

  const liveOwnerProfiles =
    ownerProfileIds.length > 0
      ? (
          await prisma.teammateProfile.findMany({
            where: { id: { in: ownerProfileIds }, organizationId },
            select: { deactivatedAt: true },
          })
        ).filter(isLive).length
      : 0;

  // The owning User only counts while they still exist.
  const organizationOwner = organization?.ownerUserId
    ? await prisma.user.count({ where: { id: organization.ownerUserId } })
    : 0;

  return organizationOwner + liveOwnerProfiles;
}

/**
 * Spec T2 Part B item 4: "At least one Owner must always exist on an
 * organization." Call before any change that could remove the last Owner —
 * demoting an assignment away from the Owner role, or deleting one.
 */
export async function assertOrganizationKeepsAnOwner({
  organizationId,
  excludingAssignmentIds,
}: {
  organizationId: string;
  excludingAssignmentIds?: string[];
}): Promise<void> {
  const remaining = await countOrganizationOwners(organizationId, {
    excludingAssignmentIds,
  });
  if (remaining < 1) {
    throw new TeammateDataError(
      "An organization must always have at least one Owner.",
      409,
      "last_owner",
    );
  }
}

/* ───────────── Signed URLs for documents and media (item 3) ───────────── */

/**
 * R2 keys are `org/{orgId}/plans/{planId}/{documents|branding|uploads}/…`
 * (see lib/r2.ts). The plan segment is what lets a signed-URL request be checked
 * against the caller's assignment — spec Part B item 3.
 */
export function parseR2Key(key: string): {
  orgSegment: string | null;
  planId: string | null;
  folder: string | null;
} {
  const match = /^org\/([^/]+)\/plans\/([^/]+)\/([^/]+)\//.exec(key ?? "");
  if (match) {
    return { orgSegment: match[1], planId: match[2], folder: match[3] };
  }
  const orgOnly = /^org\/([^/]+)\//.exec(key ?? "");
  return { orgSegment: orgOnly?.[1] ?? null, planId: null, folder: null };
}

/** Which function row a key's folder maps to. */
export function permissionForR2Folder(
  folder: string | null,
): PermissionFunction | undefined {
  switch (folder) {
    case "documents":
      return "documents";
    case "branding":
      return "plan_details_branding";
    // `uploads` is a mixed bag (videos, marketing assets, images). Requiring
    // assignment to the plan at view level is the safe default; the writing
    // routes check the specific function.
    default:
      return undefined;
  }
}

export interface ObjectAccessResult {
  allowed: boolean;
  reason?: PlanAccessDenialReason | "not_own_object";
}

/**
 * May this user be issued a URL for this object?
 *
 * Plan-scoped keys are checked against the assignment — the spec's requirement.
 * Legacy org-level keys predate the plan segment, so they fall back to an
 * ownership check on the org segment, matching what the route did before T2.
 */
export async function resolveObjectAccess({
  userId,
  key,
  level = "view",
}: {
  userId: string;
  key: string;
  level?: RequiredLevel;
}): Promise<ObjectAccessResult> {
  const { orgSegment, planId, folder } = parseR2Key(key);

  if (planId) {
    const result = await resolvePlanAccess({
      userId,
      clientIdOrSlug: planId,
      permission: permissionForR2Folder(folder),
      level,
    });
    return result.allowed
      ? { allowed: true }
      : { allowed: false, reason: result.reason };
  }

  // Legacy / org-level key: the segment is the legacy owner id.
  if (orgSegment && orgSegment === userId) return { allowed: true };

  // …or the segment is an Organization this user owns.
  if (orgSegment) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgSegment },
      select: { ownerUserId: true },
    });
    if (organization?.ownerUserId === userId) return { allowed: true };
  }

  return { allowed: false, reason: "not_own_object" };
}

/** Throwing form of `resolveObjectAccess` for the R2 routes. */
export async function requireObjectAccess(params: {
  userId: string;
  key: string;
  level?: RequiredLevel;
}): Promise<void> {
  const result = await resolveObjectAccess(params);
  if (!result.allowed) {
    throw new TeammateDataError(
      "Access denied to this object",
      403,
      result.reason ?? "forbidden",
    );
  }
}
