import {
  COMMENTS_RAIL_PARAM,
  COMMENTS_RAIL_VALUE,
} from "@/lib/comments/portal-surface";

/**
 * "Open the Edit Panel on this section" — carried across a navigation.
 *
 * Some portal pages have no editor for the thing the advisor clicked: the footer
 * disclosure belongs to the Landing Page's panel, so clicking its blue Edit button
 * on My Benefits Team, News & Events or Employee Resources has to GO to the landing
 * page and open the panel there.
 *
 * The request travels in the URL (`?editSection=…&editFrom=…`) rather than in
 * component state, and it KEEPS `?edit=true`: that flag is what mounts the portal's
 * editing chrome at all (`PortalCommentsRail` renders the provider tree only when
 * armed). The rail itself is then opened with comments OFF — see
 * `hasPortalEditIntent`, which the rail uses to pick its initial mode.
 */

/** The query parameter naming the panel section to open. */
export const PORTAL_EDIT_SECTION_PARAM = "editSection";
/** The query parameter naming the page the advisor clicked from, in words. */
export const PORTAL_EDIT_FROM_PARAM = "editFrom";

/**
 * "Open the Edit Panel" — a `postMessage` payload, for a host page that draws the portal
 * inside a frame.
 *
 * The dashboard's Employee Resources preview embeds this page (armed with `?edit=true`)
 * and offers one Open Edit Panel button in its own toolbar. Reloading the frame with an
 * `editSection` on every click would throw away the advisor's scroll position, so the
 * host posts this instead and `PortalEditingProvider` opens the panel in place.
 *
 * Only the TYPE travels; the receiver still decides whether the viewer may edit, and
 * only accepts the message from its own origin.
 */
export const PORTAL_EDIT_OPEN_MESSAGE = "portal-editing:open-panel";

/** "Close the Edit Panel" — the same channel, for the host's toggle. */
export const PORTAL_EDIT_CLOSE_MESSAGE = "portal-editing:close-panel";

/**
 * The panel's own state, posted BY the framed portal TO its host.
 *
 * The host's button is a toggle, so it has to know what the panel is doing — including
 * when the advisor closes it with the panel's own X, or opens it from a section's blue
 * pencil. Sent on every change of `isOpen`.
 */
export const PORTAL_EDIT_STATE_MESSAGE = "portal-editing:panel-state";

export interface PortalEditHrefInput {
  /** The current URL's query string, `?` optional. */
  search?: string | null;
  /** The path of the page that owns the section (`/{plan}`). */
  editPath: string;
  /** The URL to push, which may carry a hash. Defaults to `editPath`. */
  editHref?: string;
  /** The panel section to open. */
  sectionId: string;
  /** The page the advisor came from, in words ("News & Events"). */
  sourceLabel?: string;
}

/**
 * Build the URL for "go and edit this elsewhere".
 *
 * Keeps any unrelated query parameters and adds the two edit parameters before
 * the hash so the browser still scrolls to the anchor. The editing flag is forced
 * on: without it the portal mounts no editing provider at all, and the panel could
 * never open.
 */
export function buildPortalEditHref({
  search,
  editPath,
  editHref,
  sectionId,
  sourceLabel,
}: PortalEditHrefInput): string {
  const [base, hash] = String(editHref || editPath).split("#");
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  // Arms the editing chrome; the rail opens with comments OFF instead.
  params.set(COMMENTS_RAIL_PARAM, COMMENTS_RAIL_VALUE);
  params.set(PORTAL_EDIT_SECTION_PARAM, sectionId);
  if (sourceLabel) params.set(PORTAL_EDIT_FROM_PARAM, sourceLabel);

  const query = params.toString();
  const withQuery = query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

/** True when this URL asks the panel to open on a section. */
export function hasPortalEditIntent(search: string | null | undefined): boolean {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  return !!params.get(PORTAL_EDIT_SECTION_PARAM);
}

/**
 * The name of a portal page, for the "you came from …" message.
 *
 * Matched on the trailing segment, so it works with or without the plan prefix
 * (the portal addresses plans by slug, and the segment is what carries the name).
 */
export function portalPageLabel(pathname: string | null): string {
  const path = String(pathname || "");
  if (/\/news-events(\/|$)/.test(path)) return "News & Events";
  if (/\/my-benefits-team(\/|$)/.test(path)) return "My Benefits Team";
  if (/\/employee-resources(\/|$)/.test(path)) return "Employee Resources";
  if (/\/retirement(\/|$)/.test(path)) return "Retirement";
  if (/\/health-insurance(\/|$)/.test(path)) return "Group Health";
  if (/\/life-insurance(\/|$)/.test(path)) return "Group Life";
  return "this page";
}
