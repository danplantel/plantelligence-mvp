/**
 * viewer-access.server — what the signed-in user may see and do at the chrome level.
 *
 * The sidebar is an ORGANIZATION-level surface, but a Collaborator's permission is
 * per assignment (per plan), so the chrome cannot be decided from one plan. It needs one
 * summary instead: the UNION of the grids the caller holds, with the collaborator hard
 * blocks applied — the same question `resolvePlanAccess` answers for a single plan,
 * collapsed to "any of my plans".
 *
 * Presentation only. Every mutating route still enforces the real rule, so a client that
 * ignores this response is refused anyway; this exists so the chrome does not offer a
 * destination or an action the viewer cannot use.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import {
  organizationDisplayName,
  resolveOrganizationId,
} from "@/lib/organization";
import {
  BINARY_PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTIONS,
  type PermissionAccess,
  type TeammatePersonType,
  type TeammatePermissionSet,
} from "@/types/teammate";
import {
  effectivePermissionSet,
  isOwnerOrAdminOfOrganization,
} from "./access.server";

export interface ViewerAccess {
  /**
   * True when the caller is a live Collaborator. Owners and Team Members hold
   * organization-level access, so their chrome is never narrowed by this read.
   */
  isCollaborator: boolean;
  /**
   * The union of the caller's functions across the assignments they hold, with the
   * collaborator hard blocks applied — or `null` for a non-Collaborator, which
   * `createPermissionChecker` reads as "everything allowed" (the owner rule).
   */
  functions: TeammatePermissionSet | null;
  /**
   * May this viewer manage the organization's team — add a Team Member, invite a
   * collaborator, grant a seat?
   *
   * TRUE for an Owner or an Admin, false for everyone else. This is the spec's Open
   * Decision ("Can Editors invite Collaborators? No: Owner/Admin only") expressed once,
   * so a surface can offer a seat grant without a second read. The API still enforces it.
   */
  canManageTeam: boolean;
  /**
   * For a Collaborator: where they DO have access.
   *
   * The chrome refuses a URL that carries no plan (`/dashboard`, `/clients`, `/documents`), so a
   * refusal there had nothing to name — the notice could only say "you don't have access". This is
   * the FIRST assignment, which is the same one the invitation email lands on (`landingUrlFor`):
   * the plan they were given, its company name, the section when the grant is scoped to specific
   * ones, and the firm that invited them so it can be messaged.
   *
   * `null` for everyone else — an Owner or Team Member is never refused by that gate — and for a
   * Collaborator who holds no assignment yet.
   */
  primaryAssignment?: PrimaryAssignmentContext | null;
}

export interface PrimaryAssignmentContext {
  planId: string;
  planCompanyName: string | null;
  /** The section labels the grant covers; empty for a grant that covers the whole plan. */
  categories: string[];
  organizationName: string | null;
  ownerUserId: string | null;
}

/** A grid with every row at its denied value. A missing row is denied, never implied. */
function deniedGrid(): TeammatePermissionSet {
  const grid = {} as TeammatePermissionSet;
  for (const fn of PERMISSION_FUNCTIONS) {
    grid[fn] = BINARY_PERMISSION_FUNCTIONS.includes(fn)
      ? "not_allowed"
      : "no_access";
  }
  return grid;
}

/**
 * Rank within a row's OWN scale, so `edit > view > no_access` and
 * `allowed > not_allowed`. Binary and tristate rows never share a function, so the
 * two scales cannot be compared against each other.
 */
function rankOf(access: PermissionAccess): number {
  if (access === "edit") return 2;
  if (access === "view" || access === "allowed") return 1;
  return 0;
}

export async function getViewerAccess(userId: string): Promise<ViewerAccess> {
  /**
   * A session can outlive the account it belongs to, and that is a NORMAL state rather than a
   * failure: deleting your profile signs you out, but the redirect takes a moment, the chrome is
   * still mounted, and a second tab may be polling this endpoint throughout. The read below would
   * throw `[organization] User not found` and the route would log it as an error on every one of
   * those requests — noise that looks like a bug in the teammate layer and is not.
   *
   * Answered with the same fail-open shape a failed read returns, deliberately: there is no access
   * to report for an account that no longer exists, and the caller is on its way to the sign-in
   * page anyway.
   */
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!account) {
    return { isCollaborator: false, functions: null, canManageTeam: false };
  }

  const organizationId = await resolveOrganizationId(userId);

  /**
   * Found by `loginUserId` ALONE — deliberately not scoped to an organization.
   *
   * A Collaborator's login OWNS its own, personal Organization (created when the
   * invitation was accepted), which is NOT the organization their profile lives in.
   * Scoping this lookup to the login's organization therefore found nothing, and the nav
   * was never narrowed. `resolvePlanAccess` has the same rule for the same reason: access
   * is resolved by login, against the PLAN's organization.
   */
  const [profiles, canManageTeam] = await Promise.all([
    prisma.teammateProfile.findMany({
      where: { loginUserId: userId },
      select: { id: true, type: true },
    }),
    isOwnerOrAdminOfOrganization({ userId, organizationId }),
  ]);

  // No profile at all means the owner (who is synthesized and never has one), and a
  // `team_member` profile means a Team Member or Admin. Both hold organization-level
  // access, so their chrome is never narrowed.
  if (
    profiles.length === 0 ||
    profiles.some((profile) => profile.type === "team_member")
  ) {
    return { isCollaborator: false, functions: null, canManageTeam };
  }

  const assignments = await prisma.planAssignment.findMany({
    where: { profileId: { in: profiles.map((profile) => profile.id) } },
    select: {
      profileId: true,
      permissionSet: true,
      // Only read to build `primaryAssignment` below — the permission union does not use them.
      organizationId: true,
      clientId: true,
      categoryScope: true,
      categories: true,
    },
    // Earliest first, so "the plan they were given" is stable and matches the invitation.
    orderBy: { createdAt: "asc" },
  });

  const typeById = new Map<string, TeammatePersonType>(
    profiles.map((profile) => [profile.id, profile.type as TeammatePersonType]),
  );

  const union = deniedGrid();
  for (const assignment of assignments) {
    const grid = effectivePermissionSet(
      assignment.permissionSet,
      typeById.get(assignment.profileId) ?? "collaborator",
    );
    for (const fn of PERMISSION_FUNCTIONS) {
      if (rankOf(grid[fn]) > rankOf(union[fn])) union[fn] = grid[fn];
    }
  }

  // ── Where they DO have access ──
  // See `primaryAssignment`. One extra read per request for a Collaborator, and none for anyone
  // else — the notice is the only consumer, and without it the refusal cannot name anything.
  const firstAssignment = assignments[0];
  let primaryAssignment: PrimaryAssignmentContext | null = null;
  if (firstAssignment) {
    const [plan, organizationName, organization] = await Promise.all([
      prisma.client.findUnique({
        where: { id: firstAssignment.clientId },
        select: { companyName: true },
      }),
      organizationDisplayName(firstAssignment.organizationId),
      prisma.organization.findUnique({
        where: { id: firstAssignment.organizationId },
        select: { ownerUserId: true },
      }),
    ]);
    primaryAssignment = {
      planId: firstAssignment.clientId,
      planCompanyName: (plan?.companyName ?? "").trim() || null,
      categories:
        firstAssignment.categoryScope === "selected"
          ? ((firstAssignment.categories ?? []) as string[])
          : [],
      organizationName: (organizationName ?? "").trim() || null,
      ownerUserId: organization?.ownerUserId ?? null,
    };
  }

  return {
    isCollaborator: true,
    functions: union,
    canManageTeam,
    primaryAssignment,
  };
}
