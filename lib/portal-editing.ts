/**
 * portal-editing — which portal page an inline Editing Panel belongs to, and which
 * permission function may edit it.
 *
 * The portal is a participant-facing surface, so the editor only exists when the
 * `?comments=on` link armed it and a signed-in advisor has edit rights on the page's
 * function. This module is pure: the provider in `components/portal-editing` reads it,
 * and the save endpoints remain the authority.
 */

import type { PermissionFunction } from "@/types/teammate";
import type { RequiredLevel } from "@/lib/teammates/permission-levels";
import type { ViewerAccessLike } from "@/lib/teammates/nav-access";

/** The editing surface a portal route maps to. */
export type PortalEditPage =
  | "home"
  | "benefit"
  | "team"
  | "documents"
  | "news"
  | "videos";

export interface PortalEditPermission {
  permission: PermissionFunction;
  level: RequiredLevel;
}

export interface PortalEditTarget {
  page: PortalEditPage;
  /** Human label for the panel header. */
  label: string;
  /** The page's own function — the one the route is about. */
  permission: PermissionFunction;
  /** The real benefit category, when this is a benefit hub. */
  category: string | null;
  /**
   * Every function the page's panel can expose. A benefit hub can also carry a
   * documents section and a video section, each with its own grant.
   */
  permissions: PortalEditPermission[];
}

const BENEFIT_SEGMENTS: Record<string, string> = {
  retirement: "Retirement",
  "health-insurance": "Group Health",
  "life-insurance": "Group Life",
  "wellness-programs": "Other",
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The category a benefit hub route addresses, including the advisor's custom hub slug. */
export function portalEditBenefitCategory(
  segment: string,
  customHubSlug?: string | null,
): string | null {
  const decoded = safeDecode(String(segment || ""));
  const custom = String(customHubSlug || "").trim();
  if (custom && decoded === custom) return "Other";
  return BENEFIT_SEGMENTS[decoded] ?? null;
}

/**
 * Resolve the current portal path to an editable target.
 *
 * `null` means the page is not an editing surface — the safe answer. An unknown
 * second segment is not treated as a custom benefit: only the advisor's own hub slug
 * (passed in) earns that, so a typo cannot open a panel against another page's data.
 */
export function resolvePortalEditTarget(input: {
  pathname: string;
  planSlug: string;
  customHubSlug?: string | null;
}): PortalEditTarget | null {
  const planSlug = safeDecode(String(input.planSlug || "")).trim();
  if (!planSlug) return null;

  const segments = String(input.pathname || "")
    .split("/")
    .filter(Boolean)
    .map(safeDecode);

  if (segments[0] !== planSlug) return null;

  // The plan landing page — plan branding and messaging.
  if (segments.length === 1) {
    return {
      page: "home",
      label: "Home",
      permission: "plan_details_branding",
      category: null,
      permissions: [{ permission: "plan_details_branding", level: "edit" }],
    };
  }

  if (segments.length !== 2) return null;
  const segment = segments[1];

  if (segment === "my-benefits-team") {
    return {
      page: "team",
      label: "My Benefits Team",
      permission: "key_contacts",
      category: null,
      permissions: [{ permission: "key_contacts", level: "edit" }],
    };
  }

  if (segment === "news-events") {
    return {
      page: "news",
      label: "News & Events",
      permission: "marketing",
      category: null,
      permissions: [{ permission: "marketing", level: "edit" }],
    };
  }

  if (segment === "employee-resources") {
    return {
      page: "documents",
      label: "Employee Resources",
      permission: "documents",
      category: null,
      permissions: [
        { permission: "documents", level: "edit" },
        { permission: "video", level: "edit" },
      ],
    };
  }

  const category = portalEditBenefitCategory(segment, input.customHubSlug);
  if (!category) return null;

  return {
    page: "benefit",
    label: category === "Other" ? "Custom Benefit" : category,
    permission: "create_benefits",
    category,
    permissions: [
      { permission: "create_benefits", level: "edit" },
      { permission: "documents", level: "edit" },
      { permission: "video", level: "edit" },
    ],
  };
}

/** May this viewer edit the target at all (any of its functions)? */
export function canEditPortalTarget(
  target: PortalEditTarget | null,
  viewer: ViewerAccessLike,
): boolean {
  if (!target) return false;
  return target.permissions.some((entry) =>
    viewer.can(entry.permission, entry.level),
  );
}

/** May this viewer edit one specific function on the current page? */
export function canEditPortalFunction(
  target: PortalEditTarget | null,
  viewer: ViewerAccessLike,
  permission: PermissionFunction,
): boolean {
  if (!target) return false;
  const entry = target.permissions.find((p) => p.permission === permission);
  return entry ? viewer.can(entry.permission, entry.level) : false;
}
