/**
 * The one place that knows how a Benefit Hub page addresses its data.
 *
 * The four hub pages (`/retirement`, `/health-insurance`, `/life-insurance` and the
 * Custom hub) each read the same endpoint — `GET /api/clients/{id}/benefits/{category}
 * ?forPortal=1&withTopics=1`. That read is the hub's SINGLE source: the banner copy,
 * the help-card grid, the Quick Answers questions and the Action Hub rows all come
 * from it.
 *
 * The portal provider warms this read inside its own bootstrap skeleton
 * (`preloadBenefitHubData`), so the page mounts with the data already in the SWR
 * cache. That is what keeps the hub to ONE skeleton: without it the provider's
 * full-viewport skeleton lifted first, and the hub sections then loaded behind a
 * second round of skeletons.
 *
 * Both halves therefore go through this module — the provider's preload and the
 * page's `useSWR` — because a preload only helps if the URL it warms is BYTE-FOR-BYTE
 * the key the page subscribes to.
 */
import { preload } from "swr";

/**
 * Static hub segments → the benefit category each one reads.
 *
 * `retirement`, `health-insurance` and `life-insurance` are the three fixed hubs.
 */
export const BENEFIT_HUB_CATEGORY_BY_SEGMENT: Record<string, string> = {
  retirement: "Retirement",
  "health-insurance": "Group Health",
  "life-insurance": "Group Life",
};

/**
 * The category the Custom hub reads. Its route segment is the plan's own benefit
 * name, so it cannot be enumerated — every second segment that is not a fixed portal
 * route IS that hub (the route tree has nothing else at that depth).
 */
export const CUSTOM_BENEFIT_HUB_CATEGORY = "Company / Plan Sponsor";

/**
 * The portal's fixed second-level routes. Anything here is not a hub, so the provider
 * must not warm a benefit read for it.
 */
const RESERVED_PORTAL_SEGMENTS = new Set([
  "employee-resources",
  "my-benefits-team",
  "news-events",
  "not-found",
  "privacy",
  "terms",
]);

/**
 * The benefit category a portal pathname reads, or `null` when the path is not a
 * Benefit Hub.
 *
 * `/{plan}` (the landing page) and `/{plan}/my-benefits-team` are not hubs; both
 * answer `null`.
 */
export function benefitHubCategoryForPath(
  pathname: string | null | undefined,
): string | null {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  // `/{plan}` has no hub segment at all.
  if (segments.length < 2) return null;

  let segment = segments[1];
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // A malformed escape is not a hub segment name; compare it as written.
  }

  const fixed = BENEFIT_HUB_CATEGORY_BY_SEGMENT[segment];
  if (fixed) return fixed;
  if (RESERVED_PORTAL_SEGMENTS.has(segment)) return null;

  // Everything else at this depth is the Custom hub, whose category is fixed even
  // though its path is the plan's own benefit name.
  return CUSTOM_BENEFIT_HUB_CATEGORY;
}

/** The key the hub reads — and the key the provider preloads. */
export function benefitHubApiPath(
  clientId: string,
  category: string,
): string {
  return `/api/clients/${clientId}/benefits/${encodeURIComponent(
    category,
  )}?forPortal=1&withTopics=1`;
}

/**
 * The fetcher both halves use, so preloaded data has the page's exact shape.
 *
 * `any` on purpose: the payload's shape depends on the route's benefit (it carries a
 * `benefit` row and a `topics` payload), and each hub page narrows the fields it
 * needs. A stricter type here would only force casts at four call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function portalBenefitFetcher(url: string): Promise<any> {
  return fetch(url).then((response) => response.json());
}

/**
 * Warm a hub's read into the SWR cache.
 *
 * Awaited by the portal provider's bootstrap, so the skeleton it already shows covers
 * this read too — one wait for the whole first paint instead of one skeleton for the
 * plan and a second one for each hub section.
 *
 * Preloading is an optimisation and must never be able to block the portal: a failed
 * warm-up resolves quietly, and the page's own `useSWR` retries on mount.
 */
export async function preloadBenefitHubData(
  clientId: string | null | undefined,
  category: string | null,
): Promise<void> {
  if (!clientId || !category) return;
  try {
    // The key is the whole contract: the hub's `useSWR` subscribes to this exact
    // string, so the entry warmed here is the entry it reads on mount. Its own
    // options (`revalidateOnFocus: false`, `dedupingInterval: 60_000`) then decide
    // that the warmed data is still fresh.
    await preload(benefitHubApiPath(clientId, category), portalBenefitFetcher);
  } catch {
    // See the note above: the page's own read is the fallback.
  }
}
