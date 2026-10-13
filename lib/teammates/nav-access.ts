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
   * A page no Collaborator may use — hidden and refused regardless of the grid.
   *
   * Use this for destinations that are the ADVISOR's workspace rather than a collaborator's,
   * where no grid row could express the rule because the page is not about a function at all.
   * It is deliberately coarser than the grid, so prefer it when the capability the page
   * represents is reachable somewhere else (`/documents`, `/communications`) **or** when the page
   * is a flow the advisor owns rather than a permission (`/new-benefits`, which stays hidden even
   * though the grid row it used to be gated on is deliberately left granted — see below).
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
 *
 * Every entry below is the advisor's own workspace rather than a collaborator's. A collaborator is
 * invited to work on the benefits they were assigned, and everything they need to do that is
 * reachable from `/benefits` (scoped to the same assignments by `listAccessiblePlanIds`) and from
 * the plan or benefit they open. So each of these removes a DESTINATION, not an ability, and where
 * a per-plan surface exists it is still inside the plan:
 *
 *  - `/dashboard` — the advisor's overview of the plans they own.
 *  - `/new-client` — creating a plan stamps the organization and its owner.
 *  - `/clients` — the plans LIBRARY. Reachable by URL it would still be scoped correctly, so this
 *    is a chrome decision rather than a security one: the library is navigation for someone who
 *    owns plans.
 *  - `/documents` — the standalone documents LIBRARY. The `documents` grid row is left granted,
 *    so a Contributor keeps `documents: edit` and still manages a benefit's documents in the
 *    benefit editor.
 *  - `/communications` — the whole section (Meetings, Webinars & Replays, Marketing). Its three
 *    children are one hub: the calendar of what the advisor is running across every plan, which is
 *    not a collaborator's question. The `meetings` row is left granted — a plan's own meetings
 *    render inside the plan, which is where a collaborator needs them.
 *  - `/new-benefits` — the CREATE BENEFIT wizard, the four-step flow that builds a benefit page
 *    from scratch. This one used to be the map's only GRID entry (`create_benefits: edit`), and it
 *    was moved here deliberately: `create_benefits: edit` is ALSO the permission the benefit editor
 *    saves under, so revoking it would stop a Contributor saving the very sections they were
 *    invited for — the hard block belongs on the creation flow, not on the permission. What is
 *    removed is creation; a collaborator works on the sections the advisor created.
 *
 * Because of that last entry, none of these may be read as a statement about a permission: hiding a
 * page here never revokes its function. If the intent is ever to stop GRANTING Documents, Meetings
 * or the benefit editor to collaborators, that belongs in the preset grid in `types/teammate.ts` —
 * not here — otherwise the chrome and the grid state two different rules and the next reader cannot
 * tell which is authoritative. `verify-t2` asserts the pairing in both directions for all three.
 */
export const NAV_ACCESS_REQUIREMENTS: Record<string, NavAccessRequirement> = {
  "/dashboard": { collaboratorHidden: true },
  "/new-client": { collaboratorHidden: true },
  "/clients": { collaboratorHidden: true },
  "/documents": { collaboratorHidden: true },
  "/communications": { collaboratorHidden: true },
  "/new-benefits": { collaboratorHidden: true },
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
