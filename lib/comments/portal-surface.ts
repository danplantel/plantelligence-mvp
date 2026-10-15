/**
 * portal-surface — where the **Portal Comments UI** applies, and how a link asks for it.
 *
 * (the Comments panel as it appears on the participant portal — see portal-comments-rail.tsx)
 *
 * Two things live here, because they are one contract between the buttons that open the portal and
 * the page that has to make sense of the link.
 *
 *  1. WHICH SURFACE a portal path is. The portal addresses each benefit page by its own route
 *     segment, which is NOT the dashboard's category key — `/health-insurance` is "Group Health" —
 *     while the comments API wants the REAL category. `getBenefitPortalSegment` goes the other way,
 *     so this is its inverse, and the suite pins the two against each other so they cannot drift.
 *
 *  2. THE FLAG the Open Portal buttons carry. `?comments=on` is a PREFERENCE, never an authority:
 *     the portal mounts the rail only when a session exists as well, and every read and write still
 *     goes through `resolveCommentAccess` — the one gate. A signed token was considered and rejected:
 *     the portal is same-origin with the dashboard, so the session cookie is already sent, and a
 *     second authorization path beside the one gate is exactly how two doors start disagreeing.
 *
 *     The word is `on` rather than a thread id on purpose: `?comment=<threadId>` is already a THREAD
 *     deep link (the provider reads it), so a bare `?comments=<id>` would be a trap. `on` is also
 *     the word the mode itself uses.
 *
 * Dependency-free on purpose: dashboard components import the flag helpers, and the portal layout
 * imports the surface mapping, so neither should be pulling in the other's world.
 */

/** The query parameter an Open Portal link carries. */
export const COMMENTS_RAIL_PARAM = "comments";

/** Its one accepted value. */
export const COMMENTS_RAIL_VALUE = "on";

/** What the comments API and `useCommentSurface` need to know about a portal page. */
export interface PortalCommentsSurface {
  targetType: "plan" | "benefit";
  /** The REAL category ("Group Health"), never the route segment ("health-insurance"). */
  category: string | null;
}

/**
 * Route segment to category, for the pages the portal can address.
 *
 * `wellness-programs` is the Custom hub's legacy segment — the one an unnamed Custom benefit is
 * reachable at — so it maps to "Other" alongside the advisor's own name for the hub.
 */
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
    // A malformed escape sequence is not a path this portal serves; leave it as it arrived so the
    // comparison below simply fails, rather than throwing out of a render.
    return value;
  }
}

/**
 * The comment surface a portal path is, or null when it is not one the rail belongs on.
 *
 * Null is a real answer and the common one: the portal serves pages the comments feature has no
 * surface for, and the safe reading of an unrecognised path is NO rail — never the nearest page's
 * comments, which would show a reader a different page's conversation under this page's title.
 */
export function portalCommentsSurface(input: {
  /** `usePathname()` — the portal's path, with the plan slug first. */
  pathname: string;
  /** The `[id]` param: the plan's slug (the portal's own addressing). */
  planSlug: string;
  /**
   * The Custom hub's own slug, when it has an advisor-chosen name. The layout already computes this
   * to build its links, so it is passed in rather than re-derived here.
   */
  customHubSlug?: string | null;
}): PortalCommentsSurface | null {
  const planSlug = safeDecode(String(input.planSlug || "")).trim();
  if (!planSlug) return null;

  const segments = String(input.pathname || "")
    .split("/")
    .filter(Boolean)
    .map(safeDecode);

  // The path must belong to THIS plan. Without this a stray path would inherit whichever plan the
  // layout happened to be mounted for.
  if (segments[0] !== planSlug) return null;

  // The plan's own landing page — the surface the Plan comments are attached to.
  if (segments.length === 1) {
    return { targetType: "plan", category: null };
  }

  // Exactly one segment below the plan is a benefit page. A deeper path is not a surface the portal
  // addresses, so it gets no rail rather than an approximation of one.
  if (segments.length !== 2) return null;

  const segment = segments[1];
  const customHubSlug = String(input.customHubSlug || "").trim();
  if (customHubSlug && segment === customHubSlug) {
    return { targetType: "benefit", category: "Other" };
  }

  const category = BENEFIT_SEGMENTS[segment];
  return category ? { targetType: "benefit", category } : null;
}

/**
 * The same URL, asking for the Comments rail.
 *
 * MUST be applied LAST — after any benefit segment has been appended. One caller builds
 * `getBenefitsHubOpenPortalUrl(slug)` and then concatenates `/{segment}`, so putting the flag inside
 * the builder would produce `…?comments=on/health-insurance`. That is why this is a wrapper over a
 * finished URL rather than an argument to the builder.
 *
 * An existing query is respected (`&` rather than `?`), a trailing `#hash` stays last, and a URL
 * that already asks for the rail is returned untouched — the writer is idempotent, so a caller
 * cannot end up with the flag twice.
 */
export function withCommentsRail(url: string): string {
  const value = String(url || "");
  if (!value) return value;

  const hashAt = value.indexOf("#");
  const head = hashAt === -1 ? value : value.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : value.slice(hashAt);

  if (new RegExp(`[?&]${COMMENTS_RAIL_PARAM}=`).test(head)) return value;

  return `${head}${head.includes("?") ? "&" : "?"}${COMMENTS_RAIL_PARAM}=${COMMENTS_RAIL_VALUE}${hash}`;
}

/**
 * Does this URL ask for the Comments rail? The inverse of `withCommentsRail`, kept beside it so the
 * two cannot disagree about the spelling.
 *
 * Anything other than the exact value counts as absent, so a hand-edited `?comments=1` or
 * `?comments=anything` does not quietly switch the rail on — the flag is compared, not guessed at.
 */
export function wantsCommentsRail(search: string): boolean {
  const value = String(search || "");
  if (!value) return false;
  const params = new URLSearchParams(
    value.startsWith("?") ? value.slice(1) : value,
  );
  return params.get(COMMENTS_RAIL_PARAM) === COMMENTS_RAIL_VALUE;
}
