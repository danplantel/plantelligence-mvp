/**
 * viewer-access.server — what the signed-in user may see in the dashboard chrome.
 *
 * The sidebar is an ORGANIZATION-level surface, but a Collaborator's permission is
 * per assignment (per plan), so the chrome cannot be decided from one plan. It needs
 * one summary instead: the UNION of the grids the caller holds, with the collaborator
 * hard blocks applied — the same question `resolvePlanAccess` answers for a single
 * plan, collapsed to "any of my plans".
 *
 * Presentation only. Every mutating route still enforces the real rule, so a client
 * that ignores this response is refused anyway; this exists so the nav does not offer
 * a destination the viewer cannot use.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import {
  BINARY_PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTIONS,
  type PermissionAccess,
  type TeammatePersonType,
  type TeammatePermissionSet,
} from "@/types/teammate";
import { effectivePermissionSet } from "./access.server";

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
   * Found by `loginUserId` ALONE — deliberately not scoped to an organization.
   *
   * A Collaborator's login OWNS its own, personal Organization (created when the
   * invitation was accepted), which is NOT the organization their profile lives in.
   * Scoping this lookup to the login's organization therefore found nothing, and the
   * nav was never narrowed. `resolvePlanAccess` has the same rule for the same
   * reason: access is resolved by login, against the PLAN's organization.
   */
  const profiles = await prisma.teammateProfile.findMany({
    where: { loginUserId: userId },
    select: { id: true, type: true },
  });

  // No profile at all means the owner (who is synthesized and never has one), and a
  // `team_member` profile means a Team Member or Admin. Both hold organization-level
  // access, so their chrome is never narrowed.
  if (
    profiles.length === 0 ||
    profiles.some((profile) => profile.type === "team_member")
  ) {
    return { isCollaborator: false, functions: null };
  }

  const assignments = await prisma.planAssignment.findMany({
    where: { profileId: { in: profiles.map((profile) => profile.id) } },
    select: { profileId: true, permissionSet: true },
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

  return { isCollaborator: true, functions: union };
}
