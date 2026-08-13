// lib/fetch-profile.ts
//
// Single-flight + short-TTL fetcher for GET /api/profile.
//
// Several components on a page (settings forms, the layout header's user-nav,
// the on-demand Disclaimers tab, etc.) all need the same user profile.
// Without coordination each one fires its own `fetch("/api/profile")`, and
// because the route is slow (Prisma query with several nested includes),
// "is it cached yet?" fallbacks end up racing each other.
//
// This helper:
//   1. Coalesces concurrent callers onto a single in-flight request.
//   2. Reuses a recently resolved profile (CACHE_TTL) so later callers — e.g.
//      a tab that only mounts when opened — don't re-hit the network for data
//      the page already fetched.
// It resolves to the parsed JSON profile, or null on failure/non-2xx (callers
// treat that as "no data available").

let profilePromise: Promise<any | null> | null = null;
let cachedProfile: any | null = null;
let cachedAt = 0;

// Matches the SWR dedupingInterval used on the settings page, so the in-memory
// cache and SWR's cache expire around the same time.
const CACHE_TTL = 60_000;

export function fetchProfileOnce(): Promise<any | null> {
  // Serve a recently fetched profile from memory — no network request.
  if (cachedProfile !== null && Date.now() - cachedAt < CACHE_TTL) {
    return Promise.resolve(cachedProfile);
  }

  if (!profilePromise) {
    profilePromise = fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => {
        profilePromise = null;
      });

    // Cache the resolved value for the TTL window. On failure (null) nothing
    // is cached, so the next call retries the request.
    profilePromise.then((data) => {
      if (data !== null) {
        cachedProfile = data;
        cachedAt = Date.now();
      }
    });
  }

  return profilePromise;
}

/**
 * Drop the cached profile so the next fetchProfileOnce() hits the network.
 * Call after any save that changes profile data (userSetup, branding,
 * organization, disclaimers) to avoid serving stale data.
 */
export function invalidateProfileCache(): void {
  cachedProfile = null;
  cachedAt = 0;
}
