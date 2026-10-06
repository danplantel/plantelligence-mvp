/**
 * nav-access — which chrome destinations a viewer may use.
 *
 * ONE rule for TWO surfaces: the sidebar hides a destination it cannot reach, and the
 * dashboard layout refuses to render it when the URL is typed directly. Keeping the map
 * here is what stops the two from disagreeing — adding a path here hides it and blocks
 * it in the same stroke.
 *
 * Pure and client-safe: it imports types only, so both the sidebar and the layout guard
 * can use it without dragging Prisma (or `access.server`) into the browser bundle.
 */

import type { RequiredLevel } from "./permission-levels";
import type { PermissionFunction } from "@/types/teammate";

export interface NavAccessRequirement {
  /**
   * A page no Collaborator has a use for — hidden and refused regardless of the grid.
   * The Dashboard is the advisor's overview of the plans they own, and creating a plan
   * stamps the organization and its owner; neither is a collaborator surface.
   */
  collaboratorHidden?: boolean;
  /** A function the viewer must hold, checked against the union of their grids. */
  permission?: PermissionFunction;
  /** Defaults to `view`. */
  level?: RequiredLevel;
}

/**
 * Restricted destinations. Settings is deliberately absent — it is a separate decision.
 *
 * Ownership and Team Membership need no entry: `isCollaborator` alone carries them,
 * because those viewers hold organization-level access and are never narrowed.
 */
export const NAV_ACCESS_REQUIREMENTS: Record<string, NavAccessRequirement> = {
  "/dashboard": { collaboratorHidden: true },
  "/new-client": { collaboratorHidden: true },
  "/new-benefits": { permission: "create_benefits", level: "edit" },
};

/** The requirement governing a pathname (including its children), or null when open. */
export function navRequirementFor(
  pathname: string | null | undefined,
): NavAccessRequirement | null {
  if (!pathname) return null;
  for (const [route, requirement] of Object.entries(NAV_ACCESS_REQUIREMENTS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return requirement;
    }
  }
  return null;
}

/** The two facts a decision needs, so callers can pass the hook's return directly. */
export interface ViewerAccessLike {
  isCollaborator: boolean;
  can: (fn: PermissionFunction, level?: RequiredLevel) => boolean;
}

/**
 * May this viewer use this path?
 *
 * Owners and Team Members are never narrowed — `isCollaborator` is false for them, and
 * a failure to read the summary is reported the same way (see `useViewerAccess`), so a
 * transient error can never lock anyone out of the chrome.
 */
export function mayUsePath(
  pathname: string | null | undefined,
  viewer: ViewerAccessLike,
): boolean {
  const requirement = navRequirementFor(pathname);
  if (!requirement) return true;
  if (!viewer.isCollaborator) return true;
  if (requirement.collaboratorHidden) return false;
  return requirement.permission
    ? viewer.can(requirement.permission, requirement.level ?? "view")
    : true;
}
